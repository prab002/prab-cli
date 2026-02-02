/**
 * Order Block Trading Strategy
 * Focused analysis for order block-based trading signals
 */

import chalk from "chalk";
import ora from "ora";
import { fetchCryptoData, fetchOHLCV, OHLCV, TimeInterval } from "./data-fetcher";
import {
  findOrderBlocks,
  OrderBlock,
  findSwingPoints,
  calculatePremiumDiscount,
} from "./smc-indicators";
import { calculateATR, calculateRSI, analyzeTrend } from "./indicators";

// ============================================
// TYPES
// ============================================

export interface OrderBlockSignal {
  symbol: string;
  currentPrice: number;
  signal: "BUY" | "SELL" | "WAIT";
  confidence: number; // 0-100

  // Active Order Block details
  activeOB: {
    type: "bullish" | "bearish";
    top: number;
    bottom: number;
    midpoint: number;
    strength: "strong" | "moderate" | "weak";
    distancePercent: number;
    priceInZone: boolean;
  } | null;

  // All Order Blocks
  bullishOBs: OrderBlock[];
  bearishOBs: OrderBlock[];

  // Trade Setup
  entry: {
    price: number;
    zone: { low: number; high: number };
    type: string;
  };
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;

  // Context
  trend: "bullish" | "bearish" | "sideways";
  premiumDiscount: "premium" | "discount" | "equilibrium";
  reasoning: string[];
  warnings: string[];

  timestamp: number;
}

// ============================================
// ORDER BLOCK ANALYSIS
// ============================================

/**
 * Find the nearest unmitigated order block to current price
 */
function findNearestOrderBlock(
  orderBlocks: OrderBlock[],
  currentPrice: number,
  direction?: "bullish" | "bearish"
): OrderBlock | null {
  const filtered = direction
    ? orderBlocks.filter((ob) => ob.type === direction && !ob.mitigated)
    : orderBlocks.filter((ob) => !ob.mitigated);

  if (filtered.length === 0) return null;

  return filtered.sort((a, b) => {
    const distA = Math.min(Math.abs(currentPrice - a.top), Math.abs(currentPrice - a.bottom));
    const distB = Math.min(Math.abs(currentPrice - b.top), Math.abs(currentPrice - b.bottom));
    return distA - distB;
  })[0];
}

/**
 * Check if price is in or near an order block zone
 */
function checkPriceInOBZone(
  price: number,
  ob: OrderBlock,
  tolerance: number = 0.005 // 0.5%
): { inZone: boolean; nearZone: boolean; distancePercent: number } {
  const toleranceAmount = (ob.top - ob.bottom) * tolerance;
  const expandedTop = ob.top + toleranceAmount;
  const expandedBottom = ob.bottom - toleranceAmount;

  const inZone = price >= ob.bottom && price <= ob.top;
  const nearZone = price >= expandedBottom && price <= expandedTop;

  let distancePercent: number;
  if (inZone) {
    distancePercent = 0;
  } else if (price > ob.top) {
    distancePercent = ((price - ob.top) / price) * 100;
  } else {
    distancePercent = ((ob.bottom - price) / price) * 100;
  }

  return { inZone, nearZone, distancePercent };
}

/**
 * Calculate confidence score for order block trade
 */
function calculateOBConfidence(
  ob: OrderBlock,
  currentPrice: number,
  trend: "bullish" | "bearish" | "sideways",
  premiumDiscount: "premium" | "discount" | "equilibrium",
  rsi: number
): number {
  let score = 50;

  // Order block strength
  if (ob.strength === "strong") score += 15;
  else if (ob.strength === "moderate") score += 10;
  else score += 5;

  // Trend alignment
  if (ob.type === "bullish" && trend === "bullish") score += 15;
  else if (ob.type === "bearish" && trend === "bearish") score += 15;
  else if (trend === "sideways") score += 5;
  else score -= 10; // Counter-trend

  // Premium/Discount alignment
  if (ob.type === "bullish" && premiumDiscount === "discount") score += 10;
  else if (ob.type === "bearish" && premiumDiscount === "premium") score += 10;

  // RSI confirmation
  if (ob.type === "bullish" && rsi < 40) score += 10;
  else if (ob.type === "bearish" && rsi > 60) score += 10;

  // Price proximity
  const { inZone, nearZone, distancePercent } = checkPriceInOBZone(currentPrice, ob);
  if (inZone) score += 15;
  else if (nearZone) score += 10;
  else if (distancePercent < 2) score += 5;

  return Math.min(100, Math.max(0, score));
}

