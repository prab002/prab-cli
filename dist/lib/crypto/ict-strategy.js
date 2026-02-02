"use strict";
/**
 * ICT (Inner Circle Trader) Strategy Module
 * Complete implementation of ICT trading concepts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateICTSignal = generateICTSignal;
exports.displayICTSignal = displayICTSignal;
exports.runICTStrategy = runICTStrategy;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const data_fetcher_1 = require("./data-fetcher");
const smc_indicators_1 = require("./smc-indicators");
const indicators_1 = require("./indicators");
// ============================================
// KILLZONE DETECTION
// ============================================
const KILLZONES = [
    {
        name: "Asian Session",
        type: "asian",
        startHourUTC: 0, // 00:00 UTC (8 PM EST)
        endHourUTC: 6, // 06:00 UTC
        description: "Range forming session - identify highs/lows",
    },
    {
        name: "London Open",
        type: "london",
        startHourUTC: 7, // 07:00 UTC (2 AM EST)
        endHourUTC: 10, // 10:00 UTC (5 AM EST)
        description: "High volatility - trend continuation or reversal",
    },
    {
        name: "New York AM",
        type: "new_york_am",
        startHourUTC: 13, // 13:00 UTC (8 AM EST)
        endHourUTC: 16, // 16:00 UTC (11 AM EST)
        description: "Highest volatility - major moves",
    },
    {
        name: "New York PM",
        type: "new_york_pm",
        startHourUTC: 18, // 18:00 UTC (1 PM EST)
        endHourUTC: 21, // 21:00 UTC (4 PM EST)
        description: "Profit taking and reversals",
    },
    {
        name: "Silver Bullet AM",
        type: "silver_bullet_am",
        startHourUTC: 14, // 14:00 UTC (10 AM EST)
        endHourUTC: 15, // 15:00 UTC (11 AM EST)
        description: "ICT Silver Bullet - high probability entry window",
    },
    {
        name: "Silver Bullet PM",
        type: "silver_bullet_pm",
        startHourUTC: 19, // 19:00 UTC (2 PM EST)
        endHourUTC: 20, // 20:00 UTC (3 PM EST)
        description: "ICT Silver Bullet - afternoon entry window",
    },
];
function getCurrentKillzone() {
    const now = new Date();
    const hourUTC = now.getUTCHours();
    for (const kz of KILLZONES) {
        if (hourUTC >= kz.startHourUTC && hourUTC < kz.endHourUTC) {
            return {
                ...kz,
                active: true,
                bias: "neutral",
            };
        }
    }
    return {
        name: "No Active Killzone",
        type: "none",
        active: false,
        startHourUTC: 0,
        endHourUTC: 0,
        bias: "neutral",
        description: "Outside of main trading sessions",
    };
}
// ============================================
// OTE (OPTIMAL TRADE ENTRY)
// ============================================
function calculateOTE(candles, swingPoints, currentPrice) {
    const recentHighs = swingPoints.filter((p) => p.type === "high").slice(-5);
    const recentLows = swingPoints.filter((p) => p.type === "low").slice(-5);
    if (recentHighs.length < 2 || recentLows.length < 2) {
        return {
            isValid: false,
            fibLevel: 0,
            zone: { low: currentPrice, high: currentPrice },
            swingHigh: currentPrice,
            swingLow: currentPrice,
            direction: "bullish",
            quality: "suboptimal",
        };
    }
    // Get most recent swing high and low
    const swingHigh = Math.max(...recentHighs.map((h) => h.price));
    const swingLow = Math.min(...recentLows.map((l) => l.price));
    const range = swingHigh - swingLow;
    // Calculate current position as Fib level
    const fibLevel = (currentPrice - swingLow) / range;
    // Determine direction based on recent price action
    const lastCandles = candles.slice(-10);
    const avgClose = lastCandles.reduce((sum, c) => sum + c.close, 0) / lastCandles.length;
    const direction = currentPrice > avgClose ? "bullish" : "bearish";
    // OTE Zone is 62% - 79% retracement
    let oteZone;
    if (direction === "bullish") {
        // For bullish OTE, we want price to retrace into discount
        oteZone = {
            low: swingLow + range * 0.62,
            high: swingLow + range * 0.79,
        };
    }
    else {
        // For bearish OTE, we want price to retrace into premium
        oteZone = {
            low: swingHigh - range * 0.79,
            high: swingHigh - range * 0.62,
        };
    }
    // Determine quality based on fib level
    let quality;
    if (direction === "bullish") {
        if (fibLevel >= 0.62 && fibLevel <= 0.79)
            quality = "premium";
        else if (fibLevel >= 0.5 && fibLevel <= 0.85)
            quality = "standard";
        else
            quality = "suboptimal";
    }
    else {
        if (fibLevel >= 0.21 && fibLevel <= 0.38)
            quality = "premium";
        else if (fibLevel >= 0.15 && fibLevel <= 0.5)
            quality = "standard";
        else
            quality = "suboptimal";
    }
    const isValid = quality !== "suboptimal";
    return {
        isValid,
        fibLevel,
        zone: oteZone,
        swingHigh,
        swingLow,
        direction,
        quality,
    };
}
// ============================================
// BREAKER BLOCKS
// ============================================
function findBreakerBlocks(candles, orderBlocks) {
    const breakerBlocks = [];
    const currentPrice = candles[candles.length - 1].close;
    for (const ob of orderBlocks) {
        // Check if this order block was broken (mitigated) and then price returned
        if (ob.mitigated) {
            // Find where it was broken
            let breakIndex = -1;
            let breakPrice = 0;
            for (let i = ob.index + 1; i < candles.length; i++) {
                if (ob.type === "bullish" && candles[i].close < ob.bottom) {
                    breakIndex = i;
                    breakPrice = candles[i].close;
                    break;
                }
                if (ob.type === "bearish" && candles[i].close > ob.top) {
                    breakIndex = i;
                    breakPrice = candles[i].close;
                    break;
                }
            }
            if (breakIndex > 0) {
                // A broken bullish OB becomes a bearish breaker
                // A broken bearish OB becomes a bullish breaker
                const breakerType = ob.type === "bullish" ? "bearish" : "bullish";
                // Check if price has returned to this level
                const priceNearBreaker = (breakerType === "bullish" && currentPrice >= ob.bottom * 0.99 && currentPrice <= ob.top * 1.01) ||
                    (breakerType === "bearish" && currentPrice >= ob.bottom * 0.99 && currentPrice <= ob.top * 1.01);
                if (priceNearBreaker || breakerBlocks.length < 5) {
                    breakerBlocks.push({
                        type: breakerType,
                        top: ob.top,
                        bottom: ob.bottom,
                        originalOB: ob,
                        breakPrice,
                        strength: ob.strength,
                        index: ob.index,
                    });
                }
            }
        }
    }
    return breakerBlocks.slice(0, 5);
}
// ============================================
// INDUCEMENT DETECTION
// ============================================
function findInducements(candles, swingPoints) {
    const inducements = [];
    const currentPrice = candles[candles.length - 1].close;
    // Find equal highs (buy-side liquidity)
    const highs = swingPoints.filter((p) => p.type === "high");
    for (let i = 1; i < highs.length; i++) {
        const diff = Math.abs(highs[i].price - highs[i - 1].price) / highs[i].price;
        if (diff < 0.003) {
            // Within 0.3% = equal highs
            const level = (highs[i].price + highs[i - 1].price) / 2;
            // Check if swept
            let swept = false;
            let sweepCandle = null;
            for (let j = highs[i].index + 1; j < candles.length; j++) {
                if (candles[j].high > level * 1.001) {
                    swept = true;
                    sweepCandle = j;
                    break;
                }
            }
            inducements.push({
                type: "buy_side",
                level,
                swept,
                sweepCandle,
                trapType: "equal_highs",
            });
        }
    }
    // Find equal lows (sell-side liquidity)
    const lows = swingPoints.filter((p) => p.type === "low");
    for (let i = 1; i < lows.length; i++) {
        const diff = Math.abs(lows[i].price - lows[i - 1].price) / lows[i].price;
        if (diff < 0.003) {
            const level = (lows[i].price + lows[i - 1].price) / 2;
            let swept = false;
            let sweepCandle = null;
            for (let j = lows[i].index + 1; j < candles.length; j++) {
                if (candles[j].low < level * 0.999) {
                    swept = true;
                    sweepCandle = j;
                    break;
                }
            }
            inducements.push({
                type: "sell_side",
                level,
                swept,
                sweepCandle,
                trapType: "equal_lows",
            });
        }
    }
    return inducements.slice(0, 10);
}
// ============================================
// DISPLACEMENT DETECTION
// ============================================
function detectDisplacement(candles, atrValue) {
    const recentCandles = candles.slice(-10);
    for (let i = 0; i < recentCandles.length - 1; i++) {
        const candle = recentCandles[i];
        const body = Math.abs(candle.close - candle.open);
        // Displacement = candle body > 2x ATR
        if (body > atrValue * 2) {
            const direction = candle.close > candle.open ? "bullish" : "bearish";
            // Check if FVG was created
            let fvgCreated = false;
            if (i > 0 && i < recentCandles.length - 1) {
                const prev = recentCandles[i - 1];
                const next = recentCandles[i + 1];
                if (direction === "bullish" && next.low > prev.high)
                    fvgCreated = true;
                if (direction === "bearish" && next.high < prev.low)
                    fvgCreated = true;
            }
            return {
                detected: true,
                direction,
                strength: body / atrValue,
                startIndex: candles.length - 10 + i,
                fvgCreated,
            };
        }
    }
    return {
        detected: false,
        direction: "bullish",
        strength: 0,
        startIndex: 0,
        fvgCreated: false,
    };
}
// ============================================
// POWER OF 3 (AMD MODEL)
// ============================================
function analyzePowerOf3(candles) {
    // Need at least 24 hourly candles for daily analysis
    if (candles.length < 24) {
        return {
            phase: "unknown",
            asianRangeHigh: 0,
            asianRangeLow: 0,
            manipulation: "none",
            expectedMove: "unclear",
        };
    }
    const now = new Date();
    const hourUTC = now.getUTCHours();
    // Get approximate Asian session candles (last 6-12 candles depending on timeframe)
    const asianCandles = candles.slice(-12, -6);
    if (asianCandles.length === 0) {
        return {
            phase: "unknown",
            asianRangeHigh: 0,
            asianRangeLow: 0,
            manipulation: "none",
            expectedMove: "unclear",
        };
    }
    const asianRangeHigh = Math.max(...asianCandles.map((c) => c.high));
    const asianRangeLow = Math.min(...asianCandles.map((c) => c.low));
    // Get recent candles (London/NY session)
    const recentCandles = candles.slice(-6);
    const currentPrice = candles[candles.length - 1].close;
    const recentHigh = Math.max(...recentCandles.map((c) => c.high));
    const recentLow = Math.min(...recentCandles.map((c) => c.low));
    // Determine manipulation
    let manipulation = "none";
    if (recentHigh > asianRangeHigh * 1.001)
        manipulation = "above";
    else if (recentLow < asianRangeLow * 0.999)
        manipulation = "below";
    // Determine phase
    let phase;
    if (hourUTC >= 0 && hourUTC < 7) {
        phase = "accumulation";
    }
    else if (hourUTC >= 7 && hourUTC < 14) {
        phase = "manipulation";
    }
    else {
        phase = "distribution";
    }
    // Expected move based on manipulation
    let expectedMove = "unclear";
    if (manipulation === "above") {
        // Swept buy-side liquidity, expect bearish move
        expectedMove = "bearish";
    }
    else if (manipulation === "below") {
        // Swept sell-side liquidity, expect bullish move
        expectedMove = "bullish";
    }
    return {
        phase,
        asianRangeHigh,
        asianRangeLow,
        manipulation,
        expectedMove,
    };
}
// ============================================
// MAIN ICT ANALYSIS
// ============================================
async function generateICTSignal(symbol, interval = "1h") {
    const spinner = (0, ora_1.default)(`Analyzing ${symbol} with ICT methodology...`).start();
    try {
        // Fetch data
        spinner.text = "Fetching market data...";
        const data = await (0, data_fetcher_1.fetchCryptoData)(symbol, interval, 200);
        const candles = data.candles;
        const currentPrice = data.currentPrice;
        // Get current killzone
        spinner.text = "Checking killzones...";
        const killzone = getCurrentKillzone();
        // Find swing points
        spinner.text = "Analyzing market structure...";
        const swingPoints = (0, smc_indicators_1.findSwingPoints)(candles, 3);
        // Detect structure breaks
        const structureBreaks = (0, smc_indicators_1.detectStructureBreaks)(candles, swingPoints);
        const lastBOS = structureBreaks.filter((b) => b.type === "BOS").pop() || null;
        const lastCHoCH = structureBreaks.filter((b) => b.type === "CHoCH").pop() || null;
        // Determine trend
        let trend = "ranging";
        if (lastBOS)
            trend = lastBOS.direction;
        if (lastCHoCH && (!lastBOS || lastCHoCH.index > lastBOS.index)) {
            trend = lastCHoCH.direction;
        }
        // Check for MSS (Market Structure Shift)
        const mss = lastCHoCH !== null && lastCHoCH.index > candles.length - 20;
        // Calculate indicators
        spinner.text = "Calculating ICT concepts...";
        const closes = candles.map((c) => c.close);
        const rsi = (0, indicators_1.calculateRSI)(closes, 14);
        const atr = (0, indicators_1.calculateATR)(candles, 14);
        // Find order blocks and FVGs
        const orderBlocks = (0, smc_indicators_1.findOrderBlocks)(candles, 100);
        const fvgs = (0, smc_indicators_1.findFairValueGaps)(candles, 50);
        // Calculate OTE
        const ote = calculateOTE(candles, swingPoints, currentPrice);
        // Find breaker blocks
        const breakerBlocks = findBreakerBlocks(candles, orderBlocks);
        // Find inducements
        const inducements = findInducements(candles, swingPoints);
        // Detect displacement
        const displacement = detectDisplacement(candles, atr.current);
        // Analyze Power of 3
        const powerOf3 = analyzePowerOf3(candles);
        // Premium/Discount
        const premiumDiscount = (0, smc_indicators_1.calculatePremiumDiscount)(candles, 50);
        // ============================================
        // SIGNAL GENERATION
        // ============================================
        spinner.text = "Generating ICT signal...";
        let signal = "WAIT";
        let confidence = 30;
        let modelType = "standard";
        let entry = {
            price: currentPrice,
            zone: { low: currentPrice * 0.99, high: currentPrice * 1.01 },
            type: "Wait for Setup",
            reason: "No valid ICT setup detected",
        };
        let stopLoss = currentPrice;
        let tp1 = currentPrice, tp2 = currentPrice, tp3 = currentPrice;
        const reasoning = [];
        const confluenceFactors = [];
        const warnings = [];
        // Check for active breaker block
        const activeBreaker = breakerBlocks.find((bb) => {
            return currentPrice >= bb.bottom * 0.995 && currentPrice <= bb.top * 1.005;
        }) || null;
        // Recent sweep detection
        const recentSweep = inducements.find((ind) => {
            if (!ind.swept || ind.sweepCandle === null)
                return false;
            return ind.sweepCandle >= candles.length - 5;
        }) || null;
        // ============================================
        // SILVER BULLET MODEL
        // ============================================
        if (killzone.type === "silver_bullet_am" || killzone.type === "silver_bullet_pm") {
            modelType = "silver_bullet";
            confluenceFactors.push("In Silver Bullet window");
            // Look for FVG in direction of trend
            const unfilledFVGs = fvgs.filter((f) => !f.filled);
            const trendFVG = unfilledFVGs.find((f) => f.type === (trend === "bullish" ? "bullish" : "bearish"));
            if (trendFVG && displacement.detected && displacement.direction === trend) {
                if (trend === "bullish") {
                    signal = "BUY";
                    confidence = 75;
                    entry = {
                        price: (trendFVG.top + trendFVG.bottom) / 2,
                        zone: { low: trendFVG.bottom, high: trendFVG.top },
                        type: "Silver Bullet FVG Entry",
                        reason: "FVG fill in bullish trend during Silver Bullet",
                    };
                    stopLoss = trendFVG.bottom * 0.995;
                    const risk = entry.price - stopLoss;
                    tp1 = entry.price + risk * 2;
                    tp2 = entry.price + risk * 3;
                    tp3 = entry.price + risk * 5;
                }
                else {
                    signal = "SELL";
                    confidence = 75;
                    entry = {
                        price: (trendFVG.top + trendFVG.bottom) / 2,
                        zone: { low: trendFVG.bottom, high: trendFVG.top },
                        type: "Silver Bullet FVG Entry",
                        reason: "FVG fill in bearish trend during Silver Bullet",
                    };
                    stopLoss = trendFVG.top * 1.005;
                    const risk = stopLoss - entry.price;
                    tp1 = entry.price - risk * 2;
                    tp2 = entry.price - risk * 3;
                    tp3 = entry.price - risk * 5;
                }
                reasoning.push("Silver Bullet setup detected with FVG and displacement");
            }
        }
        // ============================================
        // OTE MODEL
        // ============================================
        if (signal === "WAIT" && ote.isValid && ote.quality === "premium") {
            modelType = "ote";
            // Check if price is in OTE zone
            const inOTEZone = currentPrice >= ote.zone.low && currentPrice <= ote.zone.high;
            if (inOTEZone) {
                confluenceFactors.push("Price in OTE zone (62-79% retracement)");
                if (ote.direction === "bullish" && premiumDiscount.zone === "discount") {
                    signal = "BUY";
                    confidence = 70;
                    entry = {
                        price: currentPrice,
                        zone: ote.zone,
                        type: "OTE Long Entry",
                        reason: "Bullish OTE in discount zone",
                    };
                    stopLoss = ote.swingLow * 0.995;
                    const risk = entry.price - stopLoss;
                    tp1 = entry.price + risk * 1.5;
                    tp2 = ote.swingHigh;
                    tp3 = ote.swingHigh + risk;
                    reasoning.push(`OTE at ${(ote.fibLevel * 100).toFixed(0)}% retracement`);
                }
                else if (ote.direction === "bearish" && premiumDiscount.zone === "premium") {
                    signal = "SELL";
                    confidence = 70;
                    entry = {
                        price: currentPrice,
                        zone: ote.zone,
                        type: "OTE Short Entry",
                        reason: "Bearish OTE in premium zone",
                    };
                    stopLoss = ote.swingHigh * 1.005;
                    const risk = stopLoss - entry.price;
                    tp1 = entry.price - risk * 1.5;
                    tp2 = ote.swingLow;
                    tp3 = ote.swingLow - risk;
                    reasoning.push(`OTE at ${(ote.fibLevel * 100).toFixed(0)}% retracement`);
                }
            }
        }
        // ============================================
        // BREAKER BLOCK MODEL
        // ============================================
        if (signal === "WAIT" && activeBreaker) {
            modelType = "breaker";
            confluenceFactors.push("Price at Breaker Block");
            if (activeBreaker.type === "bullish") {
                signal = "BUY";
                confidence = 65;
                entry = {
                    price: (activeBreaker.top + activeBreaker.bottom) / 2,
                    zone: { low: activeBreaker.bottom, high: activeBreaker.top },
                    type: "Bullish Breaker Entry",
                    reason: "Price retesting bullish breaker block",
                };
                stopLoss = activeBreaker.bottom * 0.99;
                const risk = entry.price - stopLoss;
                tp1 = entry.price + risk * 2;
                tp2 = entry.price + risk * 3;
                tp3 = entry.price + risk * 5;
                reasoning.push("Bullish breaker block retest");
            }
            else {
                signal = "SELL";
                confidence = 65;
                entry = {
                    price: (activeBreaker.top + activeBreaker.bottom) / 2,
                    zone: { low: activeBreaker.bottom, high: activeBreaker.top },
                    type: "Bearish Breaker Entry",
                    reason: "Price retesting bearish breaker block",
                };
                stopLoss = activeBreaker.top * 1.01;
                const risk = stopLoss - entry.price;
                tp1 = entry.price - risk * 2;
                tp2 = entry.price - risk * 3;
                tp3 = entry.price - risk * 5;
                reasoning.push("Bearish breaker block retest");
            }
        }
        // ============================================
        // DISPLACEMENT MODEL
        // ============================================
        if (signal === "WAIT" && displacement.detected && displacement.fvgCreated) {
            modelType = "displacement";
            confluenceFactors.push(`${displacement.direction} displacement detected`);
            // Find the FVG created by displacement
            const displacementFVG = fvgs.find((f) => f.type === displacement.direction && !f.filled && f.index >= displacement.startIndex - 2);
            if (displacementFVG) {
                const distToFVG = displacement.direction === "bullish"
                    ? ((displacementFVG.bottom - currentPrice) / currentPrice) * 100
                    : ((currentPrice - displacementFVG.top) / currentPrice) * 100;
                if (distToFVG < 2) {
                    if (displacement.direction === "bullish") {
                        signal = "BUY";
                        confidence = 60;
                        entry = {
                            price: displacementFVG.top,
                            zone: { low: displacementFVG.bottom, high: displacementFVG.top },
                            type: "Displacement FVG Entry",
                            reason: "Bullish displacement with FVG fill opportunity",
                        };
                        stopLoss = displacementFVG.bottom * 0.99;
                    }
                    else {
                        signal = "SELL";
                        confidence = 60;
                        entry = {
                            price: displacementFVG.bottom,
                            zone: { low: displacementFVG.bottom, high: displacementFVG.top },
                            type: "Displacement FVG Entry",
                            reason: "Bearish displacement with FVG fill opportunity",
                        };
                        stopLoss = displacementFVG.top * 1.01;
                    }
                    const risk = Math.abs(entry.price - stopLoss);
                    tp1 = displacement.direction === "bullish" ? entry.price + risk * 2 : entry.price - risk * 2;
                    tp2 = displacement.direction === "bullish" ? entry.price + risk * 3 : entry.price - risk * 3;
                    tp3 = displacement.direction === "bullish" ? entry.price + risk * 5 : entry.price - risk * 5;
                    reasoning.push(`Displacement strength: ${displacement.strength.toFixed(1)}x ATR`);
                }
            }
        }
        // ============================================
        // ADD CONFLUENCE FACTORS
        // ============================================
        if (killzone.active)
            confluenceFactors.push(`Active Killzone: ${killzone.name}`);
        if (mss)
            confluenceFactors.push("Recent Market Structure Shift");
        if (recentSweep)
            confluenceFactors.push(`${recentSweep.type} liquidity swept`);
        if (powerOf3.manipulation !== "none") {
            confluenceFactors.push(`AMD: ${powerOf3.manipulation} manipulation detected`);
        }
        // Adjust confidence based on confluence
        confidence += Math.min(confluenceFactors.length * 5, 20);
        confidence = Math.min(confidence, 95);
        // ============================================
        // WARNINGS
        // ============================================
        if (!killzone.active) {
            warnings.push("Outside of major killzones - lower probability");
        }
        if (signal !== "WAIT" && trend !== (signal === "BUY" ? "bullish" : "bearish")) {
            warnings.push("Counter-trend trade - manage risk carefully");
        }
        if (rsi.current > 75 && signal === "BUY") {
            warnings.push("RSI overbought - consider waiting for pullback");
        }
        if (rsi.current < 25 && signal === "SELL") {
            warnings.push("RSI oversold - consider waiting for bounce");
        }
        // Add general context
        reasoning.push(`Trend: ${trend} | RSI: ${rsi.current.toFixed(1)}`);
        reasoning.push(`Premium/Discount: ${premiumDiscount.zone} (${premiumDiscount.fibLevel.toFixed(0)}%)`);
        if (powerOf3.phase !== "unknown") {
            reasoning.push(`Power of 3: ${powerOf3.phase} phase`);
        }
        // Calculate R:R
        const riskAmount = Math.abs(entry.price - stopLoss);
        const rewardAmount = Math.abs(tp2 - entry.price);
        const riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;
        spinner.succeed(`ICT analysis complete for ${data.symbol}`);
        return {
            symbol: data.symbol,
            currentPrice,
            timestamp: Date.now(),
            signal,
            confidence,
            modelType,
            killzone,
            inKillzone: killzone.active,
            ote,
            breakerBlocks,
            activeBreaker,
            inducements,
            recentSweep,
            displacement,
            powerOf3,
            marketStructure: {
                trend,
                lastBOS,
                lastCHoCH,
                mss,
            },
            premiumDiscount: {
                zone: premiumDiscount.zone,
                fibLevel: premiumDiscount.fibLevel,
            },
            entry,
            stopLoss,
            takeProfit1: tp1,
            takeProfit2: tp2,
            takeProfit3: tp3,
            riskRewardRatio,
            reasoning,
            confluenceFactors,
            warnings,
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
function displayICTSignal(result) {
    console.log("");
    // Header
    const headerColor = result.signal === "BUY"
        ? chalk_1.default.green
        : result.signal === "SELL"
            ? chalk_1.default.red
            : chalk_1.default.yellow;
    const signalIcon = result.signal === "BUY" ? "🟢" : result.signal === "SELL" ? "🔴" : "⏳";
    console.log(headerColor("  ╔═══════════════════════════════════════════════════════════════════════╗"));
    console.log(headerColor(`  ║       ${signalIcon} ICT TRADING STRATEGY - ${result.symbol.padEnd(20)}          ║`));
    console.log(headerColor("  ╚═══════════════════════════════════════════════════════════════════════╝"));
    console.log("");
    // Current Price & Signal
    console.log(`  ${chalk_1.default.cyan("Current Price:")} ${chalk_1.default.white.bold(formatPrice(result.currentPrice))}`);
    console.log("");
    const signalBadge = result.signal === "BUY"
        ? chalk_1.default.bgGreen.white.bold(" BUY ")
        : result.signal === "SELL"
            ? chalk_1.default.bgRed.white.bold(" SELL ")
            : chalk_1.default.bgYellow.black.bold(" WAIT ");
    const modelBadge = chalk_1.default.bgBlue.white(` ${result.modelType.toUpperCase().replace("_", " ")} `);
    console.log(`  ${signalBadge} ${modelBadge}  Confidence: ${getConfidenceBar(result.confidence)} ${result.confidence}%`);
    console.log("");
    // Killzone Status
    console.log(chalk_1.default.magenta("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.magenta("  │                      ⏰ KILLZONE STATUS                             │"));
    console.log(chalk_1.default.magenta("  ├─────────────────────────────────────────────────────────────────────┤"));
    const kzColor = result.inKillzone ? chalk_1.default.green : chalk_1.default.yellow;
    console.log(`  │  ${kzColor(result.killzone.name)} ${result.inKillzone ? chalk_1.default.green("● ACTIVE") : chalk_1.default.yellow("○ INACTIVE")}`);
    console.log(`  │  ${chalk_1.default.dim(result.killzone.description)}`);
    // Show all killzones with times
    console.log(`  │`);
    console.log(`  │  ${chalk_1.default.dim("Session Times (UTC):")}`);
    console.log(`  │  ${chalk_1.default.cyan("Asian:")} 00:00-06:00  ${chalk_1.default.yellow("London:")} 07:00-10:00`);
    console.log(`  │  ${chalk_1.default.green("NY AM:")} 13:00-16:00  ${chalk_1.default.red("NY PM:")} 18:00-21:00`);
    console.log(`  │  ${chalk_1.default.magenta("Silver Bullet:")} 14:00-15:00 & 19:00-20:00`);
    console.log(chalk_1.default.magenta("  └─────────────────────────────────────────────────────────────────────┘"));
    console.log("");
    // OTE Analysis
    console.log(chalk_1.default.cyan("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.cyan("  │                      📐 OTE (OPTIMAL TRADE ENTRY)                   │"));
    console.log(chalk_1.default.cyan("  ├─────────────────────────────────────────────────────────────────────┤"));
    const oteQualityColor = result.ote.quality === "premium"
        ? chalk_1.default.green
        : result.ote.quality === "standard"
            ? chalk_1.default.yellow
            : chalk_1.default.red;
    console.log(`  │  ${chalk_1.default.dim("Quality:")} ${oteQualityColor(result.ote.quality.toUpperCase())}`);
    console.log(`  │  ${chalk_1.default.dim("Fib Level:")} ${(result.ote.fibLevel * 100).toFixed(1)}% (Optimal: 62-79%)`);
    console.log(`  │  ${chalk_1.default.dim("OTE Zone:")} ${formatPrice(result.ote.zone.low)} - ${formatPrice(result.ote.zone.high)}`);
    console.log(`  │  ${chalk_1.default.dim("Swing Range:")} ${formatPrice(result.ote.swingLow)} - ${formatPrice(result.ote.swingHigh)}`);
    console.log(chalk_1.default.cyan("  └─────────────────────────────────────────────────────────────────────┘"));
    console.log("");
    // Power of 3
    console.log(chalk_1.default.yellow("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.yellow("  │                      ⚡ POWER OF 3 (AMD MODEL)                      │"));
    console.log(chalk_1.default.yellow("  ├─────────────────────────────────────────────────────────────────────┤"));
    const phaseColor = result.powerOf3.phase === "accumulation"
        ? chalk_1.default.blue
        : result.powerOf3.phase === "manipulation"
            ? chalk_1.default.yellow
            : result.powerOf3.phase === "distribution"
                ? chalk_1.default.red
                : chalk_1.default.gray;
    console.log(`  │  ${chalk_1.default.dim("Current Phase:")} ${phaseColor(result.powerOf3.phase.toUpperCase())}`);
    if (result.powerOf3.asianRangeHigh > 0) {
        console.log(`  │  ${chalk_1.default.dim("Asian Range:")} ${formatPrice(result.powerOf3.asianRangeLow)} - ${formatPrice(result.powerOf3.asianRangeHigh)}`);
    }
    const manipColor = result.powerOf3.manipulation === "above" ? chalk_1.default.red : result.powerOf3.manipulation === "below" ? chalk_1.default.green : chalk_1.default.gray;
    console.log(`  │  ${chalk_1.default.dim("Manipulation:")} ${manipColor(result.powerOf3.manipulation)}`);
    const expectedColor = result.powerOf3.expectedMove === "bullish" ? chalk_1.default.green : result.powerOf3.expectedMove === "bearish" ? chalk_1.default.red : chalk_1.default.yellow;
    console.log(`  │  ${chalk_1.default.dim("Expected Move:")} ${expectedColor(result.powerOf3.expectedMove)}`);
    console.log(chalk_1.default.yellow("  └─────────────────────────────────────────────────────────────────────┘"));
    console.log("");
    // Market Structure
    console.log(chalk_1.default.blue("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.blue("  │                      📊 MARKET STRUCTURE                            │"));
    console.log(chalk_1.default.blue("  ├─────────────────────────────────────────────────────────────────────┤"));
    const trendColor = result.marketStructure.trend === "bullish" ? chalk_1.default.green : result.marketStructure.trend === "bearish" ? chalk_1.default.red : chalk_1.default.yellow;
    console.log(`  │  ${chalk_1.default.dim("Trend:")} ${trendColor(result.marketStructure.trend.toUpperCase())}`);
    if (result.marketStructure.lastBOS) {
        const bosColor = result.marketStructure.lastBOS.direction === "bullish" ? chalk_1.default.green : chalk_1.default.red;
        console.log(`  │  ${chalk_1.default.dim("Last BOS:")} ${bosColor(result.marketStructure.lastBOS.direction)} @ ${formatPrice(result.marketStructure.lastBOS.level)}`);
    }
    if (result.marketStructure.lastCHoCH) {
        const chochColor = result.marketStructure.lastCHoCH.direction === "bullish" ? chalk_1.default.green : chalk_1.default.red;
        console.log(`  │  ${chalk_1.default.dim("Last CHoCH:")} ${chochColor(result.marketStructure.lastCHoCH.direction)} @ ${formatPrice(result.marketStructure.lastCHoCH.level)}`);
    }
    console.log(`  │  ${chalk_1.default.dim("MSS (Shift):")} ${result.marketStructure.mss ? chalk_1.default.green("YES") : chalk_1.default.gray("NO")}`);
    const pdColor = result.premiumDiscount.zone === "discount" ? chalk_1.default.green : result.premiumDiscount.zone === "premium" ? chalk_1.default.red : chalk_1.default.yellow;
    console.log(`  │  ${chalk_1.default.dim("Zone:")} ${pdColor(result.premiumDiscount.zone)} (${result.premiumDiscount.fibLevel.toFixed(0)}%)`);
    console.log(chalk_1.default.blue("  └─────────────────────────────────────────────────────────────────────┘"));
    console.log("");
    // Displacement & Inducement
    console.log(chalk_1.default.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.gray("  │                      💥 DISPLACEMENT & INDUCEMENT                   │"));
    console.log(chalk_1.default.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
    if (result.displacement.detected) {
        const dispColor = result.displacement.direction === "bullish" ? chalk_1.default.green : chalk_1.default.red;
        console.log(`  │  ${chalk_1.default.dim("Displacement:")} ${dispColor(result.displacement.direction)} (${result.displacement.strength.toFixed(1)}x ATR)`);
        console.log(`  │  ${chalk_1.default.dim("FVG Created:")} ${result.displacement.fvgCreated ? chalk_1.default.green("YES") : chalk_1.default.gray("NO")}`);
    }
    else {
        console.log(`  │  ${chalk_1.default.dim("Displacement:")} ${chalk_1.default.gray("None detected")}`);
    }
    console.log(`  │`);
    console.log(`  │  ${chalk_1.default.dim("Inducements:")} ${result.inducements.length} found`);
    if (result.recentSweep) {
        const sweepColor = result.recentSweep.type === "buy_side" ? chalk_1.default.red : chalk_1.default.green;
        console.log(`  │  ${chalk_1.default.yellow("⚠ Recent Sweep:")} ${sweepColor(result.recentSweep.type)} @ ${formatPrice(result.recentSweep.level)}`);
    }
    console.log(chalk_1.default.gray("  └─────────────────────────────────────────────────────────────────────┘"));
    console.log("");
    // Breaker Blocks
    if (result.breakerBlocks.length > 0) {
        console.log(chalk_1.default.red("  ┌─────────────────────────────────────────────────────────────────────┐"));
        console.log(chalk_1.default.red("  │                      🔄 BREAKER BLOCKS                              │"));
        console.log(chalk_1.default.red("  ├─────────────────────────────────────────────────────────────────────┤"));
        result.breakerBlocks.slice(0, 4).forEach((bb) => {
            const bbColor = bb.type === "bullish" ? chalk_1.default.green : chalk_1.default.red;
            const isActive = result.activeBreaker === bb;
            const marker = isActive ? chalk_1.default.yellow(" ← ACTIVE") : "";
            console.log(`  │  ${bbColor(bb.type.padEnd(8))} ${formatPrice(bb.bottom)} - ${formatPrice(bb.top)} [${bb.strength}]${marker}`);
        });
        console.log(chalk_1.default.red("  └─────────────────────────────────────────────────────────────────────┘"));
        console.log("");
    }
    // Trade Setup
    if (result.signal !== "WAIT") {
        console.log(chalk_1.default.green("  ┌─────────────────────────────────────────────────────────────────────┐"));
        console.log(chalk_1.default.green("  │                      📍 TRADE SETUP                                 │"));
        console.log(chalk_1.default.green("  ├─────────────────────────────────────────────────────────────────────┤"));
        console.log(`  │  ${chalk_1.default.cyan("Entry Type:")} ${result.entry.type}`);
        console.log(`  │  ${chalk_1.default.yellow("Entry Zone:")} ${formatPrice(result.entry.zone.low)} - ${formatPrice(result.entry.zone.high)}`);
        console.log(`  │  ${chalk_1.default.yellow("Entry Price:")} ${chalk_1.default.white.bold(formatPrice(result.entry.price))}`);
        console.log(`  │  ${chalk_1.default.dim(result.entry.reason)}`);
        console.log(`  │`);
        console.log(`  │  ${chalk_1.default.red("Stop Loss:")} ${chalk_1.default.red.bold(formatPrice(result.stopLoss))} ${chalk_1.default.dim(`(${((Math.abs(result.entry.price - result.stopLoss) / result.entry.price) * 100).toFixed(2)}%)`)}`);
        console.log(`  │`);
        console.log(`  │  ${chalk_1.default.green("TP1:")} ${formatPrice(result.takeProfit1)} ${chalk_1.default.dim("(2R)")}`);
        console.log(`  │  ${chalk_1.default.green("TP2:")} ${formatPrice(result.takeProfit2)} ${chalk_1.default.dim("(3R)")}`);
        console.log(`  │  ${chalk_1.default.green("TP3:")} ${formatPrice(result.takeProfit3)} ${chalk_1.default.dim("(5R)")}`);
        console.log(`  │`);
        console.log(`  │  ${chalk_1.default.cyan("R:R Ratio:")} ${chalk_1.default.cyan.bold(result.riskRewardRatio.toFixed(1) + ":1")}`);
        console.log(chalk_1.default.green("  └─────────────────────────────────────────────────────────────────────┘"));
        console.log("");
    }
    // Confluence Factors
    if (result.confluenceFactors.length > 0) {
        console.log(chalk_1.default.cyan("  ┌─────────────────────────────────────────────────────────────────────┐"));
        console.log(chalk_1.default.cyan("  │                      ✓ CONFLUENCE FACTORS                           │"));
        console.log(chalk_1.default.cyan("  ├─────────────────────────────────────────────────────────────────────┤"));
        result.confluenceFactors.forEach((cf) => {
            console.log(`  │  ${chalk_1.default.green("✓")} ${cf}`);
        });
        console.log(chalk_1.default.cyan("  └─────────────────────────────────────────────────────────────────────┘"));
        console.log("");
    }
    // Reasoning
    console.log(chalk_1.default.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.gray("  │                      🔍 ANALYSIS                                    │"));
    console.log(chalk_1.default.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
    result.reasoning.forEach((r) => {
        console.log(`  │  ${chalk_1.default.dim("•")} ${r}`);
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
    // ICT Concepts Legend
    console.log(chalk_1.default.dim("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.dim("  │                      📚 ICT CONCEPTS GUIDE                          │"));
    console.log(chalk_1.default.dim("  ├─────────────────────────────────────────────────────────────────────┤"));
    console.log(chalk_1.default.dim("  │  OTE: Optimal Trade Entry (62-79% Fib retracement)                 │"));
    console.log(chalk_1.default.dim("  │  BOS: Break of Structure | CHoCH: Change of Character              │"));
    console.log(chalk_1.default.dim("  │  MSS: Market Structure Shift (trend reversal signal)               │"));
    console.log(chalk_1.default.dim("  │  AMD: Accumulation → Manipulation → Distribution                   │"));
    console.log(chalk_1.default.dim("  │  Silver Bullet: High-probability 1hr entry windows                 │"));
    console.log(chalk_1.default.dim("  │  Breaker: Failed OB that flips to support/resistance               │"));
    console.log(chalk_1.default.dim("  └─────────────────────────────────────────────────────────────────────┘"));
    console.log("");
    // Disclaimer
    console.log(chalk_1.default.dim.italic("  ⚠️  This is not financial advice. Always manage your risk and DYOR."));
    console.log("");
}
// ============================================
// RUNNER
// ============================================
async function runICTStrategy(symbol, interval = "1h") {
    try {
        const result = await generateICTSignal(symbol, interval);
        displayICTSignal(result);
        return result;
    }
    catch (error) {
        console.log("");
        console.log(chalk_1.default.red("  ╔═══════════════════════════════════════════════════════════════════════╗"));
        console.log(chalk_1.default.red("  ║                      ❌ ICT STRATEGY ERROR                             ║"));
        console.log(chalk_1.default.red("  ╚═══════════════════════════════════════════════════════════════════════╝"));
        console.log("");
        console.log(chalk_1.default.yellow(`  ⚠️  ${error.message || "An unexpected error occurred"}`));
        console.log("");
        return null;
    }
}
