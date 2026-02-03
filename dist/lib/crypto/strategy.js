"use strict";
/**
 * Smart Trend Confluence Strategy
 * High-probability trading strategy combining multiple factors
 *
 * Components:
 * 1. Multi-timeframe trend alignment
 * 2. EMA pullback detection
 * 3. Candlestick pattern recognition
 * 4. Key level detection (S/R, Order Blocks)
 * 5. Volume confirmation
 * 6. Confluence scoring system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCandlePattern = detectCandlePattern;
exports.detectKeyLevels = detectKeyLevels;
exports.detectPullback = detectPullback;
exports.analyzeVolume = analyzeVolume;
exports.calculateRSI = calculateRSI;
exports.analyzeTimeframe = analyzeTimeframe;
exports.calculateConfluenceScore = calculateConfluenceScore;
exports.generateStrategySignal = generateStrategySignal;
const data_fetcher_1 = require("./data-fetcher");
const analyzer_1 = require("./analyzer");
// ============================================
// CANDLE PATTERN DETECTION
// ============================================
/**
 * Calculate candle body and wick ratios
 */
function getCandleMetrics(candle) {
    const body = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const isBullish = candle.close > candle.open;
    return {
        body,
        totalRange,
        upperWick,
        lowerWick,
        isBullish,
        bodyRatio: totalRange > 0 ? body / totalRange : 0,
        upperWickRatio: totalRange > 0 ? upperWick / totalRange : 0,
        lowerWickRatio: totalRange > 0 ? lowerWick / totalRange : 0,
    };
}
/**
 * Detect candlestick patterns
 */
function detectCandlePattern(candles) {
    if (candles.length < 3) {
        return { type: "none", strength: 0, description: "Insufficient data" };
    }
    const current = candles[candles.length - 1];
    const previous = candles[candles.length - 2];
    const currentMetrics = getCandleMetrics(current);
    const previousMetrics = getCandleMetrics(previous);
    // Bullish Engulfing
    if (!previousMetrics.isBullish &&
        currentMetrics.isBullish &&
        current.open < previous.close &&
        current.close > previous.open &&
        currentMetrics.body > previousMetrics.body * 1.2) {
        const strength = Math.min(100, 60 + (currentMetrics.body / previousMetrics.body) * 20);
        return {
            type: "bullish_engulfing",
            strength,
            description: "Bullish engulfing - strong reversal signal",
        };
    }
    // Bearish Engulfing
    if (previousMetrics.isBullish &&
        !currentMetrics.isBullish &&
        current.open > previous.close &&
        current.close < previous.open &&
        currentMetrics.body > previousMetrics.body * 1.2) {
        const strength = Math.min(100, 60 + (currentMetrics.body / previousMetrics.body) * 20);
        return {
            type: "bearish_engulfing",
            strength,
            description: "Bearish engulfing - strong reversal signal",
        };
    }
    // Bullish Pin Bar (Hammer) - long lower wick, small body at top
    if (currentMetrics.lowerWickRatio > 0.6 &&
        currentMetrics.bodyRatio < 0.3 &&
        currentMetrics.upperWickRatio < 0.15) {
        const strength = Math.min(100, 50 + currentMetrics.lowerWickRatio * 50);
        return {
            type: "bullish_pinbar",
            strength,
            description: "Bullish pin bar - rejection of lower prices",
        };
    }
    // Bearish Pin Bar (Shooting Star) - long upper wick, small body at bottom
    if (currentMetrics.upperWickRatio > 0.6 &&
        currentMetrics.bodyRatio < 0.3 &&
        currentMetrics.lowerWickRatio < 0.15) {
        const strength = Math.min(100, 50 + currentMetrics.upperWickRatio * 50);
        return {
            type: "bearish_pinbar",
            strength,
            description: "Bearish pin bar - rejection of higher prices",
        };
    }
    // Bullish Hammer (in downtrend context)
    if (currentMetrics.lowerWickRatio > 0.5 &&
        currentMetrics.bodyRatio < 0.4 &&
        currentMetrics.isBullish) {
        const strength = Math.min(100, 40 + currentMetrics.lowerWickRatio * 40);
        return {
            type: "bullish_hammer",
            strength,
            description: "Bullish hammer - potential reversal",
        };
    }
    // Bearish Hammer (Hanging Man)
    if (currentMetrics.lowerWickRatio > 0.5 &&
        currentMetrics.bodyRatio < 0.4 &&
        !currentMetrics.isBullish) {
        const strength = Math.min(100, 40 + currentMetrics.lowerWickRatio * 40);
        return {
            type: "bearish_hammer",
            strength,
            description: "Bearish hanging man - potential reversal",
        };
    }
    // Doji - very small body
    if (currentMetrics.bodyRatio < 0.1) {
        return {
            type: "doji",
            strength: 30,
            description: "Doji - indecision, wait for confirmation",
        };
    }
    return { type: "none", strength: 0, description: "No significant pattern" };
}
// ============================================
// KEY LEVEL DETECTION
// ============================================
/**
 * Find support and resistance levels from price action
 */
