"use strict";
/* global fetch */
/**
 * Technical Indicators Module
 * Comprehensive technical analysis calculations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSMA = calculateSMA;
exports.calculateEMA = calculateEMA;
exports.calculateRSI = calculateRSI;
exports.calculateMACD = calculateMACD;
exports.calculateBollingerBands = calculateBollingerBands;
exports.calculateATR = calculateATR;
exports.analyzeVolume = analyzeVolume;
exports.calculateSupportResistance = calculateSupportResistance;
exports.analyzeTrend = analyzeTrend;
// ============================================
// MOVING AVERAGES
// ============================================
/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices, period) {
    if (prices.length < period)
        return [];
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += prices[i - j];
        }
        sma.push(sum / period);
    }
    return sma;
}
/**
 * Calculate Exponential Moving Average
 */
function calculateEMA(prices, period) {
    if (prices.length < period)
        return [];
    const ema = [];
    const multiplier = 2 / (period + 1);
    // First EMA is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += prices[i];
    }
    ema.push(sum / period);
    for (let i = period; i < prices.length; i++) {
        const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
        ema.push(currentEMA);
    }
    return ema;
}
/**
 * Calculate RSI
 */
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) {
        return { values: [], current: 50, condition: "neutral", divergence: "none" };
    }
    const gains = [];
    const losses = [];
    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }
    const rsiValues = [];
    // First average
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = 100 - 100 / (1 + rs);
        rsiValues.push(rsi);
    }
    const current = rsiValues[rsiValues.length - 1] || 50;
    // Determine condition
    let condition = "neutral";
    if (current >= 70)
        condition = "overbought";
    else if (current <= 30)
        condition = "oversold";
    // Check for divergence (simplified)
    let divergence = "none";
    if (rsiValues.length >= 10) {
        const recentRSI = rsiValues.slice(-10);
        const recentPrices = prices.slice(-10);
        const rsiTrend = recentRSI[recentRSI.length - 1] - recentRSI[0];
        const priceTrend = recentPrices[recentPrices.length - 1] - recentPrices[0];
        // Bullish divergence: price making lower lows, RSI making higher lows
        if (priceTrend < 0 && rsiTrend > 0 && current < 40) {
            divergence = "bullish";
        }
        // Bearish divergence: price making higher highs, RSI making lower highs
        if (priceTrend > 0 && rsiTrend < 0 && current > 60) {
            divergence = "bearish";
        }
    }
    return { values: rsiValues, current, condition, divergence };
}
/**
 * Calculate MACD
 */
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const ema12 = calculateEMA(prices, fastPeriod);
    const ema26 = calculateEMA(prices, slowPeriod);
    // Align arrays
    const offset = slowPeriod - fastPeriod;
    const macdLine = [];
    for (let i = 0; i < ema26.length; i++) {
        macdLine.push(ema12[i + offset] - ema26[i]);
    }
    const signalLine = calculateEMA(macdLine, signalPeriod);
    // Align MACD and Signal
    const signalOffset = signalPeriod - 1;
    const histogram = [];
    for (let i = 0; i < signalLine.length; i++) {
        histogram.push(macdLine[i + signalOffset] - signalLine[i]);
    }
    const current = {
        macd: macdLine[macdLine.length - 1] || 0,
        signal: signalLine[signalLine.length - 1] || 0,
        histogram: histogram[histogram.length - 1] || 0,
    };
    // Detect crossover
    let crossover = "none";
    if (histogram.length >= 2) {
        const prevHist = histogram[histogram.length - 2];
        const currHist = histogram[histogram.length - 1];
        if (prevHist <= 0 && currHist > 0)
            crossover = "bullish";
        if (prevHist >= 0 && currHist < 0)
            crossover = "bearish";
    }
    // Momentum direction
    let momentum = "neutral";
    if (histogram.length >= 3) {
        const recent = histogram.slice(-3);
        if (recent[2] > recent[1] && recent[1] > recent[0])
            momentum = "increasing";
        if (recent[2] < recent[1] && recent[1] < recent[0])
            momentum = "decreasing";
    }
    return { macdLine, signalLine, histogram, current, crossover, momentum };
}
/**
 * Calculate Bollinger Bands
 */
