/**
 * ASCII Chart Visualization for Trading Analysis
 * Creates visual price charts with indicators
 */

import chalk from "chalk";
import { OHLCV } from "./data-fetcher";
import { SMCAnalysis, OrderBlock, FairValueGap, LiquidityZone } from "./smc-indicators";

// ============================================
// TYPES
// ============================================

interface ChartLevel {
  price: number;
  type:
    | "current"
    | "support"
    | "resistance"
    | "ob_top"
    | "ob_bottom"
    | "fvg"
    | "liquidity"
    | "entry"
    | "stop"
    | "target"
    | "ema";
  label: string;
  color: (s: string) => string;
}

interface PriceBar {
  open: number;
  high: number;
  low: number;
  close: number;
  type: "bullish" | "bearish";
}

// ============================================
// MINI CANDLESTICK CHART
// ============================================

/**
 * Create ASCII candlestick chart
 */
export function createCandlestickChart(
  candles: OHLCV[],
  width: number = 50,
  height: number = 15
): string[] {
  const recentCandles = candles.slice(-width);

  // Find price range
  const allPrices = recentCandles.flatMap((c) => [c.high, c.low]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice;

  // Create chart grid
  const chart: string[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill(" "));

  // Plot candles
  recentCandles.forEach((candle, i) => {
    const isBullish = candle.close >= candle.open;

    // Calculate positions
    const highY = Math.floor((1 - (candle.high - minPrice) / priceRange) * (height - 1));
    const lowY = Math.floor((1 - (candle.low - minPrice) / priceRange) * (height - 1));
    const openY = Math.floor((1 - (candle.open - minPrice) / priceRange) * (height - 1));
    const closeY = Math.floor((1 - (candle.close - minPrice) / priceRange) * (height - 1));

    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);

    // Draw wick
    for (let y = highY; y <= lowY; y++) {
      if (y >= 0 && y < height) {
        if (y < bodyTop || y > bodyBottom) {
          chart[y][i] = "│";
        }
      }
    }

    // Draw body
    for (let y = bodyTop; y <= bodyBottom; y++) {
      if (y >= 0 && y < height) {
        chart[y][i] = isBullish ? "█" : "░";
      }
    }
  });

  // Convert to strings with colors
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const char = chart[y][x];
      if (char === "█") {
        line += chalk.green(char);
      } else if (char === "░") {
        line += chalk.red(char);
      } else if (char === "│") {
        line += chalk.gray(char);
      } else {
        line += chalk.gray("·");
      }
    }
    lines.push(line);
  }

  return lines;
}

// ============================================
// PRICE LEVEL CHART
// ============================================

/**
 * Create visual price level chart with SMC zones
 */
