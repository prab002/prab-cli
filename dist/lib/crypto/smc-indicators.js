"use strict";
/**
 * Smart Money Concepts (SMC) Indicators
 * Institutional trading strategy analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSwingPoints = findSwingPoints;
exports.detectStructureBreaks = detectStructureBreaks;
exports.findOrderBlocks = findOrderBlocks;
exports.findFairValueGaps = findFairValueGaps;
exports.findLiquidityZones = findLiquidityZones;
exports.calculatePremiumDiscount = calculatePremiumDiscount;
exports.analyzeSMC = analyzeSMC;
// ============================================
// SWING POINT DETECTION
// ============================================
/**
 * Find swing highs and lows
 */
function findSwingPoints(candles, lookback = 3) {
    const swingPoints = [];
    for (let i = lookback; i < candles.length - lookback; i++) {
        const current = candles[i];
        // Check for swing high
        let isSwingHigh = true;
        let isSwingLow = true;
        for (let j = 1; j <= lookback; j++) {
            if (candles[i - j].high >= current.high || candles[i + j].high >= current.high) {
                isSwingHigh = false;
            }
            if (candles[i - j].low <= current.low || candles[i + j].low <= current.low) {
                isSwingLow = false;
            }
        }
        if (isSwingHigh) {
            swingPoints.push({
                index: i,
                price: current.high,
                type: "high",
                timestamp: current.timestamp,
            });
        }
        if (isSwingLow) {
            swingPoints.push({
                index: i,
                price: current.low,
                type: "low",
                timestamp: current.timestamp,
            });
        }
    }
    return swingPoints.sort((a, b) => a.index - b.index);
}
// ============================================
// MARKET STRUCTURE ANALYSIS
// ============================================
/**
 * Detect Break of Structure (BOS) and Change of Character (CHoCH)
 */
function detectStructureBreaks(candles, swingPoints) {
    const breaks = [];
    if (swingPoints.length < 4)
        return breaks;
    // Get recent swing highs and lows
    const highs = swingPoints.filter((p) => p.type === "high");
    const lows = swingPoints.filter((p) => p.type === "low");
    // Track current trend
    let currentTrend = "unknown";
    // Analyze structure
    for (let i = 2; i < highs.length; i++) {
        const prevHigh = highs[i - 1];
        const currHigh = highs[i];
        // Find lows between these highs
        const lowsBetween = lows.filter((l) => l.index > prevHigh.index && l.index < currHigh.index);
        if (lowsBetween.length > 0) {
            const lowestLow = lowsBetween.reduce((a, b) => (a.price < b.price ? a : b));
            // Check for BOS or CHoCH
            for (let j = currHigh.index; j < candles.length; j++) {
                const candle = candles[j];
                // Bullish BOS: Price breaks above previous high in uptrend
                if (candle.close > prevHigh.price) {
                    if (currentTrend === "bullish") {
                        breaks.push({
                            type: "BOS",
                            direction: "bullish",
                            level: prevHigh.price,
                            index: j,
                            timestamp: candle.timestamp,
                        });
                    }
                    else if (currentTrend === "bearish") {
                        breaks.push({
                            type: "CHoCH",
                            direction: "bullish",
                            level: prevHigh.price,
                            index: j,
                            timestamp: candle.timestamp,
                        });
                        currentTrend = "bullish";
                    }
                    else {
                        currentTrend = "bullish";
                    }
                    break;
                }
                // Bearish BOS: Price breaks below previous low in downtrend
                if (candle.close < lowestLow.price) {
                    if (currentTrend === "bearish") {
                        breaks.push({
                            type: "BOS",
                            direction: "bearish",
                            level: lowestLow.price,
                            index: j,
                            timestamp: candle.timestamp,
                        });
                    }
                    else if (currentTrend === "bullish") {
                        breaks.push({
                            type: "CHoCH",
                            direction: "bearish",
                            level: lowestLow.price,
                            index: j,
                            timestamp: candle.timestamp,
                        });
                        currentTrend = "bearish";
                    }
                    else {
                        currentTrend = "bearish";
                    }
                    break;
                }
            }
        }
    }
    return breaks;
}
// ============================================
// ORDER BLOCKS
// ============================================
/**
 * Detect Order Blocks (institutional buying/selling zones)
 */