function detectKeyLevels(candles, currentPrice) {
    const levels = [];
    const lookback = Math.min(100, candles.length);
    const tolerance = currentPrice * 0.005; // 0.5% tolerance for grouping
    // Find swing highs and lows
    const swingHighs = [];
    const swingLows = [];
    for (let i = 2; i < lookback - 2; i++) {
        const idx = candles.length - lookback + i;
        const candle = candles[idx];
        const prev1 = candles[idx - 1];
        const prev2 = candles[idx - 2];
        const next1 = candles[idx + 1];
        const next2 = candles[idx + 2];
        // Swing high
        if (candle.high > prev1.high &&
            candle.high > prev2.high &&
            candle.high > next1.high &&
            candle.high > next2.high) {
            swingHighs.push(candle.high);
        }
        // Swing low
        if (candle.low < prev1.low &&
            candle.low < prev2.low &&
            candle.low < next1.low &&
            candle.low < next2.low) {
            swingLows.push(candle.low);
        }
    }
    // Group similar levels and count touches
    const groupLevels = (prices, type) => {
        const grouped = [];
        for (const price of prices) {
            const existing = grouped.find((g) => Math.abs(g.price - price) < tolerance);
            if (existing) {
                existing.count++;
                existing.price = (existing.price + price) / 2; // Average
            }
            else {
                grouped.push({ price, count: 1 });
            }
        }
        return grouped
            .filter((g) => g.count >= 2) // At least 2 touches
            .map((g) => ({
            price: g.price,
            type,
            strength: Math.min(100, 30 + g.count * 20),
            distance: ((g.price - currentPrice) / currentPrice) * 100,
        }))
            .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))
            .slice(0, 3); // Top 3 nearest
    };
    const supports = groupLevels(swingLows, "support");
    const resistances = groupLevels(swingHighs, "resistance");
    // Detect Order Blocks (last opposite candle before strong move)
    const orderBlocks = detectOrderBlocks(candles, currentPrice);
    return [...supports, ...resistances, ...orderBlocks].sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
}
/**
 * Detect Order Blocks (ICT concept)
 * An order block is the last opposite candle before a strong move
 */
function detectOrderBlocks(candles, currentPrice) {
    const orderBlocks = [];
    const lookback = Math.min(50, candles.length - 5);
    for (let i = 5; i < lookback; i++) {
        const idx = candles.length - i;
        const candle = candles[idx];
        const nextCandles = candles.slice(idx + 1, idx + 4);
        if (nextCandles.length < 3)
            continue;
        const isBullishCandle = candle.close > candle.open;
        const moveAfter = nextCandles.reduce((sum, c) => sum + (c.close - c.open), 0);
        const avgBodySize = candles.slice(idx - 10, idx).reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / 10;
        // Bullish Order Block: bearish candle followed by strong bullish move
        if (!isBullishCandle && moveAfter > avgBodySize * 3) {
            const obLow = candle.low;
            const distance = ((obLow - currentPrice) / currentPrice) * 100;
            if (Math.abs(distance) < 5) {
                // Within 5%
                orderBlocks.push({
                    price: obLow,
                    type: "order_block_bullish",
                    strength: Math.min(100, 50 + (moveAfter / avgBodySize) * 10),
                    distance,
                });
            }
        }
        // Bearish Order Block: bullish candle followed by strong bearish move
        if (isBullishCandle && moveAfter < -avgBodySize * 3) {
            const obHigh = candle.high;
            const distance = ((obHigh - currentPrice) / currentPrice) * 100;
            if (Math.abs(distance) < 5) {
                orderBlocks.push({
                    price: obHigh,
                    type: "order_block_bearish",
                    strength: Math.min(100, 50 + (Math.abs(moveAfter) / avgBodySize) * 10),
                    distance,
                });
            }
        }
    }
    return orderBlocks.slice(0, 2); // Top 2 nearest
}
// ============================================
// PULLBACK DETECTION
// ============================================
/**
 * Detect if price is pulling back to EMA zone
 */