export function createPriceLevelChart(
  currentPrice: number,
  levels: ChartLevel[],
  height: number = 20
): string[] {
  // Sort levels by price (high to low)
  const sortedLevels = [...levels].sort((a, b) => b.price - a.price);

  // Get price range
  const prices = levels.map((l) => l.price);
  const minPrice = Math.min(...prices, currentPrice) * 0.995;
  const maxPrice = Math.max(...prices, currentPrice) * 1.005;
  const priceRange = maxPrice - minPrice;

  // Create chart lines
  const lines: string[] = [];
  const chartWidth = 55;

  // Header
  lines.push(chalk.gray("┌" + "─".repeat(chartWidth) + "┐"));
  lines.push(
    chalk.gray("│") +
      chalk.bold.white(" PRICE LEVELS & SMC ZONES".padEnd(chartWidth)) +
      chalk.gray("│")
  );
  lines.push(chalk.gray("├" + "─".repeat(chartWidth) + "┤"));

  // Calculate Y positions for each level
  const levelPositions: { level: ChartLevel; y: number }[] = sortedLevels.map((level) => ({
    level,
    y: Math.floor((1 - (level.price - minPrice) / priceRange) * (height - 1)),
  }));

  // Current price Y position
  const currentY = Math.floor((1 - (currentPrice - minPrice) / priceRange) * (height - 1));

  // Draw chart
  for (let y = 0; y < height; y++) {
    let lineContent = "";

    // Price scale on left
    const priceAtY = maxPrice - (y / (height - 1)) * priceRange;
    const priceLabel = formatShortPrice(priceAtY).padStart(10);

    // Check if current price is at this level
    const isCurrentPrice = y === currentY;

    // Find levels at this Y position
    const levelsAtY = levelPositions.filter((lp) => lp.y === y);

    // Build the visual line
    let visual = "";
    let labelText = "";

    if (isCurrentPrice) {
      visual = chalk.yellow("━━━━━━━━━━━━━━━━") + chalk.bold.yellow(" ◄ CURRENT");
      labelText = ` $${formatShortPrice(currentPrice)}`;
    } else if (levelsAtY.length > 0) {
      const mainLevel = levelsAtY[0].level;

      switch (mainLevel.type) {
        case "ob_top":
        case "ob_bottom":
          visual = mainLevel.color("████████████████") + " " + mainLevel.label;
          break;
        case "fvg":
          visual = mainLevel.color("░░░░░░░░░░░░░░░░") + " " + mainLevel.label;
          break;
        case "liquidity":
          visual = mainLevel.color("◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆") + " " + mainLevel.label;
          break;
        case "entry":
          visual = chalk.cyan("────────────────") + chalk.cyan(" ► ENTRY");
          break;
        case "stop":
          visual = chalk.red("────────────────") + chalk.red(" ✖ STOP");
          break;
        case "target":
          visual = chalk.green("────────────────") + chalk.green(" ★ TARGET");
          break;
        case "support":
          visual = chalk.green("════════════════") + chalk.green(" SUPPORT");
          break;
        case "resistance":
          visual = chalk.red("════════════════") + chalk.red(" RESISTANCE");
          break;
        default:
          visual = chalk.gray("----------------") + " " + mainLevel.label;
      }
    } else {
      visual = chalk.gray("                ") + "  ";
    }

    lineContent = chalk.gray(priceLabel) + " │ " + visual;
    lines.push(chalk.gray("│") + lineContent.padEnd(chartWidth + 20) + chalk.gray("│"));
  }

  lines.push(chalk.gray("└" + "─".repeat(chartWidth) + "┘"));

  return lines;
}

// ============================================
// SMC VISUAL CHART
// ============================================

/**
 * Create comprehensive SMC visual chart
 */
