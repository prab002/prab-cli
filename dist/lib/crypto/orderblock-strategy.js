"use strict";
/**
 * Order Block Trading Strategy
 * Focused analysis for order block-based trading signals
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOrderBlockSignal = generateOrderBlockSignal;
exports.displayOrderBlockSignal = displayOrderBlockSignal;
exports.runOrderBlockStrategy = runOrderBlockStrategy;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const data_fetcher_1 = require("./data-fetcher");
const smc_indicators_1 = require("./smc-indicators");
const indicators_1 = require("./indicators");
// ============================================
// ORDER BLOCK ANALYSIS
// ============================================
/**
 * Find the nearest unmitigated order block to current price
 */
function findNearestOrderBlock(orderBlocks, currentPrice, direction) {
    const filtered = direction
        ? orderBlocks.filter((ob) => ob.type === direction && !ob.mitigated)
        : orderBlocks.filter((ob) => !ob.mitigated);
    if (filtered.length === 0)
        return null;
    return filtered.sort((a, b) => {
        const distA = Math.min(Math.abs(currentPrice - a.top), Math.abs(currentPrice - a.bottom));
        const distB = Math.min(Math.abs(currentPrice - b.top), Math.abs(currentPrice - b.bottom));
        return distA - distB;
    })[0];
}
/**
 * Check if price is in or near an order block zone
 */
function checkPriceInOBZone(price, ob, tolerance = 0.005 // 0.5%
) {
    const toleranceAmount = (ob.top - ob.bottom) * tolerance;
    const expandedTop = ob.top + toleranceAmount;
    const expandedBottom = ob.bottom - toleranceAmount;
    const inZone = price >= ob.bottom && price <= ob.top;
    const nearZone = price >= expandedBottom && price <= expandedTop;
    let distancePercent;
    if (inZone) {
        distancePercent = 0;
    }
    else if (price > ob.top) {
        distancePercent = ((price - ob.top) / price) * 100;
    }
    else {
        distancePercent = ((ob.bottom - price) / price) * 100;
    }
    return { inZone, nearZone, distancePercent };
}
/**
 * Calculate confidence score for order block trade
 */
