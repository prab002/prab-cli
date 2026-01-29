/**
 * SMC (Smart Money Concepts) Analyzer
 * Combines SMC with traditional analysis for comprehensive trading signals
 */

import chalk from "chalk";
import ora from "ora";
import { fetchCryptoData, TimeInterval, OHLCV } from "./data-fetcher";
import { analyzeSMC, SMCAnalysis } from "./smc-indicators";
import { calculateRSI, calculateMACD, analyzeTrend } from "./indicators";
import { getApiKey, getModelConfig } from "../config";
import { GroqProvider } from "../models/groq-provider";
import {
  createMarketStructureVisual,
  createOrderBlockVisual,
  createFVGVisual,
  createLiquidityVisual,
  createTradeSetupVisual,
  createSMCVisualChart,
  createCandlestickChart,
} from "./chart-visual";

// ============================================
// TYPES
// ============================================

export interface SMCTradeSetup {
  bias: "long" | "short" | "neutral";
  confidence: number;
  entry: {
    type: "order_block" | "fvg" | "liquidity_sweep" | "structure_break";
    zone: { low: number; high: number };
    trigger: string;
  };
  stopLoss: number;
  targets: number[];
  riskReward: number;
  invalidation: string;
}

export interface FullSMCAnalysis {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;
  smc: SMCAnalysis;
  tradeSetup: SMCTradeSetup;
  confluence: string[];
  warnings: string[];
  candles: OHLCV[];
}

// ============================================
// TRADE SETUP GENERATION
// ============================================

function generateSMCTradeSetup(smc: SMCAnalysis, currentPrice: number): SMCTradeSetup {
  const { marketStructure, orderBlocks, fairValueGaps, liquidity, premiumDiscount, bias } = smc;

  const setup: SMCTradeSetup = {
    bias:
      bias.direction === "bullish" ? "long" : bias.direction === "bearish" ? "short" : "neutral",
    confidence: bias.confidence,
    entry: {
      type: "structure_break",
      zone: { low: currentPrice * 0.99, high: currentPrice * 1.01 },
      trigger: "Wait for confirmation",
    },
    stopLoss: currentPrice * (bias.direction === "bullish" ? 0.97 : 1.03),
    targets: [],
    riskReward: 0,
    invalidation: "",
  };

  // Determine best entry based on SMC confluence
  if (bias.direction === "bullish") {
    // Look for bullish entry
    if (orderBlocks.nearest?.type === "bullish" && !orderBlocks.nearest.mitigated) {
      const ob = orderBlocks.nearest;
      setup.entry = {
        type: "order_block",
        zone: { low: ob.bottom, high: ob.top },
        trigger: `Enter on bullish reaction from OB zone`,
      };
      setup.stopLoss = ob.bottom * 0.99;
    } else if (fairValueGaps.unfilled.some((f) => f.type === "bullish")) {
      const fvg = fairValueGaps.unfilled.find((f) => f.type === "bullish")!;
      setup.entry = {
        type: "fvg",
        zone: { low: fvg.bottom, high: fvg.top },
        trigger: `Enter on fill of bullish FVG`,
      };
      setup.stopLoss = fvg.bottom * 0.99;
    } else if (premiumDiscount.zone === "discount") {
      setup.entry = {
        type: "liquidity_sweep",
        zone: { low: premiumDiscount.rangeLow, high: premiumDiscount.equilibrium },
        trigger: `Enter in discount zone after sweep of lows`,
      };
      setup.stopLoss = premiumDiscount.rangeLow * 0.99;
    }

    // Set targets based on liquidity
    if (liquidity.buySide.length > 0) {
      setup.targets = liquidity.buySide.slice(0, 3).map((l) => l.level);
    } else {
      setup.targets = [currentPrice * 1.02, currentPrice * 1.04, premiumDiscount.rangeHigh];
    }

    setup.invalidation = `Break below ${marketStructure.swingLows[marketStructure.swingLows.length - 1]?.price.toFixed(2) || "recent low"}`;
  } else if (bias.direction === "bearish") {
    // Look for bearish entry
    if (orderBlocks.nearest?.type === "bearish" && !orderBlocks.nearest.mitigated) {
      const ob = orderBlocks.nearest;
      setup.entry = {
        type: "order_block",
        zone: { low: ob.bottom, high: ob.top },
        trigger: `Enter on bearish rejection from OB zone`,
      };
      setup.stopLoss = ob.top * 1.01;
    } else if (fairValueGaps.unfilled.some((f) => f.type === "bearish")) {
      const fvg = fairValueGaps.unfilled.find((f) => f.type === "bearish")!;
      setup.entry = {
        type: "fvg",
        zone: { low: fvg.bottom, high: fvg.top },
        trigger: `Enter on fill of bearish FVG`,
      };
      setup.stopLoss = fvg.top * 1.01;
    } else if (premiumDiscount.zone === "premium") {
      setup.entry = {
        type: "liquidity_sweep",
        zone: { low: premiumDiscount.equilibrium, high: premiumDiscount.rangeHigh },
        trigger: `Enter in premium zone after sweep of highs`,
      };
      setup.stopLoss = premiumDiscount.rangeHigh * 1.01;
    }

    // Set targets based on liquidity
    if (liquidity.sellSide.length > 0) {
      setup.targets = liquidity.sellSide.slice(0, 3).map((l) => l.level);
    } else {
      setup.targets = [currentPrice * 0.98, currentPrice * 0.96, premiumDiscount.rangeLow];
    }

    setup.invalidation = `Break above ${marketStructure.swingHighs[marketStructure.swingHighs.length - 1]?.price.toFixed(2) || "recent high"}`;
  }

  // Calculate R:R
  const entryPrice = (setup.entry.zone.low + setup.entry.zone.high) / 2;
  const risk = Math.abs(entryPrice - setup.stopLoss);
  const reward = setup.targets.length > 1 ? Math.abs(setup.targets[1] - entryPrice) : risk * 2;
  setup.riskReward = Math.round((reward / risk) * 10) / 10;

  return setup;
}