function detectPullback(currentPrice, ema10, ema20, trend) {
    const distanceToEMA10 = ((currentPrice - ema10) / ema10) * 100;
    const distanceToEMA20 = ((currentPrice - ema20) / ema20) * 100;
    // Check if price is in the "value zone" between EMA10 and EMA20
    const inEMAZone = (currentPrice >= Math.min(ema10, ema20) && currentPrice <= Math.max(ema10, ema20)) ||
        Math.abs(distanceToEMA10) < 0.3 ||
        Math.abs(distanceToEMA20) < 0.3;
    // Determine if this is a valid pullback
    let isPullback = false;
    let quality = "none";
    if (trend === "bullish") {
        // In uptrend, pullback is when price comes down to EMAs
        if (distanceToEMA10 <= 0.5 && distanceToEMA10 >= -1) {
            isPullback = true;
            quality = "optimal";
        }
        else if (distanceToEMA10 <= 1.5 && distanceToEMA10 >= -2) {
            isPullback = true;
            quality = "acceptable";
        }
        else if (distanceToEMA10 > 2) {
            quality = "extended";
        }
    }
    else if (trend === "bearish") {
        // In downtrend, pullback is when price comes up to EMAs
        if (distanceToEMA10 >= -0.5 && distanceToEMA10 <= 1) {
            isPullback = true;
            quality = "optimal";
        }
        else if (distanceToEMA10 >= -1.5 && distanceToEMA10 <= 2) {
            isPullback = true;
            quality = "acceptable";
        }
        else if (distanceToEMA10 < -2) {
            quality = "extended";
        }
    }
    return {
        isPullback,
        inEMAZone,
        distanceToEMA10,
        distanceToEMA20,
        quality,
    };
}
// ============================================
// VOLUME ANALYSIS
// ============================================
/**
 * Analyze volume patterns
 */
function analyzeVolume(candles) {
    const lookback = Math.min(20, candles.length);
    const recentCandles = candles.slice(-lookback);
    const volumes = recentCandles.map((c) => c.volume);
    const averageVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / averageVolume;
    // Determine volume trend (last 5 candles)
    const recentVolumes = volumes.slice(-5);
    let trend = "stable";
    if (recentVolumes.length >= 5) {
        const firstHalf = (recentVolumes[0] + recentVolumes[1]) / 2;
        const secondHalf = (recentVolumes[3] + recentVolumes[4]) / 2;
        if (secondHalf > firstHalf * 1.2) {
            trend = "increasing";
        }
        else if (secondHalf < firstHalf * 0.8) {
            trend = "decreasing";
        }
    }
    return {
        currentVolume,
        averageVolume,
        volumeRatio,
        isAboveAverage: volumeRatio > 1.0,
        trend,
    };
}
// ============================================
// RSI CALCULATION
// ============================================
/**
 * Calculate RSI
 */
function calculateRSI(candles, period = 14) {
    if (candles.length < period + 1)
        return 50;
    const changes = [];
    for (let i = 1; i < candles.length; i++) {
        changes.push(candles[i].close - candles[i - 1].close);
    }
    const recentChanges = changes.slice(-period);
    let gains = 0;
    let losses = 0;
    for (const change of recentChanges) {
        if (change > 0)
            gains += change;
        else
            losses += Math.abs(change);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0)
        return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}
// ============================================
// TIMEFRAME ANALYSIS
// ============================================
/**
 * Analyze a single timeframe
 */