function findOrderBlocks(candles, lookback = 50) {
    const orderBlocks = [];
    const currentPrice = candles[candles.length - 1].close;
    for (let i = 2; i < Math.min(candles.length - 1, lookback); i++) {
        const idx = candles.length - 1 - i;
        const candle = candles[idx];
        const nextCandle = candles[idx + 1];
        const prevCandle = candles[idx - 1];
        // Bullish Order Block: Last bearish candle before strong bullish move
        if (candle.close < candle.open && // Bearish candle
            nextCandle.close > nextCandle.open && // Followed by bullish
            nextCandle.close > candle.high && // Strong bullish move
            (nextCandle.close - nextCandle.open) > (candle.open - candle.close) * 1.5 // Momentum
        ) {
            const ob = {
                type: "bullish",
                top: candle.open,
                bottom: candle.low,
                mitigated: currentPrice < candle.low,
                strength: "moderate",
                index: idx,
                timestamp: candle.timestamp,
            };
            // Check strength based on displacement
            const displacement = (nextCandle.close - candle.high) / candle.high;
            if (displacement > 0.02)
                ob.strength = "strong";
            if (displacement < 0.01)
                ob.strength = "weak";
            // Check if mitigated
            for (let j = idx + 2; j < candles.length; j++) {
                if (candles[j].low <= ob.bottom) {
                    ob.mitigated = true;
                    break;
                }
            }
            if (!ob.mitigated) {
                orderBlocks.push(ob);
            }
        }
        // Bearish Order Block: Last bullish candle before strong bearish move
        if (candle.close > candle.open && // Bullish candle
            nextCandle.close < nextCandle.open && // Followed by bearish
            nextCandle.close < candle.low && // Strong bearish move
            (nextCandle.open - nextCandle.close) > (candle.close - candle.open) * 1.5 // Momentum
        ) {
            const ob = {
                type: "bearish",
                top: candle.high,
                bottom: candle.open,
                mitigated: currentPrice > candle.high,
                strength: "moderate",
                index: idx,
                timestamp: candle.timestamp,
            };
            // Check strength
            const displacement = (candle.low - nextCandle.close) / candle.low;
            if (displacement > 0.02)
                ob.strength = "strong";
            if (displacement < 0.01)
                ob.strength = "weak";
            // Check if mitigated
            for (let j = idx + 2; j < candles.length; j++) {
                if (candles[j].high >= ob.top) {
                    ob.mitigated = true;
                    break;
                }
            }
            if (!ob.mitigated) {
                orderBlocks.push(ob);
            }
        }
    }
    return orderBlocks;
}
// ============================================
// FAIR VALUE GAPS (FVG)
// ============================================
/**
 * Detect Fair Value Gaps (imbalances)
 */
function findFairValueGaps(candles, lookback = 50) {
    const fvgs = [];
    const currentPrice = candles[candles.length - 1].close;
    for (let i = 2; i < Math.min(candles.length, lookback); i++) {
        const idx = candles.length - 1 - i;
        if (idx < 1)
            continue;
        const candle1 = candles[idx - 1];
        const candle2 = candles[idx];
        const candle3 = candles[idx + 1];
        // Bullish FVG: Gap between candle 1 high and candle 3 low
        if (candle3.low > candle1.high) {
            const fvg = {
                type: "bullish",
                top: candle3.low,
                bottom: candle1.high,
                filled: false,
                fillPercentage: 0,
                index: idx,
                timestamp: candle2.timestamp,
            };
            // Check if filled
            let lowestReach = candle3.low;
            for (let j = idx + 2; j < candles.length; j++) {
                if (candles[j].low < lowestReach) {
                    lowestReach = candles[j].low;
                }
            }
            if (lowestReach <= candle1.high) {
                fvg.filled = true;
                fvg.fillPercentage = 100;
            }
            else {
                const gapSize = candle3.low - candle1.high;
                const filledSize = candle3.low - lowestReach;
                fvg.fillPercentage = (filledSize / gapSize) * 100;
            }
            fvgs.push(fvg);
        }
        // Bearish FVG: Gap between candle 1 low and candle 3 high
        if (candle3.high < candle1.low) {
            const fvg = {
                type: "bearish",
                top: candle1.low,
                bottom: candle3.high,
                filled: false,
                fillPercentage: 0,
                index: idx,
                timestamp: candle2.timestamp,
            };
            // Check if filled
            let highestReach = candle3.high;
            for (let j = idx + 2; j < candles.length; j++) {
                if (candles[j].high > highestReach) {
                    highestReach = candles[j].high;
                }
            }
            if (highestReach >= candle1.low) {
                fvg.filled = true;
                fvg.fillPercentage = 100;
            }
            else {
                const gapSize = candle1.low - candle3.high;
                const filledSize = highestReach - candle3.high;
                fvg.fillPercentage = (filledSize / gapSize) * 100;
            }
            fvgs.push(fvg);
        }
    }
    return fvgs;
}
// ============================================
// LIQUIDITY ZONES
// ============================================
/**
 * Find liquidity zones (stop loss clusters)
 */
