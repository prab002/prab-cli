"use strict";
/**
 * Technical Analysis Module
 * Calculates EMA and generates trading signals
 * Primary indicators: EMA 10 and EMA 20 with tilt detection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEMA = calculateEMA;
exports.calculateAllEMAs = calculateAllEMAs;
exports.calculateEMATilt = calculateEMATilt;
exports.checkMarketConditions = checkMarketConditions;
exports.calculateIndicators = calculateIndicators;
exports.generateSignal = generateSignal;
exports.formatSignalSummary = formatSignalSummary;
/**
 * Calculate Exponential Moving Average
 */
function calculateEMA(prices, period) {
    if (prices.length < period) {
        return [];
    }
    const ema = [];
    const multiplier = 2 / (period + 1);
    // First EMA value is SMA of first 'period' prices
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += prices[i];
    }
    ema.push(sum / period);
    // Calculate EMA for remaining prices
    for (let i = period; i < prices.length; i++) {
        const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
        ema.push(currentEMA);
    }
    return ema;
}
/**
 * Calculate all EMA values (primary: 10 and 20)
 */
function calculateAllEMAs(candles) {
    const closePrices = candles.map((c) => c.close);
    return {
        ema10: calculateEMA(closePrices, 10),
        ema20: calculateEMA(closePrices, 20),
        ema50: calculateEMA(closePrices, 50),
        ema200: calculateEMA(closePrices, 200),
    };
}
/**
 * Calculate EMA tilt/slope
 * Looks at recent EMA values to determine direction and strength
 * @param emaValues - Array of EMA values
 * @param lookback - Number of periods to analyze (default 3)
 * @returns Tilt information including direction, angle, and strength
 */
function calculateEMATilt(emaValues, lookback = 3) {
    if (emaValues.length < lookback + 1) {
        return { direction: "flat", angle: 0, strength: "LOW", slopePercent: 0 };
    }
    const current = emaValues[emaValues.length - 1];
    const previous = emaValues[emaValues.length - 1 - lookback];
    // Calculate percentage change (slope)
    const slopePercent = ((current - previous) / previous) * 100;
    // Normalize to angle-like value (-100 to 100)
    // Multiply by factor to make small changes more visible
    const angle = Math.max(-100, Math.min(100, slopePercent * 50));
    // Determine direction
    let direction;
    if (slopePercent > 0.05) {
        direction = "bullish";
    }
    else if (slopePercent < -0.05) {
        direction = "bearish";
    }
    else {
        direction = "flat";
    }
    // Determine strength based on slope magnitude
    let strength;
    const absSlope = Math.abs(slopePercent);
    if (absSlope > 0.3) {
        strength = "HIGH";
    }
    else if (absSlope > 0.1) {
        strength = "MEDIUM";
    }
    else {
        strength = "LOW";
    }
    return { direction, angle, strength, slopePercent };
}
/**
 * Check market conditions for trade validity
 * Detects sideways markets, EMA intersections, and validates EMA angle
 * Based on visual analysis: good trades have clear EMA separation and optimal angle
 *
 * @param ema10Values - Array of EMA10 values
 * @param ema20Values - Array of EMA20 values
 * @param ema10Tilt - EMA10 tilt information
 * @param ema20Tilt - EMA20 tilt information
 * @param currentPrice - Current price
 * @returns Market condition check result
 */