export function createSMCVisualChart(
  currentPrice: number,
  smc: SMCAnalysis,
  tradeSetup?: {
    entry: { zone: { low: number; high: number } };
    stopLoss: number;
    targets: number[];
  }
): string[] {
  const levels: ChartLevel[] = [];

  // Add order blocks
  smc.orderBlocks.bullish.slice(0, 2).forEach((ob, i) => {
    levels.push({
      price: ob.top,
      type: "ob_top",
      label: `Bullish OB Top`,
      color: chalk.green,
    });
    levels.push({
      price: ob.bottom,
      type: "ob_bottom",
      label: `Bullish OB Bottom`,
      color: chalk.green,
    });
  });

  smc.orderBlocks.bearish.slice(0, 2).forEach((ob, i) => {
    levels.push({
      price: ob.top,
      type: "ob_top",
      label: `Bearish OB Top`,
      color: chalk.red,
    });
    levels.push({
      price: ob.bottom,
      type: "ob_bottom",
      label: `Bearish OB Bottom`,
      color: chalk.red,
    });
  });

  // Add FVGs
  smc.fairValueGaps.unfilled.slice(0, 2).forEach((fvg, i) => {
    levels.push({
      price: (fvg.top + fvg.bottom) / 2,
      type: "fvg",
      label: `${fvg.type} FVG`,
      color: fvg.type === "bullish" ? chalk.greenBright : chalk.redBright,
    });
  });

  // Add liquidity zones
  smc.liquidity.buySide.slice(0, 2).forEach((liq, i) => {
    levels.push({
      price: liq.level,
      type: "liquidity",
      label: `Buy-side Liq (${liq.strength}x)`,
      color: chalk.cyan,
    });
  });

  smc.liquidity.sellSide.slice(0, 2).forEach((liq, i) => {
    levels.push({
      price: liq.level,
      type: "liquidity",
      label: `Sell-side Liq (${liq.strength}x)`,
      color: chalk.magenta,
    });
  });

  // Add trade setup levels
  if (tradeSetup) {
    levels.push({
      price: (tradeSetup.entry.zone.low + tradeSetup.entry.zone.high) / 2,
      type: "entry",
      label: "Entry Zone",
      color: chalk.cyan,
    });

    levels.push({
      price: tradeSetup.stopLoss,
      type: "stop",
      label: "Stop Loss",
      color: chalk.red,
    });

    tradeSetup.targets.slice(0, 2).forEach((target, i) => {
      levels.push({
        price: target,
        type: "target",
        label: `Target ${i + 1}`,
        color: chalk.green,
      });
    });
  }

  // Add premium/discount zones
  levels.push({
    price: smc.premiumDiscount.rangeHigh,
    type: "resistance",
    label: "Range High (Premium)",
    color: chalk.red,
  });

  levels.push({
    price: smc.premiumDiscount.equilibrium,
    type: "ema",
    label: "Equilibrium",
    color: chalk.yellow,
  });

  levels.push({
    price: smc.premiumDiscount.rangeLow,
    type: "support",
    label: "Range Low (Discount)",
    color: chalk.green,
  });

  return createPriceLevelChart(currentPrice, levels, 18);
}

// ============================================
// TRADE SETUP VISUAL
// ============================================

/**
 * Create visual trade setup diagram
 */
export function createTradeSetupVisual(
  currentPrice: number,
  entry: number,
  stopLoss: number,
  targets: number[],
  bias: "long" | "short" | "neutral"
): string[] {
  const lines: string[] = [];
  const width = 50;

  // Calculate percentages
  const entryPct = (((entry - currentPrice) / currentPrice) * 100).toFixed(1);
  const slPct = (((stopLoss - entry) / entry) * 100).toFixed(1);
  const riskAmt = Math.abs(entry - stopLoss);

  lines.push("");
  lines.push(chalk.bold.white("  ┌─────────────────────────────────────────────┐"));
  lines.push(
    chalk.bold.white("  │") +
      chalk.bold.cyan("         TRADE SETUP VISUALIZATION          ") +
      chalk.bold.white("│")
  );
  lines.push(chalk.bold.white("  └─────────────────────────────────────────────┘"));
  lines.push("");

  if (bias === "long") {
    // Long trade visualization
    targets
      .slice(0, 3)
      .reverse()
      .forEach((t, i) => {
        const pct = (((t - entry) / entry) * 100).toFixed(1);
        const rr = (Math.abs(t - entry) / riskAmt).toFixed(1);
        lines.push(
          chalk.green(
            `     ★ T${targets.length - i}: ${formatShortPrice(t)} (+${pct}%) R:R ${rr}:1`
          )
        );
        lines.push(chalk.green("     │"));
      });

    lines.push(chalk.yellow(`     ◄━━ CURRENT: ${formatShortPrice(currentPrice)}`));
    lines.push(chalk.gray("     │"));
    lines.push(chalk.cyan(`     ► ENTRY: ${formatShortPrice(entry)} (${entryPct}%)`));
    lines.push(chalk.gray("     │"));
    lines.push(chalk.red(`     ✖ STOP: ${formatShortPrice(stopLoss)} (${slPct}%)`));
  } else if (bias === "short") {
    // Short trade visualization
    lines.push(
      chalk.red(`     ✖ STOP: ${formatShortPrice(stopLoss)} (+${Math.abs(parseFloat(slPct))}%)`)
    );
    lines.push(chalk.gray("     │"));
    lines.push(chalk.cyan(`     ► ENTRY: ${formatShortPrice(entry)}`));
    lines.push(chalk.gray("     │"));
    lines.push(chalk.yellow(`     ◄━━ CURRENT: ${formatShortPrice(currentPrice)}`));
    lines.push(chalk.gray("     │"));

    targets.slice(0, 3).forEach((t, i) => {
      const pct = (((entry - t) / entry) * 100).toFixed(1);
      const rr = (Math.abs(entry - t) / riskAmt).toFixed(1);
      lines.push(chalk.green("     │"));
      lines.push(chalk.green(`     ★ T${i + 1}: ${formatShortPrice(t)} (+${pct}%) R:R ${rr}:1`));
    });
  } else {
    lines.push(chalk.yellow("     ⚠ NO CLEAR TRADE SETUP"));
    lines.push(chalk.gray("     Wait for better opportunity"));
  }

  lines.push("");

  return lines;
}