// ============================================
// AI ANALYSIS
// ============================================

async function generateSMCAIAnalysis(analysis: FullSMCAnalysis): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) return "AI analysis unavailable (no API key configured)";

  const modelConfig = getModelConfig();
  const provider = new GroqProvider(modelConfig.modelId, 0.7);
  provider.initialize(apiKey, modelConfig.modelId);

  const { smc, tradeSetup, currentPrice } = analysis;

  const prompt = `You are an expert Smart Money Concepts (SMC) trader. Analyze this setup and provide actionable advice (4-5 sentences).

Symbol: ${analysis.symbol}
Current Price: $${currentPrice.toFixed(2)}
24h Change: ${analysis.priceChange24h.toFixed(2)}%

MARKET STRUCTURE:
- Trend: ${smc.marketStructure.trend}
- Last BOS: ${smc.marketStructure.lastBOS ? `${smc.marketStructure.lastBOS.direction} at $${smc.marketStructure.lastBOS.level.toFixed(2)}` : "None"}
- Last CHoCH: ${smc.marketStructure.lastCHoCH ? `${smc.marketStructure.lastCHoCH.direction} at $${smc.marketStructure.lastCHoCH.level.toFixed(2)}` : "None"}

ORDER BLOCKS:
- Bullish OBs: ${smc.orderBlocks.bullish.length} (Nearest: ${smc.orderBlocks.nearest?.type === "bullish" ? `$${smc.orderBlocks.nearest.bottom.toFixed(2)}-$${smc.orderBlocks.nearest.top.toFixed(2)}` : "N/A"})
- Bearish OBs: ${smc.orderBlocks.bearish.length} (Nearest: ${smc.orderBlocks.nearest?.type === "bearish" ? `$${smc.orderBlocks.nearest.bottom.toFixed(2)}-$${smc.orderBlocks.nearest.top.toFixed(2)}` : "N/A"})

FAIR VALUE GAPS:
- Unfilled: ${smc.fairValueGaps.unfilled.length}
- Bullish FVGs above: ${smc.fairValueGaps.bullish.filter((f) => !f.filled && f.bottom > currentPrice).length}
- Bearish FVGs below: ${smc.fairValueGaps.bearish.filter((f) => !f.filled && f.top < currentPrice).length}

LIQUIDITY:
- Buy-side (above): ${smc.liquidity.buySide.map((l) => `$${l.level.toFixed(2)}`).join(", ") || "None"}
- Sell-side (below): ${smc.liquidity.sellSide.map((l) => `$${l.level.toFixed(2)}`).join(", ") || "None"}

PREMIUM/DISCOUNT:
- Zone: ${smc.premiumDiscount.zone} (${smc.premiumDiscount.fibLevel.toFixed(0)}% of range)
- Range: $${smc.premiumDiscount.rangeLow.toFixed(2)} - $${smc.premiumDiscount.rangeHigh.toFixed(2)}
- Equilibrium: $${smc.premiumDiscount.equilibrium.toFixed(2)}

TRADE SETUP:
- Bias: ${tradeSetup.bias.toUpperCase()}
- Entry Type: ${tradeSetup.entry.type}
- Entry Zone: $${tradeSetup.entry.zone.low.toFixed(2)} - $${tradeSetup.entry.zone.high.toFixed(2)}
- Stop Loss: $${tradeSetup.stopLoss.toFixed(2)}
- Targets: ${tradeSetup.targets.map((t) => `$${t.toFixed(2)}`).join(", ")}
- R:R: ${tradeSetup.riskReward}:1

SMC BIAS REASONING:
${smc.bias.reasoning.map((r) => `- ${r}`).join("\n")}

Provide SMC-focused analysis explaining:
1. Current market structure and institutional order flow
2. Where smart money is likely positioned
3. Best entry strategy (order block, FVG, or liquidity sweep)
4. Key levels to watch and when to enter
Be specific with prices and SMC terminology.`;

  try {
    const stream = provider.streamChat([{ role: "user", content: prompt }] as any, []);
    let response = "";
    for await (const chunk of stream) {
      if (chunk.content && typeof chunk.content === "string") {
        response += chunk.content;
      }
    }
    return response.trim();
  } catch (error: any) {
    return `AI analysis unavailable: ${error.message}`;
  }
}