function findLiquidityZones(candles, swingPoints) {
    const buySide = [];
    const sellSide = [];
    const currentPrice = candles[candles.length - 1].close;
    // Group swing highs (buy-side liquidity - stops above)
    const highs = swingPoints.filter((p) => p.type === "high" && p.price > currentPrice);
    const lows = swingPoints.filter((p) => p.type === "low" && p.price < currentPrice);
    // Cluster nearby highs
    const clusterThreshold = 0.005; // 0.5%
    highs.forEach((high) => {
        const existing = buySide.find((z) => Math.abs(z.level - high.price) / high.price < clusterThreshold);
        if (existing) {
            existing.strength++;
            existing.level = (existing.level + high.price) / 2;
        }
        else {
            buySide.push({
                type: "buy_side",
                level: high.price,
                strength: 1,
                swept: false,
                index: high.index,
            });
        }
    });
    // Cluster nearby lows
    lows.forEach((low) => {
        const existing = sellSide.find((z) => Math.abs(z.level - low.price) / low.price < clusterThreshold);
        if (existing) {
            existing.strength++;
            existing.level = (existing.level + low.price) / 2;
        }
        else {
            sellSide.push({
                type: "sell_side",
                level: low.price,
                strength: 1,
                swept: false,
                index: low.index,
            });
        }
    });
    // Sort by proximity to current price
    buySide.sort((a, b) => a.level - b.level);
    sellSide.sort((a, b) => b.level - a.level);
    return { buySide: buySide.slice(0, 5), sellSide: sellSide.slice(0, 5) };
}
// ============================================
// PREMIUM/DISCOUNT ZONES
// ============================================
/**
 * Calculate Premium/Discount zones using recent range
 */
function calculatePremiumDiscount(candles, lookback = 50) {
    const recentCandles = candles.slice(-lookback);
    const rangeHigh = Math.max(...recentCandles.map((c) => c.high));
    const rangeLow = Math.min(...recentCandles.map((c) => c.low));
    const equilibrium = (rangeHigh + rangeLow) / 2;
    const currentPrice = candles[candles.length - 1].close;
    // Calculate Fibonacci level (0 = low, 0.5 = equilibrium, 1 = high)
    const fibLevel = (currentPrice - rangeLow) / (rangeHigh - rangeLow);
    let zone;
    if (fibLevel > 0.618) {
        zone = "premium";
    }
    else if (fibLevel < 0.382) {
        zone = "discount";
    }
    else {
        zone = "equilibrium";
    }
    return {
        zone,
        fibLevel: fibLevel * 100,
        rangeHigh,
        rangeLow,
        equilibrium,
    };
}
// ============================================
// MAIN SMC ANALYSIS
// ============================================
/**
 * Perform complete SMC analysis
 */