// ============================================
// MARKET STRUCTURE VISUAL
// ============================================

/**
 * Create market structure visualization
 */
export function createMarketStructureVisual(smc: SMCAnalysis): string[] {
  const lines: string[] = [];
  const { marketStructure, bias } = smc;

  lines.push("");
  lines.push(chalk.bold.white("  ┌─────────────────────────────────────────────┐"));
  lines.push(
    chalk.bold.white("  │") +
      chalk.bold.magenta("          MARKET STRUCTURE FLOW             ") +
      chalk.bold.white("│")
  );
  lines.push(chalk.bold.white("  └─────────────────────────────────────────────┘"));
  lines.push("");

  // Draw structure flow
  const trend = marketStructure.trend;
  const trendColor =
    trend === "bullish" ? chalk.green : trend === "bearish" ? chalk.red : chalk.yellow;

  if (trend === "bullish") {
    lines.push(trendColor("                    ╱╲"));
    lines.push(trendColor("               HH ╱    ╲"));
    lines.push(trendColor("                ╱        ╲"));
    lines.push(trendColor("           ╱╲ ╱          ╲"));
    lines.push(trendColor("      HH ╱    ╲ HL         ╲"));
    lines.push(trendColor("       ╱        ╲           ╲"));
    lines.push(trendColor("  ╱╲ ╱          ╲"));
    lines.push(trendColor(" ╱  ╲ HL         ╲"));
    lines.push(chalk.gray("  ─────────────────────────────────────────────"));
    lines.push(chalk.green("  BULLISH: Higher Highs (HH) & Higher Lows (HL)"));
  } else if (trend === "bearish") {
    lines.push(trendColor("  ╲"));
    lines.push(trendColor("   ╲ LH          ╱╲"));
    lines.push(trendColor("    ╲           ╱    ╲"));
    lines.push(trendColor("     ╲         ╱        ╲"));
    lines.push(trendColor("      ╲ ╱╲    ╱ LH        ╲"));
    lines.push(trendColor("       ╱    ╲╱              ╲"));
    lines.push(trendColor("      ╱ LL   ╲               ╲"));
    lines.push(trendColor("                              ╲ LL"));
    lines.push(chalk.gray("  ─────────────────────────────────────────────"));
    lines.push(chalk.red("  BEARISH: Lower Highs (LH) & Lower Lows (LL)"));
  } else {
    lines.push(trendColor("       ╱╲           ╱╲"));
    lines.push(trendColor("      ╱    ╲       ╱    ╲"));
    lines.push(trendColor("     ╱        ╲   ╱        ╲"));
    lines.push(trendColor("  ──╱──────────╲─╱──────────╲────"));
    lines.push(trendColor("                ╲              "));
    lines.push(chalk.gray("  ─────────────────────────────────────────────"));
    lines.push(chalk.yellow("  RANGING: No clear trend direction"));
  }

  lines.push("");

  // Show BOS/CHoCH
  if (marketStructure.lastBOS) {
    const bosColor = marketStructure.lastBOS.direction === "bullish" ? chalk.green : chalk.red;
    lines.push(
      bosColor(
        `  BOS (Break of Structure): ${marketStructure.lastBOS.direction} @ $${marketStructure.lastBOS.level.toFixed(2)}`
      )
    );
  }
  if (marketStructure.lastCHoCH) {
    const chochColor = marketStructure.lastCHoCH.direction === "bullish" ? chalk.green : chalk.red;
    lines.push(
      chochColor(
        `  CHoCH (Change of Character): ${marketStructure.lastCHoCH.direction} @ $${marketStructure.lastCHoCH.level.toFixed(2)}`
      )
    );
  }

  lines.push("");

  return lines;
}