function checkMarketConditions(ema10Values, ema20Values, ema10Tilt, ema20Tilt, currentPrice) {
    const currentEMA10 = ema10Values[ema10Values.length - 1];
    const currentEMA20 = ema20Values[ema20Values.length - 1];
    // Calculate EMA separation percentage
    const emaSeparationPercent = Math.abs((currentEMA10 - currentEMA20) / currentEMA20) * 100;
    // Check for EMA intersection/convergence (EMAs too close together)
    // If separation is less than 0.15%, EMAs are effectively intersecting
    const emasIntersecting = emaSeparationPercent < 0.15;
    // Check for sideways market: EMAs are flat or diverging in different directions
    // Sideways when: both tilts are LOW strength, or tilts are in opposite directions
    const bothTiltsFlat = ema10Tilt.strength === "LOW" && ema20Tilt.strength === "LOW";
    const tiltsConflicting = ema10Tilt.direction !== "flat" &&
        ema20Tilt.direction !== "flat" &&
        ema10Tilt.direction !== ema20Tilt.direction;
    // Check for recent crossovers (looking back 5 candles) - indicates choppy market
    let recentCrossoverCount = 0;
    const lookback = Math.min(5, ema10Values.length - 1, ema20Values.length - 1);
    for (let i = 1; i <= lookback; i++) {
        const prevIdx = ema10Values.length - 1 - i;
        const currIdx = ema10Values.length - i;
        if (prevIdx >= 0 && currIdx >= 0) {
            const prevAbove = ema10Values[prevIdx] > ema20Values[prevIdx];
            const currAbove = ema10Values[currIdx] > ema20Values[currIdx];
            if (prevAbove !== currAbove) {
                recentCrossoverCount++;
            }
        }
    }
    // Multiple crossovers indicate choppy/sideways market
    const multipleCrossovers = recentCrossoverCount >= 2;
    // Check if EMA10 angle is in optimal range for trading
    // - Not too flat (abs slope < 0.05%) = no trend
    // - Not too steep (abs slope > 1.5%) = extreme/overextended
    // Optimal range: 0.1% to 0.8% slope (good momentum without being extreme)
    const absSlope = Math.abs(ema10Tilt.slopePercent);
    const tooFlat = absSlope < 0.08;
    const tooSteep = absSlope > 1.2;
    const emaAngleInOptimalRange = !tooFlat && !tooSteep;
    // Determine if market is sideways
    const isSideways = bothTiltsFlat || tiltsConflicting || multipleCrossovers || (emasIntersecting && !emaAngleInOptimalRange);
    // Final decision: should we trade?
    let shouldTrade = true;
    let reason = "Market conditions favorable for trading";
    if (emasIntersecting) {
        shouldTrade = false;
        reason = `EMAs intersecting (separation: ${emaSeparationPercent.toFixed(3)}%) - wait for clear trend`;
    }
    else if (isSideways) {
        shouldTrade = false;
        if (multipleCrossovers) {
            reason = "Choppy market - multiple EMA crossovers detected, wait for trend to establish";
        }
        else if (tiltsConflicting) {
            reason = "EMAs diverging in opposite directions - conflicting signals, wait for alignment";
        }
        else {
            reason = "Sideways market - EMAs showing no clear direction, wait for breakout";
        }
    }
    else if (tooFlat) {
        shouldTrade = false;
        reason = `EMA10 angle too flat (${ema10Tilt.slopePercent.toFixed(3)}%) - no momentum, wait for trend`;
    }
    else if (tooSteep) {
        shouldTrade = false;
        reason = `EMA10 angle too steep (${ema10Tilt.slopePercent.toFixed(3)}%) - overextended, wait for pullback`;
    }
    return {
        isSideways,
        emasIntersecting,
        emaSeparationPercent,
        emaAngleInOptimalRange,
        shouldTrade,
        reason
    };
}
/**
 * Check if EMA 10 is tilting towards the candle (high probability setup)
 * @param currentPrice - Current candle close price
 * @param ema10 - Current EMA 10 value
 * @param ema10Tilt - EMA 10 tilt information
 * @param ema20 - Current EMA 20 value
 * @returns true if high probability setup detected
 */
function isHighProbabilitySetup(currentPrice, ema10, ema10Tilt, ema20) {
    const priceAboveEMA10 = currentPrice > ema10;
    const priceAboveEMA20 = currentPrice > ema20;
    const ema10AboveEMA20 = ema10 > ema20;
    // High probability BUY: Price above EMAs, EMA10 > EMA20, EMA10 tilting up
    if (priceAboveEMA10 && ema10AboveEMA20 && ema10Tilt.direction === "bullish") {
        return true;
    }
    // High probability SELL: Price below EMAs, EMA10 < EMA20, EMA10 tilting down
    if (!priceAboveEMA10 && !ema10AboveEMA20 && ema10Tilt.direction === "bearish") {
        return true;
    }
    // Reversal setup: Price touches EMA10 from above/below with strong tilt
    const distanceToEMA10 = Math.abs((currentPrice - ema10) / ema10) * 100;
    if (distanceToEMA10 < 0.5 && ema10Tilt.strength === "HIGH") {
        return true;
    }
    return false;
}
/**
 * Detect EMA crossover patterns (EMA10 vs EMA20)
 */