function analyzeSMC(candles) {
    // Find swing points
    const swingPoints = findSwingPoints(candles, 3);
    const swingHighs = swingPoints.filter((p) => p.type === "high");
    const swingLows = swingPoints.filter((p) => p.type === "low");
    // Detect structure breaks
    const structureBreaks = detectStructureBreaks(candles, swingPoints);
    const lastBOS = structureBreaks.filter((b) => b.type === "BOS").pop() || null;
    const lastCHoCH = structureBreaks.filter((b) => b.type === "CHoCH").pop() || null;
    // Determine market structure trend
    let marketTrend = "ranging";
    if (lastBOS) {
        marketTrend = lastBOS.direction;
    }
    if (lastCHoCH && (!lastBOS || lastCHoCH.index > lastBOS.index)) {
        marketTrend = lastCHoCH.direction;
    }
    // Find order blocks
    const orderBlocks = findOrderBlocks(candles);
    const bullishOBs = orderBlocks.filter((ob) => ob.type === "bullish");
    const bearishOBs = orderBlocks.filter((ob) => ob.type === "bearish");
    // Find nearest unmitigated order block
    const currentPrice = candles[candles.length - 1].close;
    const nearestOB = orderBlocks
        .filter((ob) => !ob.mitigated)
        .sort((a, b) => {
        const distA = Math.min(Math.abs(currentPrice - a.top), Math.abs(currentPrice - a.bottom));
        const distB = Math.min(Math.abs(currentPrice - b.top), Math.abs(currentPrice - b.bottom));
        return distA - distB;
    })[0] || null;
    // Find FVGs
    const fvgs = findFairValueGaps(candles);
    const bullishFVGs = fvgs.filter((f) => f.type === "bullish");
    const bearishFVGs = fvgs.filter((f) => f.type === "bearish");
    const unfilledFVGs = fvgs.filter((f) => !f.filled);
    // Find liquidity
    const liquidity = findLiquidityZones(candles, swingPoints);
    const nextLiqTarget = marketTrend === "bullish"
        ? liquidity.buySide[0] || null
        : marketTrend === "bearish"
            ? liquidity.sellSide[0] || null
            : null;
    // Premium/Discount
    const premiumDiscount = calculatePremiumDiscount(candles);
    // Generate bias
    const reasoning = [];
    let biasScore = 0;
    // Structure-based bias
    if (marketTrend === "bullish") {
        biasScore += 30;
        reasoning.push(`Bullish market structure (${lastBOS ? "BOS" : "CHoCH"} to upside)`);
    }
    else if (marketTrend === "bearish") {
        biasScore -= 30;
        reasoning.push(`Bearish market structure (${lastBOS ? "BOS" : "CHoCH"} to downside)`);
    }
    // Order block proximity
    if (nearestOB) {
        if (nearestOB.type === "bullish" && currentPrice <= nearestOB.top * 1.01) {
            biasScore += 20;
            reasoning.push(`Price at bullish order block ($${nearestOB.bottom.toFixed(2)} - $${nearestOB.top.toFixed(2)})`);
        }
        else if (nearestOB.type === "bearish" && currentPrice >= nearestOB.bottom * 0.99) {
            biasScore -= 20;
            reasoning.push(`Price at bearish order block ($${nearestOB.bottom.toFixed(2)} - $${nearestOB.top.toFixed(2)})`);
        }
    }
    // Premium/Discount zone
    if (premiumDiscount.zone === "discount") {
        biasScore += 15;
        reasoning.push(`Price in discount zone (${premiumDiscount.fibLevel.toFixed(0)}% of range)`);
    }
    else if (premiumDiscount.zone === "premium") {
        biasScore -= 15;
        reasoning.push(`Price in premium zone (${premiumDiscount.fibLevel.toFixed(0)}% of range)`);
    }
    // Unfilled FVGs
    const bullishUnfilled = unfilledFVGs.filter((f) => f.type === "bullish" && f.bottom > currentPrice);
    const bearishUnfilled = unfilledFVGs.filter((f) => f.type === "bearish" && f.top < currentPrice);
    if (bullishUnfilled.length > 0) {
        reasoning.push(`${bullishUnfilled.length} unfilled bullish FVG(s) above`);
    }
    if (bearishUnfilled.length > 0) {
        reasoning.push(`${bearishUnfilled.length} unfilled bearish FVG(s) below`);
    }
    // Liquidity targets
    if (liquidity.buySide.length > 0) {
        const nearestBuySide = liquidity.buySide[0];
        reasoning.push(`Buy-side liquidity at $${nearestBuySide.level.toFixed(2)} (${nearestBuySide.strength} touches)`);
    }
    if (liquidity.sellSide.length > 0) {
        const nearestSellSide = liquidity.sellSide[0];
        reasoning.push(`Sell-side liquidity at $${nearestSellSide.level.toFixed(2)} (${nearestSellSide.strength} touches)`);
    }
    const biasDirection = biasScore > 20 ? "bullish" : biasScore < -20 ? "bearish" : "neutral";
    const confidence = Math.min(Math.abs(biasScore), 100);
    return {
        marketStructure: {
            trend: marketTrend,
            lastBOS,
            lastCHoCH,
            swingHighs: swingHighs.slice(-10),
            swingLows: swingLows.slice(-10),
        },
        orderBlocks: {
            bullish: bullishOBs.slice(0, 5),
            bearish: bearishOBs.slice(0, 5),
            nearest: nearestOB,
        },
        fairValueGaps: {
            bullish: bullishFVGs.slice(0, 5),
            bearish: bearishFVGs.slice(0, 5),
            unfilled: unfilledFVGs.slice(0, 5),
        },
        liquidity: {
            buySide: liquidity.buySide,
            sellSide: liquidity.sellSide,
            nextTarget: nextLiqTarget,
        },
        premiumDiscount,
        bias: {
            direction: biasDirection,
            confidence,
            reasoning,
        },
    };
}