function calculateOBConfidence(ob, currentPrice, trend, premiumDiscount, rsi) {
    let score = 50;
    // Order block strength
    if (ob.strength === "strong")
        score += 15;
    else if (ob.strength === "moderate")
        score += 10;
    else
        score += 5;
    // Trend alignment
    if (ob.type === "bullish" && trend === "bullish")
        score += 15;
    else if (ob.type === "bearish" && trend === "bearish")
        score += 15;
    else if (trend === "sideways")
        score += 5;
    else
        score -= 10; // Counter-trend
    // Premium/Discount alignment
    if (ob.type === "bullish" && premiumDiscount === "discount")
        score += 10;
    else if (ob.type === "bearish" && premiumDiscount === "premium")
        score += 10;
    // RSI confirmation
    if (ob.type === "bullish" && rsi < 40)
        score += 10;
    else if (ob.type === "bearish" && rsi > 60)
        score += 10;
    // Price proximity
    const { inZone, nearZone, distancePercent } = checkPriceInOBZone(currentPrice, ob);
    if (inZone)
        score += 15;
    else if (nearZone)
        score += 10;
    else if (distancePercent < 2)
        score += 5;
    return Math.min(100, Math.max(0, score));
}
// ============================================
// MAIN STRATEGY FUNCTION
// ============================================
async function generateOrderBlockSignal(symbol, interval = "4h") {
    const spinner = (0, ora_1.default)(`Analyzing ${symbol} for Order Block setups...`).start();
    try {
        // Fetch data
        spinner.text = "Fetching market data...";
        const data = await (0, data_fetcher_1.fetchCryptoData)(symbol, interval, 200);
        const candles = data.candles;
        const currentPrice = data.currentPrice;
        // Find Order Blocks
        spinner.text = "Identifying Order Blocks...";
        const allOBs = (0, smc_indicators_1.findOrderBlocks)(candles, 100);
        const bullishOBs = allOBs.filter((ob) => ob.type === "bullish" && !ob.mitigated);
        const bearishOBs = allOBs.filter((ob) => ob.type === "bearish" && !ob.mitigated);
        // Find swing points for context
        const swingPoints = (0, smc_indicators_1.findSwingPoints)(candles, 3);
        // Calculate indicators
        const closes = candles.map((c) => c.close);
        const rsi = (0, indicators_1.calculateRSI)(closes, 14);
        const trend = (0, indicators_1.analyzeTrend)(candles);
        const premiumDiscount = (0, smc_indicators_1.calculatePremiumDiscount)(candles, 50);
        const atr = (0, indicators_1.calculateATR)(candles, 14);
        // Find nearest order blocks
        const nearestBullishOB = findNearestOrderBlock(allOBs, currentPrice, "bullish");
        const nearestBearishOB = findNearestOrderBlock(allOBs, currentPrice, "bearish");
        const nearestOB = findNearestOrderBlock(allOBs, currentPrice);
        // Determine signal
        let signal = "WAIT";
        let activeOB = null;
        let entry = {
            price: currentPrice,
            zone: { low: currentPrice, high: currentPrice },
            type: "Wait for OB",
        };
        let stopLoss = currentPrice;
        let tp1 = currentPrice, tp2 = currentPrice, tp3 = currentPrice;
        const reasoning = [];
        const warnings = [];
        let confidence = 0;
        // Check if price is at a bullish OB (BUY signal)
        if (nearestBullishOB) {
            const check = checkPriceInOBZone(currentPrice, nearestBullishOB);
            if (check.inZone || (check.nearZone && check.distancePercent < 1)) {
                signal = "BUY";
                confidence = calculateOBConfidence(nearestBullishOB, currentPrice, trend.direction, premiumDiscount.zone, rsi.current);
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
                reasoning.push(`OB Zone: $${nearestBullishOB.bottom.toFixed(2)} - $${nearestBullishOB.top.toFixed(2)}`);
                if (trend.direction === "bullish") {
                    reasoning.push("Trend aligned with OB (bullish)");
                }
                else if (trend.direction === "bearish") {
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
                confidence = calculateOBConfidence(nearestBearishOB, currentPrice, trend.direction, premiumDiscount.zone, rsi.current);
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
                reasoning.push(`OB Zone: $${nearestBearishOB.bottom.toFixed(2)} - $${nearestBearishOB.top.toFixed(2)}`);
                if (trend.direction === "bearish") {
                    reasoning.push("Trend aligned with OB (bearish)");
                }
                else if (trend.direction === "bullish") {
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
                reasoning.push(`Nearest bullish OB at $${nearestBullishOB.bottom.toFixed(2)} (${distBullish.toFixed(1)}% away)`);
            }
            if (nearestBearishOB) {
                const distBearish = checkPriceInOBZone(currentPrice, nearestBearishOB).distancePercent;
                reasoning.push(`Nearest bearish OB at $${nearestBearishOB.top.toFixed(2)} (${distBearish.toFixed(1)}% away)`);
            }
            if (bullishOBs.length === 0 && bearishOBs.length === 0) {
                reasoning.push("No valid Order Blocks found - wait for new OB formation");
            }
            else {
                reasoning.push("Wait for price to reach an Order Block zone");
            }
        }
        // Add general context
        reasoning.push(`RSI: ${rsi.current.toFixed(1)} (${rsi.current < 30 ? "oversold" : rsi.current > 70 ? "overbought" : "neutral"})`);
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
        }
        else if (rsi.current < 25 && signal === "SELL") {
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
    }
    catch (error) {
        spinner.fail(`Failed to analyze ${symbol}`);
        throw error;
    }
}
// ============================================
// DISPLAY FUNCTION
// ============================================
function formatPrice(price) {
    if (price < 0.001)
        return `$${price.toFixed(8)}`;
    if (price < 1)
        return `$${price.toFixed(6)}`;
    if (price < 100)
        return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function getConfidenceBar(confidence, width = 20) {
    const filled = Math.round((confidence / 100) * width);
    const empty = width - filled;
    let color = chalk_1.default.green;
    if (confidence < 40)
        color = chalk_1.default.red;
    else if (confidence < 60)
        color = chalk_1.default.yellow;
    return "[" + color("█".repeat(filled)) + chalk_1.default.gray("░".repeat(empty)) + "]";
}
function displayOrderBlockSignal(result) {
    console.log("");
    // Header
    const headerColor = result.signal === "BUY" ? chalk_1.default.green : result.signal === "SELL" ? chalk_1.default.red : chalk_1.default.yellow;
    const signalIcon = result.signal === "BUY" ? "🟢" : result.signal === "SELL" ? "🔴" : "⏳";
    console.log(headerColor("  ╔═══════════════════════════════════════════════════════════════════════╗"));
    console.log(headerColor(`  ║         ${signalIcon} ORDER BLOCK STRATEGY - ${result.symbol.padEnd(20)}       ║`));
    console.log(headerColor("  ╚═══════════════════════════════════════════════════════════════════════╝"));
    console.log("");
    // Current Price
    console.log(`  ${chalk_1.default.cyan("Current Price:")} ${chalk_1.default.white.bold(formatPrice(result.currentPrice))}`);
    console.log("");
    // Signal Badge
    const signalBadge = result.signal === "BUY"
        ? chalk_1.default.bgGreen.white.bold(" BUY ")
        : result.signal === "SELL"
            ? chalk_1.default.bgRed.white.bold(" SELL ")
            : chalk_1.default.bgYellow.black.bold(" WAIT ");
    const confidenceBar = getConfidenceBar(result.confidence);
    console.log(`  ${signalBadge}  Confidence: ${confidenceBar} ${result.confidence}%`);
    console.log("");
    // Order Block Details
    console.log(chalk_1.default.cyan("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.cyan("  │                      📦 ORDER BLOCK ANALYSIS                        │"));
    console.log(chalk_1.default.cyan("  ├─────────────────────────────────────────────────────────────────────┤"));
    console.log(`  │  ${chalk_1.default.green("Bullish OBs:")} ${result.bullishOBs.length} unmitigated`);
    console.log(`  │  ${chalk_1.default.red("Bearish OBs:")} ${result.bearishOBs.length} unmitigated`);
    if (result.activeOB) {
        const obColor = result.activeOB.type === "bullish" ? chalk_1.default.green : chalk_1.default.red;
        console.log(`  │`);
        console.log(`  │  ${chalk_1.default.yellow("Active OB:")} ${obColor(result.activeOB.type.toUpperCase())} (${result.activeOB.strength})`);
        console.log(`  │  ${chalk_1.default.dim("Zone:")} ${formatPrice(result.activeOB.bottom)} - ${formatPrice(result.activeOB.top)}`);
        console.log(`  │  ${chalk_1.default.dim("Midpoint:")} ${formatPrice(result.activeOB.midpoint)}`);
        console.log(`  │  ${chalk_1.default.dim("Price in Zone:")} ${result.activeOB.priceInZone ? chalk_1.default.green("YES") : chalk_1.default.yellow("NEAR")}`);
    }
    else {
        console.log(`  │`);
        console.log(`  │  ${chalk_1.default.yellow("No active Order Block at current price")}`);
    }
    console.log(chalk_1.default.cyan("  └─────────────────────────────────────────────────────────────────────┘"));
    console.log("");
    // Trade Setup (if signal is BUY or SELL)
    if (result.signal !== "WAIT") {
        console.log(chalk_1.default.magenta("  ┌─────────────────────────────────────────────────────────────────────┐"));
        console.log(chalk_1.default.magenta("  │                      📍 TRADE SETUP                                 │"));
        console.log(chalk_1.default.magenta("  ├─────────────────────────────────────────────────────────────────────┤"));
        console.log(`  │  ${chalk_1.default.cyan("Entry Type:")} ${result.entry.type}`);
        console.log(`  │  ${chalk_1.default.yellow("Entry Zone:")} ${formatPrice(result.entry.zone.low)} - ${formatPrice(result.entry.zone.high)}`);
        console.log(`  │  ${chalk_1.default.yellow("Entry Price:")} ${chalk_1.default.white.bold(formatPrice(result.entry.price))}`);
        console.log(`  │`);
        console.log(`  │  ${chalk_1.default.red("Stop Loss:")} ${chalk_1.default.red.bold(formatPrice(result.stopLoss))} ${chalk_1.default.dim(`(${((Math.abs(result.entry.price - result.stopLoss) / result.entry.price) * 100).toFixed(2)}%)`)}`);
        console.log(`  │`);
        console.log(`  │  ${chalk_1.default.green("Take Profit 1:")} ${chalk_1.default.green(formatPrice(result.takeProfit1))} ${chalk_1.default.dim("(1.5R)")}`);
        console.log(`  │  ${chalk_1.default.green("Take Profit 2:")} ${chalk_1.default.green(formatPrice(result.takeProfit2))} ${chalk_1.default.dim("(2.5R)")}`);
        console.log(`  │  ${chalk_1.default.green("Take Profit 3:")} ${chalk_1.default.green(formatPrice(result.takeProfit3))} ${chalk_1.default.dim("(4R)")}`);
        console.log(`  │`);
        console.log(`  │  ${chalk_1.default.cyan("Risk/Reward:")} ${chalk_1.default.cyan.bold(result.riskRewardRatio.toFixed(1) + ":1")}`);
        console.log(chalk_1.default.magenta("  └─────────────────────────────────────────────────────────────────────┘"));
        console.log("");
    }
    // Visual Order Block Map
    console.log(chalk_1.default.blue("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.blue("  │                      📊 ORDER BLOCK MAP                             │"));
    console.log(chalk_1.default.blue("  ├─────────────────────────────────────────────────────────────────────┤"));
    // Show nearest OBs visually
    const allOBs = [...result.bullishOBs, ...result.bearishOBs].sort((a, b) => b.top - a.top);
    const visibleOBs = allOBs.slice(0, 6);
    if (visibleOBs.length > 0) {
        visibleOBs.forEach((ob) => {
            const obColor = ob.type === "bullish" ? chalk_1.default.green : chalk_1.default.red;
            const icon = ob.type === "bullish" ? "▲" : "▼";
            const isNear = result.currentPrice >= ob.bottom * 0.99 && result.currentPrice <= ob.top * 1.01;
            const marker = isNear ? chalk_1.default.yellow(" ← PRICE HERE") : "";
            console.log(`  │  ${obColor(icon)} ${ob.type.padEnd(8)} ${formatPrice(ob.bottom).padStart(12)} - ${formatPrice(ob.top).padEnd(12)} [${ob.strength}]${marker}`);
        });
    }
    else {
        console.log(`  │  ${chalk_1.default.gray("No unmitigated Order Blocks found")}`);
    }
    // Show current price line
    console.log(`  │`);
    console.log(`  │  ${chalk_1.default.white("→ Current:")} ${chalk_1.default.white.bold(formatPrice(result.currentPrice))}`);
    console.log(chalk_1.default.blue("  └─────────────────────────────────────────────────────────────────────┘"));
    console.log("");
    // Context
    console.log(chalk_1.default.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.gray("  │                      🔍 CONTEXT & REASONING                         │"));
    console.log(chalk_1.default.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
    console.log(`  │  ${chalk_1.default.dim("Trend:")} ${result.trend === "bullish" ? chalk_1.default.green("▲ Bullish") : result.trend === "bearish" ? chalk_1.default.red("▼ Bearish") : chalk_1.default.yellow("● Sideways")}`);
    console.log(`  │  ${chalk_1.default.dim("Zone:")} ${result.premiumDiscount === "discount" ? chalk_1.default.green("Discount") : result.premiumDiscount === "premium" ? chalk_1.default.red("Premium") : chalk_1.default.yellow("Equilibrium")}`);
    console.log(`  │`);
    result.reasoning.forEach((r) => {
        console.log(`  │  ${chalk_1.default.cyan("•")} ${chalk_1.default.gray(r)}`);
    });
    console.log(chalk_1.default.gray("  └─────────────────────────────────────────────────────────────────────┘"));
    console.log("");
    // Warnings
    if (result.warnings.length > 0) {
        console.log(chalk_1.default.red("  ┌─────────────────────────────────────────────────────────────────────┐"));
        console.log(chalk_1.default.red("  │                      ⚠️  WARNINGS                                   │"));
        console.log(chalk_1.default.red("  ├─────────────────────────────────────────────────────────────────────┤"));
        result.warnings.forEach((w) => {
            console.log(`  │  ${chalk_1.default.yellow("!")} ${chalk_1.default.yellow(w)}`);
        });
        console.log(chalk_1.default.red("  └─────────────────────────────────────────────────────────────────────┘"));
        console.log("");
    }
    // How Order Blocks are Calculated (Educational)
    console.log(chalk_1.default.dim("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.dim("  │                      📚 HOW ORDER BLOCKS WORK                       │"));
    console.log(chalk_1.default.dim("  ├─────────────────────────────────────────────────────────────────────┤"));
    console.log(chalk_1.default.dim("  │  Bullish OB: Last bearish candle before strong bullish move        │"));
    console.log(chalk_1.default.dim("  │              → BUY when price returns to this zone                 │"));
    console.log(chalk_1.default.dim("  │  Bearish OB: Last bullish candle before strong bearish move        │"));
    console.log(chalk_1.default.dim("  │              → SELL when price returns to this zone                │"));
    console.log(chalk_1.default.dim('  │  Mitigated: OB is "used" when price fully trades through it        │'));
    console.log(chalk_1.default.dim("  └─────────────────────────────────────────────────────────────────────┘"));
    console.log("");
    // Disclaimer
    console.log(chalk_1.default.dim.italic("  ⚠️  This is not financial advice. Always manage your risk and DYOR."));
    console.log("");
}
// ============================================
// RUNNER
// ============================================
async function runOrderBlockStrategy(symbol, interval = "4h") {
    try {
        const result = await generateOrderBlockSignal(symbol, interval);
        displayOrderBlockSignal(result);
        return result;
    }
    catch (error) {
        console.log("");
        console.log(chalk_1.default.red("  ╔═══════════════════════════════════════════════════════════════════════╗"));
        console.log(chalk_1.default.red("  ║                      ❌ ORDER BLOCK ERROR                              ║"));
        console.log(chalk_1.default.red("  ╚═══════════════════════════════════════════════════════════════════════╝"));
        console.log("");
        console.log(chalk_1.default.yellow(`  ⚠️  ${error.message || "An unexpected error occurred"}`));
        console.log("");
        return null;
    }
}