function analyzeTimeframe(data, interval) {
    const closePrices = data.candles.map((c) => c.close);
    const ema10 = (0, analyzer_1.calculateEMA)(closePrices, 10);
    const ema20 = (0, analyzer_1.calculateEMA)(closePrices, 20);
    const ema50 = (0, analyzer_1.calculateEMA)(closePrices, 50);
    const ema200 = (0, analyzer_1.calculateEMA)(closePrices, 200);
    const currentEMA10 = ema10[ema10.length - 1] || 0;
    const currentEMA20 = ema20[ema20.length - 1] || 0;
    const currentEMA50 = ema50[ema50.length - 1] || 0;
    const currentEMA200 = ema200[ema200.length - 1] || 0;
    const emaTilt = (0, analyzer_1.calculateEMATilt)(ema10);
    const rsi = calculateRSI(data.candles);
    // Determine trend
    let trend = "neutral";
    if (currentEMA10 > currentEMA20 && currentEMA20 > currentEMA50) {
        trend = "bullish";
    }
    else if (currentEMA10 < currentEMA20 && currentEMA20 < currentEMA50) {
        trend = "bearish";
    }
    return {
        interval,
        trend,
        ema10: currentEMA10,
        ema20: currentEMA20,
        ema50: currentEMA50,
        ema200: currentEMA200,
        emaTilt,
        rsi,
    };
}
// ============================================
// CONFLUENCE SCORING
// ============================================
/**
 * Calculate confluence score
 */