// ============================================
// DISPLAY
// ============================================

function formatPrice(price: number): string {
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  if (price < 100) return `$${price.toFixed(2)}`;
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function wordWrap(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxWidth) {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines;
}

export function displaySMCAnalysis(analysis: FullSMCAnalysis, aiAnalysis?: string): void {
  const boxWidth = 58;
  const contentWidth = boxWidth - 4;

  const border = {
    top: chalk.magenta("\u{250C}" + "\u{2500}".repeat(boxWidth) + "\u{2510}"),
    mid: chalk.magenta("\u{251C}" + "\u{2500}".repeat(boxWidth) + "\u{2524}"),
    bot: chalk.magenta("\u{2514}" + "\u{2500}".repeat(boxWidth) + "\u{2518}"),
    left: chalk.magenta("\u{2502}"),
    right: chalk.magenta("\u{2502}"),
  };

  const line = (content: string, pad: number = contentWidth) => {
    console.log(border.left + "  " + content.padEnd(pad) + "  " + border.right);
  };

  const { smc, tradeSetup, currentPrice, priceChange24h } = analysis;
  const changeColor = priceChange24h >= 0 ? chalk.green : chalk.red;
  const changeSign = priceChange24h >= 0 ? "+" : "";

  console.log("");
  console.log(border.top);

  // Header
  line(chalk.bold.white(`\u{1F3E6} ${analysis.symbol} - Smart Money Analysis`));
  line(
    chalk.bold.yellow(`Price: ${formatPrice(currentPrice)}`) +
      `  ${changeColor(changeSign + priceChange24h.toFixed(2) + "%")}`
  );

  // Market Structure
  console.log(border.mid);
  line(chalk.bold("\u{1F4CA} MARKET STRUCTURE"));
  const trendColor =
    smc.marketStructure.trend === "bullish"
      ? chalk.green
      : smc.marketStructure.trend === "bearish"
        ? chalk.red
        : chalk.yellow;
  line(`   Trend: ${trendColor(smc.marketStructure.trend.toUpperCase())}`);

  if (smc.marketStructure.lastBOS) {
    const bosColor = smc.marketStructure.lastBOS.direction === "bullish" ? chalk.green : chalk.red;
    line(
      `   Last BOS: ${bosColor(smc.marketStructure.lastBOS.direction)} @ ${formatPrice(smc.marketStructure.lastBOS.level)}`
    );
  }
  if (smc.marketStructure.lastCHoCH) {
    const chochColor =
      smc.marketStructure.lastCHoCH.direction === "bullish" ? chalk.green : chalk.red;
    line(
      `   Last CHoCH: ${chochColor(smc.marketStructure.lastCHoCH.direction)} @ ${formatPrice(smc.marketStructure.lastCHoCH.level)}`
    );
  }

  // Order Blocks
  console.log(border.mid);
  line(chalk.bold("\u{1F4E6} ORDER BLOCKS"));
  line(`   Bullish OBs: ${chalk.green(smc.orderBlocks.bullish.length.toString())}`);
  line(`   Bearish OBs: ${chalk.red(smc.orderBlocks.bearish.length.toString())}`);

  if (smc.orderBlocks.nearest) {
    const ob = smc.orderBlocks.nearest;
    const obColor = ob.type === "bullish" ? chalk.green : chalk.red;
    line(`   Nearest: ${obColor(ob.type)} ${formatPrice(ob.bottom)} - ${formatPrice(ob.top)}`);
    line(`   Strength: ${ob.strength} | Mitigated: ${ob.mitigated ? "Yes" : "No"}`);
  }

  // Fair Value Gaps
  console.log(border.mid);
  line(chalk.bold("\u{26A1} FAIR VALUE GAPS"));
  line(`   Unfilled FVGs: ${chalk.yellow(smc.fairValueGaps.unfilled.length.toString())}`);

  smc.fairValueGaps.unfilled.slice(0, 2).forEach((fvg) => {
    const fvgColor = fvg.type === "bullish" ? chalk.green : chalk.red;
    line(`   ${fvgColor(fvg.type)}: ${formatPrice(fvg.bottom)} - ${formatPrice(fvg.top)}`);
  });

  // Liquidity
  console.log(border.mid);
  line(chalk.bold("\u{1F4B0} LIQUIDITY POOLS"));

  if (smc.liquidity.buySide.length > 0) {
    line(chalk.cyan("   Buy-side (stops above):"));
    smc.liquidity.buySide.slice(0, 2).forEach((l) => {
      line(`     ${formatPrice(l.level)} (${l.strength} touch${l.strength > 1 ? "es" : ""})`);
    });
  }

  if (smc.liquidity.sellSide.length > 0) {
    line(chalk.cyan("   Sell-side (stops below):"));
    smc.liquidity.sellSide.slice(0, 2).forEach((l) => {
      line(`     ${formatPrice(l.level)} (${l.strength} touch${l.strength > 1 ? "es" : ""})`);
    });
  }

  // Premium/Discount
  console.log(border.mid);
  line(chalk.bold("\u{1F3AF} PREMIUM/DISCOUNT"));
  const zoneColor =
    smc.premiumDiscount.zone === "discount"
      ? chalk.green
      : smc.premiumDiscount.zone === "premium"
        ? chalk.red
        : chalk.yellow;
  line(
    `   Zone: ${zoneColor(smc.premiumDiscount.zone.toUpperCase())} (${smc.premiumDiscount.fibLevel.toFixed(0)}%)`
  );
  line(
    `   Range: ${formatPrice(smc.premiumDiscount.rangeLow)} - ${formatPrice(smc.premiumDiscount.rangeHigh)}`
  );
  line(`   Equilibrium: ${formatPrice(smc.premiumDiscount.equilibrium)}`);

  // Trade Setup
  console.log(border.mid);
  const biasColor =
    tradeSetup.bias === "long"
      ? chalk.green.bold
      : tradeSetup.bias === "short"
        ? chalk.red.bold
        : chalk.yellow.bold;
  const biasIcon =
    tradeSetup.bias === "long"
      ? "\u{1F7E2}"
      : tradeSetup.bias === "short"
        ? "\u{1F534}"
        : "\u{1F7E1}";
  line(
    chalk.bold(`\u{1F4DD} TRADE SETUP: ${biasIcon} ${biasColor(tradeSetup.bias.toUpperCase())}`)
  );
  line(`   Confidence: ${chalk.white(tradeSetup.confidence + "%")}`);
  line(`   Entry Type: ${chalk.cyan(tradeSetup.entry.type.replace(/_/g, " "))}`);
  line(
    `   Entry Zone: ${chalk.white(formatPrice(tradeSetup.entry.zone.low))} - ${chalk.white(formatPrice(tradeSetup.entry.zone.high))}`
  );
  line(`   Stop Loss: ${chalk.red(formatPrice(tradeSetup.stopLoss))}`);
  line(`   Targets:`);
  tradeSetup.targets.slice(0, 3).forEach((t, i) => {
    const pct = ((t - currentPrice) / currentPrice) * 100;
    const pctStr = pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
    line(`     T${i + 1}: ${chalk.green(formatPrice(t))} (${chalk.green(pctStr)})`);
  });
  line(`   R:R Ratio: ${chalk.cyan(tradeSetup.riskReward + ":1")}`);

  // SMC Bias Reasoning
  console.log(border.mid);
  line(chalk.bold("\u{1F9E0} SMC REASONING"));
  smc.bias.reasoning.slice(0, 4).forEach((r) => {
    const lines = wordWrap(r, contentWidth - 5);
    lines.forEach((l, i) => line(chalk.gray(`   ${i === 0 ? "\u{2022}" : " "} ${l}`)));
  });

  // AI Analysis
  if (aiAnalysis) {
    console.log(border.mid);
    line(chalk.bold.magenta("\u{1F916} AI SMC ANALYSIS"));
    const aiLines = wordWrap(aiAnalysis, contentWidth - 3);
    aiLines.forEach((l) => line(chalk.white(`   ${l}`)));
  }

  console.log(border.bot);

  // ============================================
  // VISUAL CHARTS SECTION
  // ============================================

  console.log("");
  console.log(chalk.bold.cyan("  ═══════════════════════════════════════════════════════"));
  console.log(chalk.bold.cyan("                    📊 VISUAL ANALYSIS                    "));
  console.log(chalk.bold.cyan("  ═══════════════════════════════════════════════════════"));

  // Market Structure Visual
  createMarketStructureVisual(smc).forEach((l) => console.log(l));

  // Price Candlestick Chart (if candles available)
  if (analysis.candles && analysis.candles.length > 0) {
    console.log(chalk.bold.white("  ┌─────────────────────────────────────────────┐"));
    console.log(
      chalk.bold.white("  │") +
        chalk.bold.yellow("           PRICE ACTION (Last 50 Candles)    ") +
        chalk.bold.white("│")
    );
    console.log(chalk.bold.white("  └─────────────────────────────────────────────┘"));
    console.log("");
    const candleChart = createCandlestickChart(analysis.candles, 45, 12);
    candleChart.forEach((l) => console.log("    " + l));
    console.log(chalk.gray("    └" + "─".repeat(45) + "┘"));
    console.log(
      chalk.gray(
        "     " +
          chalk.green("█ Bullish") +
          "  " +
          chalk.red("░ Bearish") +
          "  " +
          chalk.gray("│ Wick")
      )
    );
    console.log("");
  }

  // Order Block Visual
  createOrderBlockVisual(smc.orderBlocks, currentPrice).forEach((l) => console.log(l));

  // FVG Visual
  createFVGVisual(smc.fairValueGaps, currentPrice).forEach((l) => console.log(l));

  // Liquidity Visual
  createLiquidityVisual(smc.liquidity, currentPrice).forEach((l) => console.log(l));

  // Trade Setup Visual
  const entryMid = (tradeSetup.entry.zone.low + tradeSetup.entry.zone.high) / 2;
  createTradeSetupVisual(
    currentPrice,
    entryMid,
    tradeSetup.stopLoss,
    tradeSetup.targets,
    tradeSetup.bias
  ).forEach((l) => console.log(l));

  // SMC Price Level Chart
  console.log("");
  const smcChart = createSMCVisualChart(currentPrice, smc, tradeSetup);
  smcChart.forEach((l) => console.log(l));

  console.log("");
  console.log(
    chalk.gray.italic(
      "  \u{26A0}\u{FE0F}  This is not financial advice. Always do your own research."
    )
  );
  console.log("");
}

// ============================================
// MAIN FUNCTION
// ============================================

export async function runSMCAnalysis(symbol: string): Promise<void> {
  const spinner = ora(`Analyzing ${symbol.toUpperCase()} with Smart Money Concepts...`).start();

  try {
    spinner.text = "Fetching market data...";
    const data = await fetchCryptoData(symbol, "4h", 200);

    spinner.text = "Identifying order blocks & FVGs...";
    const smc = analyzeSMC(data.candles);

    spinner.text = "Generating trade setup...";
    const tradeSetup = generateSMCTradeSetup(smc, data.currentPrice);

    const analysis: FullSMCAnalysis = {
      symbol: data.symbol,
      currentPrice: data.currentPrice,
      priceChange24h: data.priceChangePercent24h,
      smc,
      tradeSetup,
      confluence: smc.bias.reasoning,
      warnings: [],
      candles: data.candles,
    };

    spinner.text = "Getting AI insights...";
    const aiAnalysis = await generateSMCAIAnalysis(analysis);

    spinner.succeed(`SMC analysis complete for ${data.symbol}`);
    displaySMCAnalysis(analysis, aiAnalysis);
  } catch (error: any) {
    spinner.fail(`Failed to analyze ${symbol}`);
    console.log(chalk.red(`\nError: ${error.message}`));
  }
}