// ============================================
// ORDER BLOCK VISUAL
// ============================================

/**
 * Create order block visualization
 */
export function createOrderBlockVisual(
  orderBlocks: { bullish: OrderBlock[]; bearish: OrderBlock[] },
  currentPrice: number
): string[] {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold.white("  ┌─────────────────────────────────────────────┐"));
  lines.push(
    chalk.bold.white("  │") +
      chalk.bold.blue("             ORDER BLOCKS (OB)              ") +
      chalk.bold.white("│")
  );
  lines.push(chalk.bold.white("  └─────────────────────────────────────────────┘"));
  lines.push("");

  // Bullish OBs
  if (orderBlocks.bullish.length > 0) {
    lines.push(chalk.green.bold("  🟢 BULLISH ORDER BLOCKS (Demand Zones)"));
    orderBlocks.bullish.slice(0, 3).forEach((ob, i) => {
      const dist = (((currentPrice - ob.top) / currentPrice) * 100).toFixed(1);
      const status = ob.mitigated ? chalk.gray("[MITIGATED]") : chalk.green("[ACTIVE]");
      lines.push(chalk.green(`     ┌────────────────────┐ $${ob.top.toFixed(2)}`));
      lines.push(chalk.green(`     │ ▓▓▓▓ OB ${i + 1} ▓▓▓▓ │ ${status}`));
      lines.push(
        chalk.green(`     └────────────────────┘ $${ob.bottom.toFixed(2)} (${dist}% away)`)
      );
    });
  } else {
    lines.push(chalk.gray("  No active bullish order blocks"));
  }

  lines.push("");

  // Bearish OBs
  if (orderBlocks.bearish.length > 0) {
    lines.push(chalk.red.bold("  🔴 BEARISH ORDER BLOCKS (Supply Zones)"));
    orderBlocks.bearish.slice(0, 3).forEach((ob, i) => {
      const dist = (((ob.bottom - currentPrice) / currentPrice) * 100).toFixed(1);
      const status = ob.mitigated ? chalk.gray("[MITIGATED]") : chalk.red("[ACTIVE]");
      lines.push(chalk.red(`     ┌────────────────────┐ $${ob.top.toFixed(2)}`));
      lines.push(chalk.red(`     │ ░░░░ OB ${i + 1} ░░░░ │ ${status}`));
      lines.push(chalk.red(`     └────────────────────┘ $${ob.bottom.toFixed(2)} (${dist}% away)`));
    });
  } else {
    lines.push(chalk.gray("  No active bearish order blocks"));
  }

  lines.push("");

  return lines;
}

// ============================================
// FVG VISUAL
// ============================================

/**
 * Create FVG visualization
 */