function calculateConfluenceScore(htfAnalysis, ltfAnalysis, pullback, keyLevels, volume, candlePattern, direction) {
    const breakdown = {
        trendAlignment: 0,
        pullbackQuality: 0,
        keyLevel: 0,
        volume: 0,
        rsiRange: 0,
    };
    const factors = [];
    // 1. Trend Alignment (Max 30 points)
    const htfTrendMatch = (direction === "long" && htfAnalysis.trend === "bullish") ||
        (direction === "short" && htfAnalysis.trend === "bearish");
    const ltfTrendMatch = (direction === "long" && ltfAnalysis.trend === "bullish") ||
        (direction === "short" && ltfAnalysis.trend === "bearish");
    if (htfTrendMatch && ltfTrendMatch) {
        breakdown.trendAlignment = 30;
        factors.push("✓ Both timeframes aligned with trade direction");
    }
    else if (htfTrendMatch) {
        breakdown.trendAlignment = 20;
        factors.push("✓ Higher timeframe confirms direction");
    }
    else if (ltfTrendMatch) {
        breakdown.trendAlignment = 10;
        factors.push("○ Only lower timeframe confirms (weaker)");
    }
    else {
        factors.push("✗ Trend not aligned with trade direction");
    }
    // EMA structure bonus
    if (direction === "long" && htfAnalysis.ema50 > htfAnalysis.ema200) {
        breakdown.trendAlignment = Math.min(30, breakdown.trendAlignment + 5);
        factors.push("✓ EMA50 > EMA200 on higher TF (bullish structure)");
    }
    else if (direction === "short" && htfAnalysis.ema50 < htfAnalysis.ema200) {
        breakdown.trendAlignment = Math.min(30, breakdown.trendAlignment + 5);
        factors.push("✓ EMA50 < EMA200 on higher TF (bearish structure)");
    }
    // 2. Pullback Quality (Max 25 points)
    if (pullback.quality === "optimal") {
        breakdown.pullbackQuality = 25;
        factors.push("✓ Optimal pullback to EMA zone");
    }
    else if (pullback.quality === "acceptable") {
        breakdown.pullbackQuality = 15;
        factors.push("○ Acceptable pullback distance");
    }
    else if (pullback.quality === "extended") {
        breakdown.pullbackQuality = 5;
        factors.push("✗ Price extended from EMAs - wait for pullback");
    }
    // Candle pattern bonus
    if (candlePattern.type !== "none" && candlePattern.type !== "doji") {
        const patternBonus = Math.round(candlePattern.strength / 10);
        breakdown.pullbackQuality = Math.min(25, breakdown.pullbackQuality + patternBonus);
        factors.push(`✓ ${candlePattern.description}`);
    }
    // 3. Key Level (Max 20 points)
    const nearbyLevel = keyLevels.find((l) => Math.abs(l.distance) < 1.5);
    if (nearbyLevel) {
        const levelScore = Math.round((nearbyLevel.strength / 100) * 20);
        breakdown.keyLevel = levelScore;
        if (nearbyLevel.type.includes("order_block")) {
            factors.push(`✓ At ${nearbyLevel.type.replace(/_/g, " ")} ($${nearbyLevel.price.toFixed(2)})`);
        }
        else {
            factors.push(`✓ Near ${nearbyLevel.type} level ($${nearbyLevel.price.toFixed(2)}, ${Math.abs(nearbyLevel.distance).toFixed(1)}% away)`);
        }
    }
    else {
        factors.push("○ No significant key level nearby");
    }
    // 4. Volume (Max 15 points)
    if (volume.volumeRatio > 1.5) {
        breakdown.volume = 15;
        factors.push(`✓ Strong volume (${volume.volumeRatio.toFixed(1)}x average)`);
    }
    else if (volume.volumeRatio > 1.2) {
        breakdown.volume = 12;
        factors.push(`✓ Above average volume (${volume.volumeRatio.toFixed(1)}x)`);
    }
    else if (volume.volumeRatio > 1.0) {
        breakdown.volume = 8;
        factors.push(`○ Average volume (${volume.volumeRatio.toFixed(1)}x)`);
    }
    else {
        breakdown.volume = 3;
        factors.push(`✗ Below average volume (${volume.volumeRatio.toFixed(1)}x)`);
    }
    // Volume trend bonus
    if (volume.trend === "increasing") {
        breakdown.volume = Math.min(15, breakdown.volume + 3);
        factors.push("✓ Volume increasing");
    }
    // 5. RSI Range (Max 10 points)
    const ltfRSI = ltfAnalysis.rsi;
    if (direction === "long") {
        if (ltfRSI >= 30 && ltfRSI <= 50) {
            breakdown.rsiRange = 10;
            factors.push(`✓ RSI in optimal buy zone (${ltfRSI.toFixed(0)})`);
        }
        else if (ltfRSI >= 25 && ltfRSI <= 60) {
            breakdown.rsiRange = 7;
            factors.push(`○ RSI acceptable for long (${ltfRSI.toFixed(0)})`);
        }
        else if (ltfRSI > 70) {
            breakdown.rsiRange = 0;
            factors.push(`✗ RSI overbought (${ltfRSI.toFixed(0)}) - risky for long`);
        }
        else {
            breakdown.rsiRange = 4;
            factors.push(`○ RSI at ${ltfRSI.toFixed(0)}`);
        }
    }
    else {
        if (ltfRSI >= 50 && ltfRSI <= 70) {
            breakdown.rsiRange = 10;
            factors.push(`✓ RSI in optimal sell zone (${ltfRSI.toFixed(0)})`);
        }
        else if (ltfRSI >= 40 && ltfRSI <= 75) {
            breakdown.rsiRange = 7;
            factors.push(`○ RSI acceptable for short (${ltfRSI.toFixed(0)})`);
        }
        else if (ltfRSI < 30) {
            breakdown.rsiRange = 0;
            factors.push(`✗ RSI oversold (${ltfRSI.toFixed(0)}) - risky for short`);
        }
        else {
            breakdown.rsiRange = 4;
            factors.push(`○ RSI at ${ltfRSI.toFixed(0)}`);
        }
    }
    const total = breakdown.trendAlignment +
        breakdown.pullbackQuality +
        breakdown.keyLevel +
        breakdown.volume +
        breakdown.rsiRange;
    return {
        total,
        breakdown,
        meetsMinimum: total >= 70,
        factors,
    };
}
// ============================================
// MAIN STRATEGY FUNCTION
// ============================================
/**
 * Generate strategy signal with full confluence analysis
 */