function detectCrossover(shortEMA, longEMA, lookback = 3) {
    if (shortEMA.length < lookback + 1 || longEMA.length < lookback + 1) {
        return "none";
    }
    const currentShort = shortEMA[shortEMA.length - 1];
    const currentLong = longEMA[longEMA.length - 1];
    const prevShort = shortEMA[shortEMA.length - lookback];
    const prevLong = longEMA[longEMA.length - lookback];
    // Golden cross: EMA10 crosses above EMA20
    if (prevShort <= prevLong && currentShort > currentLong) {
        return "golden";
    }
    // Death cross: EMA10 crosses below EMA20
    if (prevShort >= prevLong && currentShort < currentLong) {
        return "death";
    }
    return "none";
}
/**
 * Determine price position relative to EMAs
 */
function getPriceVsEMA(currentPrice, ema10, ema20, ema50) {
    const aboveCount = [ema10, ema20, ema50].filter((ema) => currentPrice > ema).length;
    if (aboveCount === 3)
        return "above_all";
    if (aboveCount === 0)
        return "below_all";
    return "mixed";
}
/**
 * Calculate trend strength based on EMA alignment and tilt
 */
function calculateTrendStrength(currentPrice, ema10, ema20, ema50, ema200, ema10Tilt) {
    let strength = 0;
    // Check EMA alignment (bullish: 10 > 20 > 50 > 200)
    if (ema10 > ema20)
        strength += 15;
    if (ema20 > ema50)
        strength += 15;
    if (ema200 !== undefined && ema50 > ema200)
        strength += 15;
    // Check price vs EMAs
    if (currentPrice > ema10)
        strength += 10;
    if (currentPrice > ema20)
        strength += 10;
    if (currentPrice > ema50)
        strength += 10;
    if (ema200 !== undefined && currentPrice > ema200)
        strength += 10;
    // Tilt adds significant strength
    if (ema10Tilt.strength === "HIGH")
        strength += 15;
    else if (ema10Tilt.strength === "MEDIUM")
        strength += 10;
    else
        strength += 5;
    return Math.min(strength, 100);
}
/**
 * Determine overall probability level
 */
function determineProbability(ema10Tilt, ema20Tilt, crossover, priceVsEMA) {
    let score = 0;
    // Strong tilt in same direction = high probability
    if (ema10Tilt.strength === "HIGH")
        score += 3;
    else if (ema10Tilt.strength === "MEDIUM")
        score += 2;
    else
        score += 1;
    if (ema20Tilt.strength === "HIGH")
        score += 2;
    else if (ema20Tilt.strength === "MEDIUM")
        score += 1;
    // Tilts aligned = higher probability
    if (ema10Tilt.direction === ema20Tilt.direction && ema10Tilt.direction !== "flat") {
        score += 2;
    }
    // Recent crossover = higher probability
    if (crossover !== "none")
        score += 2;
    // Clear price position = higher probability
    if (priceVsEMA !== "mixed")
        score += 1;
    if (score >= 7)
        return "HIGH";
    if (score >= 4)
        return "MEDIUM";
    return "LOW";
}
/**
 * Calculate technical indicators
 */