// ============================================
// MAIN STRATEGY FUNCTION
// ============================================

export async function generateOrderBlockSignal(
  symbol: string,
  interval: TimeInterval = "4h"
): Promise<OrderBlockSignal> {
  const spinner = ora(`Analyzing ${symbol} for Order Block setups...`).start();

  try {
    // Fetch data
    spinner.text = "Fetching market data...";
    const data = await fetchCryptoData(symbol, interval, 200);
    const candles = data.candles;
    const currentPrice = data.currentPrice;

    // Find Order Blocks
    spinner.text = "Identifying Order Blocks...";
    const allOBs = findOrderBlocks(candles, 100);
    const bullishOBs = allOBs.filter((ob) => ob.type === "bullish" && !ob.mitigated);
    const bearishOBs = allOBs.filter((ob) => ob.type === "bearish" && !ob.mitigated);

    // Find swing points for context
    const swingPoints = findSwingPoints(candles, 3);

    // Calculate indicators
    const closes = candles.map((c) => c.close);
    const rsi = calculateRSI(closes, 14);
    const trend = analyzeTrend(candles);
    const premiumDiscount = calculatePremiumDiscount(candles, 50);
    const atr = calculateATR(candles, 14);

    // Find nearest order blocks
    const nearestBullishOB = findNearestOrderBlock(allOBs, currentPrice, "bullish");
    const nearestBearishOB = findNearestOrderBlock(allOBs, currentPrice, "bearish");
    const nearestOB = findNearestOrderBlock(allOBs, currentPrice);

    // Determine signal
    let signal: "BUY" | "SELL" | "WAIT" = "WAIT";
    let activeOB: OrderBlockSignal["activeOB"] = null;
    let entry = {
      price: currentPrice,
      zone: { low: currentPrice, high: currentPrice },
      type: "Wait for OB",
    };
    let stopLoss = currentPrice;
    let tp1 = currentPrice,
      tp2 = currentPrice,
      tp3 = currentPrice;
    const reasoning: string[] = [];
    const warnings: string[] = [];
    let confidence = 0;

    // Check if price is at a bullish OB (BUY signal)
    if (nearestBullishOB) {
      const check = checkPriceInOBZone(currentPrice, nearestBullishOB);

      if (check.inZone || (check.nearZone && check.distancePercent < 1)) {
        signal = "BUY";
        confidence = calculateOBConfidence(
          nearestBullishOB,
          currentPrice,
          trend.direction,
          premiumDiscount.zone,
          rsi.current
        );

        activeOB = {
          type: "bullish",
          top: nearestBullishOB.top,
          bottom: nearestBullishOB.bottom,
          midpoint: (nearestBullishOB.top + nearestBullishOB.bottom) / 2,
          strength: nearestBullishOB.strength,
          distancePercent: check.distancePercent,
          priceInZone: check.inZone,
        };

        entry = {
          price: (nearestBullishOB.top + nearestBullishOB.bottom) / 2,
          zone: { low: nearestBullishOB.bottom, high: nearestBullishOB.top },
          type: "Bullish Order Block",
        };

        // Stop loss below OB
        stopLoss = nearestBullishOB.bottom * 0.995;

        // Take profits based on risk
        const risk = entry.price - stopLoss;
        tp1 = entry.price + risk * 1.5;
        tp2 = entry.price + risk * 2.5;
        tp3 = entry.price + risk * 4;

        reasoning.push(`Price at ${nearestBullishOB.strength} bullish Order Block`);
        reasoning.push(
          `OB Zone: $${nearestBullishOB.bottom.toFixed(2)} - $${nearestBullishOB.top.toFixed(2)}`
        );

        if (trend.direction === "bullish") {
          reasoning.push("Trend aligned with OB (bullish)");
        } else if (trend.direction === "bearish") {
          warnings.push("Counter-trend trade - higher risk");
        }

        if (premiumDiscount.zone === "discount") {
          reasoning.push("Price in discount zone - favorable for longs");
        }
      }
    }

    // Check if price is at a bearish OB (SELL signal)
    if (nearestBearishOB && signal === "WAIT") {
      const check = checkPriceInOBZone(currentPrice, nearestBearishOB);

      if (check.inZone || (check.nearZone && check.distancePercent < 1)) {
        signal = "SELL";
        confidence = calculateOBConfidence(
          nearestBearishOB,
          currentPrice,
          trend.direction,
          premiumDiscount.zone,
          rsi.current
        );

        activeOB = {
          type: "bearish",
          top: nearestBearishOB.top,
          bottom: nearestBearishOB.bottom,
          midpoint: (nearestBearishOB.top + nearestBearishOB.bottom) / 2,
          strength: nearestBearishOB.strength,
          distancePercent: check.distancePercent,
          priceInZone: check.inZone,
        };

        entry = {
          price: (nearestBearishOB.top + nearestBearishOB.bottom) / 2,
          zone: { low: nearestBearishOB.bottom, high: nearestBearishOB.top },
          type: "Bearish Order Block",
        };

        // Stop loss above OB
        stopLoss = nearestBearishOB.top * 1.005;

        // Take profits based on risk
        const risk = stopLoss - entry.price;
        tp1 = entry.price - risk * 1.5;
        tp2 = entry.price - risk * 2.5;
        tp3 = entry.price - risk * 4;

        reasoning.push(`Price at ${nearestBearishOB.strength} bearish Order Block`);
        reasoning.push(
          `OB Zone: $${nearestBearishOB.bottom.toFixed(2)} - $${nearestBearishOB.top.toFixed(2)}`
        );

        if (trend.direction === "bearish") {
          reasoning.push("Trend aligned with OB (bearish)");
        } else if (trend.direction === "bullish") {
          warnings.push("Counter-trend trade - higher risk");
        }

        if (premiumDiscount.zone === "premium") {
          reasoning.push("Price in premium zone - favorable for shorts");
        }
      }
    }

    // If no active signal, provide waiting guidance
    if (signal === "WAIT") {
      confidence = 30;

      if (nearestBullishOB) {
        const distBullish = checkPriceInOBZone(currentPrice, nearestBullishOB).distancePercent;
        reasoning.push(
          `Nearest bullish OB at $${nearestBullishOB.bottom.toFixed(2)} (${distBullish.toFixed(1)}% away)`
        );
      }

      if (nearestBearishOB) {
        const distBearish = checkPriceInOBZone(currentPrice, nearestBearishOB).distancePercent;
        reasoning.push(
          `Nearest bearish OB at $${nearestBearishOB.top.toFixed(2)} (${distBearish.toFixed(1)}% away)`
        );
      }

      if (bullishOBs.length === 0 && bearishOBs.length === 0) {
        reasoning.push("No valid Order Blocks found - wait for new OB formation");
      } else {
        reasoning.push("Wait for price to reach an Order Block zone");
      }
    }

    // Add general context
    reasoning.push(
      `RSI: ${rsi.current.toFixed(1)} (${rsi.current < 30 ? "oversold" : rsi.current > 70 ? "overbought" : "neutral"})`
    );
    reasoning.push(`Trend: ${trend.direction} | Premium/Discount: ${premiumDiscount.zone}`);

    // Calculate R:R
    const riskAmount = Math.abs(entry.price - stopLoss);
    const rewardAmount = Math.abs(tp2 - entry.price);
    const riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;

    // Add warnings
    if (atr.current / currentPrice > 0.03) {
      warnings.push("High volatility - consider smaller position size");
    }

    if (rsi.current > 75 && signal === "BUY") {
      warnings.push("RSI overbought - potential reversal risk");
    } else if (rsi.current < 25 && signal === "SELL") {
      warnings.push("RSI oversold - potential bounce risk");
    }

    spinner.succeed(`Order Block analysis complete for ${data.symbol}`);

    return {
      symbol: data.symbol,
      currentPrice,
      signal,
      confidence,
      activeOB,
      bullishOBs,
      bearishOBs,
      entry,
      stopLoss,
      takeProfit1: tp1,
      takeProfit2: tp2,
      takeProfit3: tp3,
      riskRewardRatio,
      trend: trend.direction,
      premiumDiscount: premiumDiscount.zone,
      reasoning,
      warnings,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    spinner.fail(`Failed to analyze ${symbol}`);
    throw error;
  }
}

// ============================================
// DISPLAY FUNCTION
// ============================================

function formatPrice(price: number): string {
  if (price < 0.001) return `$${price.toFixed(8)}`;
  if (price < 1) return `$${price.toFixed(6)}`;
  if (price < 100) return `$${price.toFixed(4)}`;
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getConfidenceBar(confidence: number, width: number = 20): string {
  const filled = Math.round((confidence / 100) * width);
  const empty = width - filled;

  let color = chalk.green;
  if (confidence < 40) color = chalk.red;
  else if (confidence < 60) color = chalk.yellow;

  return "[" + color("█".repeat(filled)) + chalk.gray("░".repeat(empty)) + "]";
}

export function displayOrderBlockSignal(result: OrderBlockSignal): void {
  console.log("");

  // Header
  const headerColor =
    result.signal === "BUY" ? chalk.green : result.signal === "SELL" ? chalk.red : chalk.yellow;
  const signalIcon = result.signal === "BUY" ? "🟢" : result.signal === "SELL" ? "🔴" : "⏳";

  console.log(
    headerColor("  ╔═══════════════════════════════════════════════════════════════════════╗")
  );
  console.log(
    headerColor(
      `  ║         ${signalIcon} ORDER BLOCK STRATEGY - ${result.symbol.padEnd(20)}       ║`
    )
  );
  console.log(
    headerColor("  ╚═══════════════════════════════════════════════════════════════════════╝")
  );
  console.log("");

  // Current Price
  console.log(
    `  ${chalk.cyan("Current Price:")} ${chalk.white.bold(formatPrice(result.currentPrice))}`
  );
  console.log("");

  // Signal Badge
  const signalBadge =
    result.signal === "BUY"
      ? chalk.bgGreen.white.bold(" BUY ")
      : result.signal === "SELL"
        ? chalk.bgRed.white.bold(" SELL ")
        : chalk.bgYellow.black.bold(" WAIT ");

  const confidenceBar = getConfidenceBar(result.confidence);

  console.log(`  ${signalBadge}  Confidence: ${confidenceBar} ${result.confidence}%`);
  console.log("");

  // Order Block Details
  console.log(
    chalk.cyan("  ┌─────────────────────────────────────────────────────────────────────┐")
  );
  console.log(
    chalk.cyan("  │                      📦 ORDER BLOCK ANALYSIS                        │")
  );
  console.log(
    chalk.cyan("  ├─────────────────────────────────────────────────────────────────────┤")
  );

  console.log(`  │  ${chalk.green("Bullish OBs:")} ${result.bullishOBs.length} unmitigated`);
  console.log(`  │  ${chalk.red("Bearish OBs:")} ${result.bearishOBs.length} unmitigated`);

  if (result.activeOB) {
    const obColor = result.activeOB.type === "bullish" ? chalk.green : chalk.red;
    console.log(`  │`);
    console.log(
      `  │  ${chalk.yellow("Active OB:")} ${obColor(result.activeOB.type.toUpperCase())} (${result.activeOB.strength})`
    );
    console.log(
      `  │  ${chalk.dim("Zone:")} ${formatPrice(result.activeOB.bottom)} - ${formatPrice(result.activeOB.top)}`
    );
    console.log(`  │  ${chalk.dim("Midpoint:")} ${formatPrice(result.activeOB.midpoint)}`);
    console.log(
      `  │  ${chalk.dim("Price in Zone:")} ${result.activeOB.priceInZone ? chalk.green("YES") : chalk.yellow("NEAR")}`
    );
  } else {
    console.log(`  │`);
    console.log(`  │  ${chalk.yellow("No active Order Block at current price")}`);
  }

  console.log(
    chalk.cyan("  └─────────────────────────────────────────────────────────────────────┘")
  );
  console.log("");

  // Trade Setup (if signal is BUY or SELL)
  if (result.signal !== "WAIT") {
    console.log(
      chalk.magenta("  ┌─────────────────────────────────────────────────────────────────────┐")
    );
    console.log(
      chalk.magenta("  │                      📍 TRADE SETUP                                 │")
    );
    console.log(
      chalk.magenta("  ├─────────────────────────────────────────────────────────────────────┤")
    );

    console.log(`  │  ${chalk.cyan("Entry Type:")} ${result.entry.type}`);
    console.log(
      `  │  ${chalk.yellow("Entry Zone:")} ${formatPrice(result.entry.zone.low)} - ${formatPrice(result.entry.zone.high)}`
    );
    console.log(
      `  │  ${chalk.yellow("Entry Price:")} ${chalk.white.bold(formatPrice(result.entry.price))}`
    );
    console.log(`  │`);
    console.log(
      `  │  ${chalk.red("Stop Loss:")} ${chalk.red.bold(formatPrice(result.stopLoss))} ${chalk.dim(`(${((Math.abs(result.entry.price - result.stopLoss) / result.entry.price) * 100).toFixed(2)}%)`)}`
    );
    console.log(`  │`);
    console.log(
      `  │  ${chalk.green("Take Profit 1:")} ${chalk.green(formatPrice(result.takeProfit1))} ${chalk.dim("(1.5R)")}`
    );
    console.log(
      `  │  ${chalk.green("Take Profit 2:")} ${chalk.green(formatPrice(result.takeProfit2))} ${chalk.dim("(2.5R)")}`
    );
    console.log(
      `  │  ${chalk.green("Take Profit 3:")} ${chalk.green(formatPrice(result.takeProfit3))} ${chalk.dim("(4R)")}`
    );
    console.log(`  │`);
    console.log(
      `  │  ${chalk.cyan("Risk/Reward:")} ${chalk.cyan.bold(result.riskRewardRatio.toFixed(1) + ":1")}`
    );

    console.log(
      chalk.magenta("  └─────────────────────────────────────────────────────────────────────┘")
    );
    console.log("");
  }

  // Visual Order Block Map
  console.log(
    chalk.blue("  ┌─────────────────────────────────────────────────────────────────────┐")
  );
  console.log(
    chalk.blue("  │                      📊 ORDER BLOCK MAP                             │")
  );
  console.log(
    chalk.blue("  ├─────────────────────────────────────────────────────────────────────┤")
  );

  // Show nearest OBs visually
  const allOBs = [...result.bullishOBs, ...result.bearishOBs].sort((a, b) => b.top - a.top);
  const visibleOBs = allOBs.slice(0, 6);

  if (visibleOBs.length > 0) {
    visibleOBs.forEach((ob) => {
      const obColor = ob.type === "bullish" ? chalk.green : chalk.red;
      const icon = ob.type === "bullish" ? "▲" : "▼";
      const isNear =
        result.currentPrice >= ob.bottom * 0.99 && result.currentPrice <= ob.top * 1.01;
      const marker = isNear ? chalk.yellow(" ← PRICE HERE") : "";

      console.log(
        `  │  ${obColor(icon)} ${ob.type.padEnd(8)} ${formatPrice(ob.bottom).padStart(12)} - ${formatPrice(ob.top).padEnd(12)} [${ob.strength}]${marker}`
      );
    });
  } else {
    console.log(`  │  ${chalk.gray("No unmitigated Order Blocks found")}`);
  }

  // Show current price line
  console.log(`  │`);
  console.log(
    `  │  ${chalk.white("→ Current:")} ${chalk.white.bold(formatPrice(result.currentPrice))}`
  );

  console.log(
    chalk.blue("  └─────────────────────────────────────────────────────────────────────┘")
  );
  console.log("");

  // Context
  console.log(
    chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐")
  );
  console.log(
    chalk.gray("  │                      🔍 CONTEXT & REASONING                         │")
  );
  console.log(
    chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤")
  );

  console.log(
    `  │  ${chalk.dim("Trend:")} ${result.trend === "bullish" ? chalk.green("▲ Bullish") : result.trend === "bearish" ? chalk.red("▼ Bearish") : chalk.yellow("● Sideways")}`
  );
  console.log(
    `  │  ${chalk.dim("Zone:")} ${result.premiumDiscount === "discount" ? chalk.green("Discount") : result.premiumDiscount === "premium" ? chalk.red("Premium") : chalk.yellow("Equilibrium")}`
  );
  console.log(`  │`);

  result.reasoning.forEach((r) => {
    console.log(`  │  ${chalk.cyan("•")} ${chalk.gray(r)}`);
  });

  console.log(
    chalk.gray("  └─────────────────────────────────────────────────────────────────────┘")
  );
  console.log("");

  // Warnings
  if (result.warnings.length > 0) {
    console.log(
      chalk.red("  ┌─────────────────────────────────────────────────────────────────────┐")
    );
    console.log(
      chalk.red("  │                      ⚠️  WARNINGS                                   │")
    );
    console.log(
      chalk.red("  ├─────────────────────────────────────────────────────────────────────┤")
    );

    result.warnings.forEach((w) => {
      console.log(`  │  ${chalk.yellow("!")} ${chalk.yellow(w)}`);
    });

    console.log(
      chalk.red("  └─────────────────────────────────────────────────────────────────────┘")
    );
    console.log("");
  }

  // How Order Blocks are Calculated (Educational)
  console.log(
    chalk.dim("  ┌─────────────────────────────────────────────────────────────────────┐")
  );
  console.log(
    chalk.dim("  │                      📚 HOW ORDER BLOCKS WORK                       │")
  );
  console.log(
    chalk.dim("  ├─────────────────────────────────────────────────────────────────────┤")
  );
  console.log(
    chalk.dim("  │  Bullish OB: Last bearish candle before strong bullish move        │")
  );
  console.log(
    chalk.dim("  │              → BUY when price returns to this zone                 │")
  );
  console.log(
    chalk.dim("  │  Bearish OB: Last bullish candle before strong bearish move        │")
  );
  console.log(
    chalk.dim("  │              → SELL when price returns to this zone                │")
  );
  console.log(
    chalk.dim('  │  Mitigated: OB is "used" when price fully trades through it        │')
  );
  console.log(
    chalk.dim("  └─────────────────────────────────────────────────────────────────────┘")
  );
  console.log("");

  // Disclaimer
  console.log(
    chalk.dim.italic("  ⚠️  This is not financial advice. Always manage your risk and DYOR.")
  );
  console.log("");
}

// ============================================
// RUNNER
// ============================================

export async function runOrderBlockStrategy(
  symbol: string,
  interval: TimeInterval = "4h"
): Promise<OrderBlockSignal | null> {
  try {
    const result = await generateOrderBlockSignal(symbol, interval);
    displayOrderBlockSignal(result);
    return result;
  } catch (error: any) {
    console.log("");
    console.log(
      chalk.red("  ╔═══════════════════════════════════════════════════════════════════════╗")
    );
    console.log(
      chalk.red("  ║                      ❌ ORDER BLOCK ERROR                              ║")
    );
    console.log(
      chalk.red("  ╚═══════════════════════════════════════════════════════════════════════╝")
    );
    console.log("");
    console.log(chalk.yellow(`  ⚠️  ${error.message || "An unexpected error occurred"}`));
    console.log("");
    return null;
  }
}