export function createFVGVisual(
  fvgs: { bullish: FairValueGap[]; bearish: FairValueGap[]; unfilled: FairValueGap[] },
  currentPrice: number
): string[] {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold.white("  ┌─────────────────────────────────────────────┐"));
  lines.push(
    chalk.bold.white("  │") +
      chalk.bold.yellow("          FAIR VALUE GAPS (FVG)             ") +
      chalk.bold.white("│")
  );
  lines.push(chalk.bold.white("  └─────────────────────────────────────────────┘"));
  lines.push("");

  const unfilled = fvgs.unfilled.slice(0, 4);

  if (unfilled.length > 0) {
    lines.push(chalk.yellow("  ⚡ UNFILLED GAPS (Price magnets)"));
    lines.push("");

    unfilled.forEach((fvg, i) => {
      const gapSize = (((fvg.top - fvg.bottom) / fvg.bottom) * 100).toFixed(2);
      const dist =
        fvg.type === "bullish"
          ? (((fvg.bottom - currentPrice) / currentPrice) * 100).toFixed(1)
          : (((currentPrice - fvg.top) / currentPrice) * 100).toFixed(1);
      const color = fvg.type === "bullish" ? chalk.green : chalk.red;
      const arrow = fvg.type === "bullish" ? "↑" : "↓";

      lines.push(color(`     ${arrow} ${fvg.type.toUpperCase()} FVG`));
      lines.push(color(`     ┌ · · · · · · · · · ┐ $${fvg.top.toFixed(2)}`));
      lines.push(color(`     │   GAP: ${gapSize}%   │`));
      lines.push(color(`     └ · · · · · · · · · ┘ $${fvg.bottom.toFixed(2)}`));
      lines.push(
        chalk.gray(
          `       ${Math.abs(parseFloat(dist))}% ${parseFloat(dist) > 0 ? "above" : "below"} current price`
        )
      );
      lines.push("");
    });
  } else {
    lines.push(chalk.gray("  No unfilled fair value gaps"));
  }

  lines.push("");

  return lines;
}

// ============================================
// LIQUIDITY VISUAL
// ============================================

/**
 * Create liquidity zones visualization
 */
export function createLiquidityVisual(
  liquidity: { buySide: LiquidityZone[]; sellSide: LiquidityZone[] },
  currentPrice: number
): string[] {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold.white("  ┌─────────────────────────────────────────────┐"));
  lines.push(
    chalk.bold.white("  │") +
      chalk.bold.cyan("           LIQUIDITY POOLS                  ") +
      chalk.bold.white("│")
  );
  lines.push(chalk.bold.white("  └─────────────────────────────────────────────┘"));
  lines.push("");

  // Buy-side liquidity (above price - stops from shorts)
  lines.push(chalk.cyan.bold("  📈 BUY-SIDE LIQUIDITY (Stops above highs)"));
  if (liquidity.buySide.length > 0) {
    liquidity.buySide.slice(0, 3).forEach((liq, i) => {
      const dist = (((liq.level - currentPrice) / currentPrice) * 100).toFixed(1);
      const strength = "◆".repeat(Math.min(liq.strength, 5));
      lines.push(
        chalk.cyan(`     $${liq.level.toFixed(2)} ${strength} (${liq.strength} touches) +${dist}%`)
      );
    });
  } else {
    lines.push(chalk.gray("     No buy-side liquidity detected"));
  }

  lines.push("");
  lines.push(chalk.yellow(`  ━━━━━ CURRENT PRICE: $${currentPrice.toFixed(2)} ━━━━━`));
  lines.push("");

  // Sell-side liquidity (below price - stops from longs)
  lines.push(chalk.magenta.bold("  📉 SELL-SIDE LIQUIDITY (Stops below lows)"));
  if (liquidity.sellSide.length > 0) {
    liquidity.sellSide.slice(0, 3).forEach((liq, i) => {
      const dist = (((currentPrice - liq.level) / currentPrice) * 100).toFixed(1);
      const strength = "◇".repeat(Math.min(liq.strength, 5));
      lines.push(
        chalk.magenta(
          `     $${liq.level.toFixed(2)} ${strength} (${liq.strength} touches) -${dist}%`
        )
      );
    });
  } else {
    lines.push(chalk.gray("     No sell-side liquidity detected"));
  }

  lines.push("");

  return lines;
}

// ============================================
// HELPERS
// ============================================

function formatShortPrice(price: number): string {
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  if (price < 10000) return price.toFixed(2);
  return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