function calculateIndicators(data) {
    const ema = calculateAllEMAs(data.candles);
    const currentEMA10 = ema.ema10[ema.ema10.length - 1] || 0;
    const currentEMA20 = ema.ema20[ema.ema20.length - 1] || 0;
    const currentEMA50 = ema.ema50[ema.ema50.length - 1] || 0;
    const currentEMA200 = ema.ema200.length > 0 ? ema.ema200[ema.ema200.length - 1] : undefined;
    // Calculate EMA tilts (key indicator for probability)
    const ema10Tilt = calculateEMATilt(ema.ema10);
    const ema20Tilt = calculateEMATilt(ema.ema20);
    // Detect crossover between EMA10 and EMA20
    const emaCrossover = detectCrossover(ema.ema10, ema.ema20);
    // Price vs EMA position
    const priceVsEMA = getPriceVsEMA(data.currentPrice, currentEMA10, currentEMA20, currentEMA50);
    // Determine trend based on EMA alignment
    let trend;
    if (currentEMA10 > currentEMA20 && currentEMA20 > currentEMA50) {
        trend = "bullish";
    }
    else if (currentEMA10 < currentEMA20 && currentEMA20 < currentEMA50) {
        trend = "bearish";
    }
    else {
        trend = "neutral";
    }
    // Calculate trend strength (includes tilt)
    const trendStrength = calculateTrendStrength(data.currentPrice, currentEMA10, currentEMA20, currentEMA50, currentEMA200, ema10Tilt);
    // Determine probability level
    const probability = determineProbability(ema10Tilt, ema20Tilt, emaCrossover, priceVsEMA);
    // Check for high probability alert trigger
    const alertTrigger = isHighProbabilitySetup(data.currentPrice, currentEMA10, ema10Tilt, currentEMA20);
    // Check market conditions (sideways, intersecting EMAs, angle validation)
    const marketCondition = checkMarketConditions(ema.ema10, ema.ema20, ema10Tilt, ema20Tilt, data.currentPrice);
    return {
        ema,
        currentEMA10,
        currentEMA20,
        currentEMA50,
        currentEMA200: currentEMA200 || 0,
        // Legacy aliases for compatibility
        currentEMA9: currentEMA10,
        currentEMA21: currentEMA20,
        ema10Tilt,
        ema20Tilt,
        emaCrossover,
        priceVsEMA,
        trend,
        trendStrength,
        probability,
        alertTrigger,
        marketCondition,
    };
}
/**
 * Generate trading signal based on EMA 10/20 analysis with tilt detection
 * Now includes market condition filtering to avoid sideways/choppy markets
 */