async function generateStrategySignal(symbol, htfInterval = "4h", ltfInterval = "1h") {
    // Fetch data for both timeframes
    const [htfData, ltfData] = await Promise.all([
        (0, data_fetcher_1.fetchCryptoData)(symbol, htfInterval, 250),
        (0, data_fetcher_1.fetchCryptoData)(symbol, ltfInterval, 250),
    ]);
    const currentPrice = ltfData.currentPrice;
    const reasoning = [];
    const warnings = [];
    // Analyze both timeframes
    const htfAnalysis = analyzeTimeframe(htfData, htfInterval);
    const ltfAnalysis = analyzeTimeframe(ltfData, ltfInterval);
    // Detect components
    const candlePattern = detectCandlePattern(ltfData.candles);
    const keyLevels = detectKeyLevels(ltfData.candles, currentPrice);
    const volume = analyzeVolume(ltfData.candles);
    // Determine potential direction based on higher timeframe
    let direction = "none";
    if (htfAnalysis.trend === "bullish" && htfAnalysis.ema50 > htfAnalysis.ema200) {
        direction = "long";
        reasoning.push(`Higher TF (${htfInterval}) shows bullish trend`);
    }
    else if (htfAnalysis.trend === "bearish" && htfAnalysis.ema50 < htfAnalysis.ema200) {
        direction = "short";
        reasoning.push(`Higher TF (${htfInterval}) shows bearish trend`);
    }
    else {
        reasoning.push(`Higher TF (${htfInterval}) trend unclear - waiting for direction`);
    }
    // Detect pullback
    const pullback = detectPullback(currentPrice, ltfAnalysis.ema10, ltfAnalysis.ema20, ltfAnalysis.trend);
    // Calculate confluence score
    const score = direction !== "none"
        ? calculateConfluenceScore(htfAnalysis, ltfAnalysis, pullback, keyLevels, volume, candlePattern, direction)
        : {
            total: 0,
            breakdown: { trendAlignment: 0, pullbackQuality: 0, keyLevel: 0, volume: 0, rsiRange: 0 },
            meetsMinimum: false,
            factors: ["No clear direction from higher timeframe"],
        };
    // Calculate entry, stop loss, take profits
    let entry = currentPrice;
    let stopLoss = 0;
    let takeProfit1 = 0;
    let takeProfit2 = 0;
    let riskRewardRatio = 0;
    if (direction === "long") {
        // Stop loss below EMA20 or recent swing low
        const recentLow = Math.min(...ltfData.candles.slice(-10).map((c) => c.low));
        stopLoss = Math.min(ltfAnalysis.ema20 * 0.995, recentLow);
        const risk = entry - stopLoss;
        takeProfit1 = entry + risk * 1.5;
        takeProfit2 = entry + risk * 2.5;
        riskRewardRatio = 2.5;
    }
    else if (direction === "short") {
        // Stop loss above EMA20 or recent swing high
        const recentHigh = Math.max(...ltfData.candles.slice(-10).map((c) => c.high));
        stopLoss = Math.max(ltfAnalysis.ema20 * 1.005, recentHigh);
        const risk = stopLoss - entry;
        takeProfit1 = entry - risk * 1.5;
        takeProfit2 = entry - risk * 2.5;
        riskRewardRatio = 2.5;
    }
    // Determine final signal
    let signal = "NO_TRADE";
    if (direction !== "none" && score.meetsMinimum) {
        if (score.total >= 85) {
            signal = direction === "long" ? "STRONG_BUY" : "STRONG_SELL";
            reasoning.push(`Strong confluence score (${score.total}/100)`);
        }
        else if (score.total >= 70) {
            signal = direction === "long" ? "BUY" : "SELL";
            reasoning.push(`Good confluence score (${score.total}/100)`);
        }
    }
    else if (direction !== "none" && score.total >= 50) {
        signal = "WAIT";
        reasoning.push(`Confluence score below minimum (${score.total}/100) - wait for better setup`);
    }
    // Add warnings
    if (htfAnalysis.rsi > 75) {
        warnings.push("Higher TF RSI overbought - caution on longs");
    }
    else if (htfAnalysis.rsi < 25) {
        warnings.push("Higher TF RSI oversold - caution on shorts");
    }
    if (volume.volumeRatio < 0.8) {
        warnings.push("Low volume - signals may be less reliable");
    }
    if (pullback.quality === "extended") {
        warnings.push("Price extended from EMAs - consider waiting for pullback");
    }
    // Check for conflicting signals
    if (htfAnalysis.trend !== ltfAnalysis.trend && ltfAnalysis.trend !== "neutral") {
        warnings.push(`Timeframe conflict: ${htfInterval} is ${htfAnalysis.trend}, ${ltfInterval} is ${ltfAnalysis.trend}`);
    }
    return {
        signal,
        score,
        direction,
        entry,
        stopLoss,
        takeProfit1,
        takeProfit2,
        riskRewardRatio,
        higherTimeframe: htfAnalysis,
        lowerTimeframe: ltfAnalysis,
        pullback,
        candlePattern,
        keyLevels,
        volume,
        reasoning,
        warnings,
    };
}