function calculateBollingerBands(prices, period = 20, stdDev = 2) {
    const middle = calculateSMA(prices, period);
    const upper = [];
    const lower = [];
    for (let i = period - 1; i < prices.length; i++) {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = middle[i - period + 1];
        // Calculate standard deviation
        const squaredDiffs = slice.map((p) => Math.pow(p - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        const std = Math.sqrt(variance);
        upper.push(mean + stdDev * std);
        lower.push(mean - stdDev * std);
    }
    const currentUpper = upper[upper.length - 1] || 0;
    const currentMiddle = middle[middle.length - 1] || 0;
    const currentLower = lower[lower.length - 1] || 0;
    const currentPrice = prices[prices.length - 1];
    // Bandwidth (volatility measure)
    const bandwidth = ((currentUpper - currentLower) / currentMiddle) * 100;
    // %B (where price is within the bands)
    const percentB = ((currentPrice - currentLower) / (currentUpper - currentLower)) * 100;
    // Squeeze detection (low volatility)
    const squeeze = bandwidth < 5; // Adjust threshold as needed
    // Price position
    let pricePosition;
    if (currentPrice > currentUpper)
        pricePosition = "above_upper";
    else if (currentPrice > currentMiddle)
        pricePosition = "above_middle";
    else if (currentPrice > currentLower)
        pricePosition = "below_middle";
    else
        pricePosition = "below_lower";
    return {
        upper,
        middle,
        lower,
        current: {
            upper: currentUpper,
            middle: currentMiddle,
            lower: currentLower,
            bandwidth,
            percentB,
        },
        squeeze,
        pricePosition,
    };
}
/**
 * Calculate ATR
 */
function calculateATR(candles, period = 14) {
    if (candles.length < period + 1) {
        return { values: [], current: 0, volatility: "medium", percentOfPrice: 0 };
    }
    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trueRanges.push(tr);
    }
    // Calculate ATR using EMA
    const atrValues = [];
    let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    atrValues.push(atr);
    for (let i = period; i < trueRanges.length; i++) {
        atr = (atr * (period - 1) + trueRanges[i]) / period;
        atrValues.push(atr);
    }
    const current = atrValues[atrValues.length - 1] || 0;
    const currentPrice = candles[candles.length - 1].close;
    const percentOfPrice = (current / currentPrice) * 100;
    // Volatility classification
    let volatility = "medium";
    if (percentOfPrice < 1.5)
        volatility = "low";
    else if (percentOfPrice > 3)
        volatility = "high";
    return { values: atrValues, current, volatility, percentOfPrice };
}
/**
 * Analyze Volume
 */
function analyzeVolume(candles, period = 20) {
    if (candles.length < period) {
        return {
            averageVolume: 0,
            currentVolume: 0,
            volumeRatio: 1,
            trend: "stable",
            confirmation: true,
        };
    }
    const volumes = candles.map((c) => c.volume);
    const recentVolumes = volumes.slice(-period);
    const averageVolume = recentVolumes.reduce((a, b) => a + b, 0) / period;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / averageVolume;
    // Volume trend
    const recentVols = volumes.slice(-5);
    const oldVols = volumes.slice(-10, -5);
    const recentAvg = recentVols.reduce((a, b) => a + b, 0) / 5;
    const oldAvg = oldVols.reduce((a, b) => a + b, 0) / 5;
    let trend = "stable";
    if (recentAvg > oldAvg * 1.2)
        trend = "increasing";
    else if (recentAvg < oldAvg * 0.8)
        trend = "decreasing";
    // Check if volume confirms price movement
    const priceChange = candles[candles.length - 1].close - candles[candles.length - 2].close;
    const confirmation = (priceChange > 0 && volumeRatio > 1) || (priceChange < 0 && volumeRatio > 1);
    return { averageVolume, currentVolume, volumeRatio, trend, confirmation };
}
/**
 * Calculate Support and Resistance levels
 */
function calculateSupportResistance(candles, lookback = 50) {
    const prices = candles.slice(-lookback);
    const currentPrice = candles[candles.length - 1].close;
    // Find pivot points (local highs and lows)
    const pivotHighs = [];
    const pivotLows = [];
    for (let i = 2; i < prices.length - 2; i++) {
        const high = prices[i].high;
        const low = prices[i].low;
        // Pivot high
        if (high > prices[i - 1].high &&
            high > prices[i - 2].high &&
            high > prices[i + 1].high &&
            high > prices[i + 2].high) {
            pivotHighs.push(high);
        }
        // Pivot low
        if (low < prices[i - 1].low &&
            low < prices[i - 2].low &&
            low < prices[i + 1].low &&
            low < prices[i + 2].low) {
            pivotLows.push(low);
        }
    }
    // Cluster nearby levels (within 1%)
    const clusterLevels = (levels) => {
        if (levels.length === 0)
            return [];
        levels.sort((a, b) => a - b);
        const clustered = [];
        let cluster = [levels[0]];
        for (let i = 1; i < levels.length; i++) {
            if ((levels[i] - levels[i - 1]) / levels[i - 1] < 0.01) {
                cluster.push(levels[i]);
            }
            else {
                clustered.push(cluster.reduce((a, b) => a + b, 0) / cluster.length);
                cluster = [levels[i]];
            }
        }
        clustered.push(cluster.reduce((a, b) => a + b, 0) / cluster.length);
        return clustered;
    };
    const resistances = clusterLevels(pivotHighs).filter((r) => r > currentPrice);
    const supports = clusterLevels(pivotLows).filter((s) => s < currentPrice);
    const nearestResistance = resistances.length > 0 ? Math.min(...resistances) : currentPrice * 1.05;
    const nearestSupport = supports.length > 0 ? Math.max(...supports) : currentPrice * 0.95;
    const distanceToResistance = ((nearestResistance - currentPrice) / currentPrice) * 100;
    const distanceToSupport = ((currentPrice - nearestSupport) / currentPrice) * 100;
    return {
        supports: supports.slice(-3),
        resistances: resistances.slice(0, 3),
        nearestSupport,
        nearestResistance,
        distanceToSupport,
        distanceToResistance,
    };
}
/**
 * Analyze trend structure
 */
function analyzeTrend(candles) {
    if (candles.length < 20) {
        return {
            direction: "sideways",
            strength: 50,
            phase: "consolidating",
            higherHighs: false,
            higherLows: false,
        };
    }
    const recent = candles.slice(-20);
    const highs = recent.map((c) => c.high);
    const lows = recent.map((c) => c.low);
    // Check for higher highs and higher lows
    let hhCount = 0;
    let hlCount = 0;
    let lhCount = 0;
    let llCount = 0;
    for (let i = 5; i < highs.length; i += 5) {
        const prevHigh = Math.max(...highs.slice(i - 5, i));
        const currHigh = Math.max(...highs.slice(i, Math.min(i + 5, highs.length)));
        const prevLow = Math.min(...lows.slice(i - 5, i));
        const currLow = Math.min(...lows.slice(i, Math.min(i + 5, lows.length)));
        if (currHigh > prevHigh)
            hhCount++;
        else
            lhCount++;
        if (currLow > prevLow)
            hlCount++;
        else
            llCount++;
    }
    const higherHighs = hhCount > lhCount;
    const higherLows = hlCount > llCount;
    // Determine direction
    let direction = "sideways";
    if (higherHighs && higherLows)
        direction = "bullish";
    else if (!higherHighs && !higherLows)
        direction = "bearish";
    // Calculate strength
    const totalSwings = hhCount + lhCount + hlCount + llCount;
    const trendingSwings = direction === "bullish" ? hhCount + hlCount : lhCount + llCount;
    const strength = totalSwings > 0 ? Math.round((trendingSwings / totalSwings) * 100) : 50;
    // Determine phase
    const prices = candles.slice(-10).map((c) => c.close);
    const priceRange = (Math.max(...prices) - Math.min(...prices)) / prices[0];
    let phase = "trending";
    if (priceRange < 0.02)
        phase = "consolidating";
    else if ((direction === "bullish" && prices[prices.length - 1] < prices[0]) ||
        (direction === "bearish" && prices[prices.length - 1] > prices[0])) {
        phase = "reversing";
    }
    return { direction, strength, phase, higherHighs, higherLows };
}