function generateSignal(data) {
    const indicators = calculateIndicators(data);
    const reasoning = [];
    let signal = "HOLD";
    let confidence = 50;
    let stopLoss = 3;
    let takeProfit = 6;
    const { ema10Tilt, ema20Tilt, alertTrigger, probability, marketCondition } = indicators;
    // === MARKET CONDITION CHECK (Priority Filter) ===
    // Check for sideways market, intersecting EMAs, or suboptimal EMA angle
    if (!marketCondition.shouldTrade) {
        reasoning.push(`⚠️ ${marketCondition.reason}`);
        // Add specific details about the market condition
        if (marketCondition.emasIntersecting) {
            reasoning.push(`EMA separation: ${marketCondition.emaSeparationPercent.toFixed(3)}% (too close)`);
        }
        if (marketCondition.isSideways) {
            reasoning.push("Market showing ranging/sideways behavior");
        }
        if (!marketCondition.emaAngleInOptimalRange) {
            const absSlope = Math.abs(ema10Tilt.slopePercent);
            if (absSlope < 0.08) {
                reasoning.push(`EMA10 slope: ${ema10Tilt.slopePercent.toFixed(3)}% (too flat for reliable signal)`);
            }
            else if (absSlope > 1.2) {
                reasoning.push(`EMA10 slope: ${ema10Tilt.slopePercent.toFixed(3)}% (too steep, may reverse)`);
            }
        }
        // Return HOLD with reduced confidence
        return {
            signal: "HOLD",
            confidence: 25,
            stopLoss: 3,
            takeProfit: 6,
            indicators,
            reasoning,
        };
    }
    // Add positive market condition note
    reasoning.push(`✓ EMA separation: ${marketCondition.emaSeparationPercent.toFixed(2)}% - clear trend`);
    // === PRIMARY SIGNAL: EMA 10 Tilt Analysis ===
    if (ema10Tilt.direction === "bullish") {
        if (ema10Tilt.strength === "HIGH") {
            signal = "BUY";
            confidence += 30;
            reasoning.push(`EMA10 strongly tilted UP (${ema10Tilt.slopePercent.toFixed(3)}%) - HIGH probability`);
        }
        else if (ema10Tilt.strength === "MEDIUM") {
            signal = "BUY";
            confidence += 20;
            reasoning.push(`EMA10 tilted UP (${ema10Tilt.slopePercent.toFixed(3)}%) - MEDIUM probability`);
        }
        else {
            reasoning.push(`EMA10 slightly tilted UP - weak signal`);
        }
    }
    else if (ema10Tilt.direction === "bearish") {
        if (ema10Tilt.strength === "HIGH") {
            signal = "SELL";
            confidence += 30;
            reasoning.push(`EMA10 strongly tilted DOWN (${ema10Tilt.slopePercent.toFixed(3)}%) - HIGH probability`);
        }
        else if (ema10Tilt.strength === "MEDIUM") {
            signal = "SELL";
            confidence += 20;
            reasoning.push(`EMA10 tilted DOWN (${ema10Tilt.slopePercent.toFixed(3)}%) - MEDIUM probability`);
        }
        else {
            reasoning.push(`EMA10 slightly tilted DOWN - weak signal`);
        }
    }
    else {
        reasoning.push("EMA10 is flat - no directional bias");
    }
    // === EMA 20 Tilt Confirmation ===
    if (ema20Tilt.direction === ema10Tilt.direction && ema10Tilt.direction !== "flat") {
        confidence += 15;
        reasoning.push(`EMA20 confirms direction (${ema20Tilt.direction}) - trend alignment`);
    }
    else if (ema20Tilt.direction !== ema10Tilt.direction && ema20Tilt.direction !== "flat") {
        confidence -= 10;
        reasoning.push(`Warning: EMA20 diverging from EMA10 - potential reversal`);
    }
    // === EMA Crossover signals ===
    if (indicators.emaCrossover === "golden") {
        if (signal !== "SELL")
            signal = "BUY";
        confidence += 20;
        reasoning.push("Golden cross detected (EMA10 crossed above EMA20)");
    }
    else if (indicators.emaCrossover === "death") {
        if (signal !== "BUY")
            signal = "SELL";
        confidence += 20;
        reasoning.push("Death cross detected (EMA10 crossed below EMA20)");
    }
    // === Price position relative to EMAs ===
    if (indicators.priceVsEMA === "above_all") {
        if (signal !== "SELL") {
            signal = signal === "HOLD" ? "BUY" : signal;
            confidence += 10;
        }
        reasoning.push("Price above all EMAs (10, 20, 50) - bullish structure");
    }
    else if (indicators.priceVsEMA === "below_all") {
        if (signal !== "BUY") {
            signal = signal === "HOLD" ? "SELL" : signal;
            confidence += 10;
        }
        reasoning.push("Price below all EMAs (10, 20, 50) - bearish structure");
    }
    else {
        reasoning.push("Price mixed relative to EMAs - consolidation");
    }
    // === Alert Trigger (High Probability Setup) ===
    if (alertTrigger) {
        confidence += 15;
        reasoning.push("⚡ HIGH PROBABILITY SETUP: EMA10 tilting towards price action");
    }
    // === EMA200 analysis (long-term context) ===
    if (indicators.currentEMA200 > 0) {
        if (data.currentPrice > indicators.currentEMA200) {
            if (signal === "BUY")
                confidence += 5;
            reasoning.push("Above EMA200 - long-term bullish context");
        }
        else {
            if (signal === "SELL")
                confidence += 5;
            reasoning.push("Below EMA200 - long-term bearish context");
        }
    }
    // === Distance from EMA10 (entry quality) ===
    const distanceFromEMA10 = ((data.currentPrice - indicators.currentEMA10) / indicators.currentEMA10) * 100;
    if (Math.abs(distanceFromEMA10) < 0.3) {
        confidence += 10;
        reasoning.push(`Price near EMA10 (${distanceFromEMA10.toFixed(2)}%) - optimal entry zone`);
    }
    else if (Math.abs(distanceFromEMA10) > 2) {
        confidence -= 5;
        reasoning.push(`Price extended from EMA10 (${distanceFromEMA10.toFixed(2)}%) - wait for pullback`);
    }
    // === Stop-loss and Take-profit calculation ===
    if (signal === "BUY") {
        // Stop-loss below EMA20
        const distanceToEMA20 = ((data.currentPrice - indicators.currentEMA20) / data.currentPrice) * 100;
        stopLoss = Math.max(1.5, Math.min(distanceToEMA20 + 0.5, 4));
        takeProfit = stopLoss * 2.5; // 2.5:1 risk-reward
    }
    else if (signal === "SELL") {
        const distanceToEMA20 = ((indicators.currentEMA20 - data.currentPrice) / data.currentPrice) * 100;
        stopLoss = Math.max(1.5, Math.min(Math.abs(distanceToEMA20) + 0.5, 4));
        takeProfit = stopLoss * 2.5;
    }
    // === Final confidence adjustment ===
    confidence = Math.min(confidence, 95);
    confidence = Math.max(confidence, 10);
    // If no clear signal with weak tilt, recommend HOLD
    if (signal === "HOLD" || (ema10Tilt.strength === "LOW" && indicators.emaCrossover === "none")) {
        signal = "HOLD";
        if (!reasoning.some(r => r.includes("waiting"))) {
            reasoning.push("No strong tilt detected - wait for EMA10 to show direction");
        }
    }
    return {
        signal,
        confidence,
        stopLoss: Math.round(stopLoss * 10) / 10,
        takeProfit: Math.round(takeProfit * 10) / 10,
        indicators,
        reasoning,
    };
}
/**
 * Format signal for display
 */
function formatSignalSummary(signal, symbol, price) {
    const signalEmoji = signal.signal === "BUY" ? "\u{1F7E2}" : signal.signal === "SELL" ? "\u{1F534}" : "\u{1F7E1}";
    const trendEmoji = signal.indicators.trend === "bullish"
        ? "\u{2197}\u{FE0F}"
        : signal.indicators.trend === "bearish"
            ? "\u{2198}\u{FE0F}"
            : "\u{27A1}\u{FE0F}";
    const tiltEmoji = signal.indicators.ema10Tilt.direction === "bullish"
        ? "\u{2191}"
        : signal.indicators.ema10Tilt.direction === "bearish"
            ? "\u{2193}"
            : "\u{2194}";
    const probEmoji = signal.indicators.probability === "HIGH"
        ? "\u{1F525}"
        : signal.indicators.probability === "MEDIUM"
            ? "\u{1F7E1}"
            : "\u{26AA}";
    const marketCondition = signal.indicators.marketCondition;
    const marketStatus = marketCondition?.shouldTrade ? "✓ Tradeable" : "⚠️ Avoid (Sideways/Intersecting)";
    return `
${signalEmoji} Signal: ${signal.signal}
Confidence: ${signal.confidence}%
Probability: ${signal.indicators.probability} ${probEmoji}
Market: ${marketStatus}
Stop-Loss: ${signal.stopLoss}%
Take-Profit: ${signal.takeProfit}%

Current Price: $${price.toLocaleString()}
Trend: ${signal.indicators.trend} ${trendEmoji}

EMA10: $${signal.indicators.currentEMA10.toFixed(2)} ${tiltEmoji} (tilt: ${signal.indicators.ema10Tilt.slopePercent.toFixed(3)}%)
EMA20: $${signal.indicators.currentEMA20.toFixed(2)}
EMA Separation: ${marketCondition?.emaSeparationPercent.toFixed(2) || "N/A"}%
EMA50: $${signal.indicators.currentEMA50.toFixed(2)}
${signal.indicators.currentEMA200 > 0 ? `EMA200: $${signal.indicators.currentEMA200.toFixed(2)}` : ""}
${signal.indicators.alertTrigger ? "\n⚡ ALERT: High probability setup detected!" : ""}
${!marketCondition?.shouldTrade ? `\n⚠️ ${marketCondition?.reason || "Market conditions not favorable"}` : ""}
`;
}
