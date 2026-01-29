/**
 * Technical Analysis Module
 * Calculates EMA and generates trading signals
 */

import { OHLCV, CryptoData } from "./data-fetcher";

export type SignalType = "BUY" | "SELL" | "HOLD";

export interface EMAValues {
  ema9: number[];
  ema21: number[];
  ema50: number[];
  ema200: number[];
}

export interface TechnicalIndicators {
  ema: EMAValues;
  currentEMA9: number;
  currentEMA21: number;
  currentEMA50: number;
  currentEMA200: number;
  emaCrossover: "golden" | "death" | "none";
  priceVsEMA: "above_all" | "below_all" | "mixed";
  trend: "bullish" | "bearish" | "neutral";
  trendStrength: number; // 0-100
}

export interface TradingSignal {
  signal: SignalType;
  confidence: number; // 0-100
  stopLoss: number; // percentage
  takeProfit: number; // percentage
  indicators: TechnicalIndicators;
  reasoning: string[];
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) {
    return [];
  }

  const ema: number[] = [];
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
 * Calculate all EMA values
 */
export function calculateAllEMAs(candles: OHLCV[]): EMAValues {
  const closePrices = candles.map((c) => c.close);

  return {
    ema9: calculateEMA(closePrices, 9),
    ema21: calculateEMA(closePrices, 21),
    ema50: calculateEMA(closePrices, 50),
    ema200: calculateEMA(closePrices, 200),
  };
}

/**
 * Detect EMA crossover patterns
 */
function detectCrossover(
  shortEMA: number[],
  longEMA: number[],
  lookback: number = 3
): "golden" | "death" | "none" {
  if (shortEMA.length < lookback + 1 || longEMA.length < lookback + 1) {
    return "none";
  }

  const currentShort = shortEMA[shortEMA.length - 1];
  const currentLong = longEMA[longEMA.length - 1];
  const prevShort = shortEMA[shortEMA.length - lookback];
  const prevLong = longEMA[longEMA.length - lookback];

  // Golden cross: short EMA crosses above long EMA
  if (prevShort <= prevLong && currentShort > currentLong) {
    return "golden";
  }

  // Death cross: short EMA crosses below long EMA
  if (prevShort >= prevLong && currentShort < currentLong) {
    return "death";
  }

  return "none";
}

/**
 * Determine price position relative to EMAs
 */
function getPriceVsEMA(
  currentPrice: number,
  ema9: number,
  ema21: number,
  ema50: number
): "above_all" | "below_all" | "mixed" {
  const aboveCount = [ema9, ema21, ema50].filter((ema) => currentPrice > ema).length;

  if (aboveCount === 3) return "above_all";
  if (aboveCount === 0) return "below_all";
  return "mixed";
}

/**
 * Calculate trend strength based on EMA alignment
 */
function calculateTrendStrength(
  currentPrice: number,
  ema9: number,
  ema21: number,
  ema50: number,
  ema200: number | undefined
): number {
  let strength = 0;

  // Check EMA alignment (bullish: 9 > 21 > 50 > 200)
  if (ema9 > ema21) strength += 20;
  if (ema21 > ema50) strength += 20;
  if (ema200 !== undefined && ema50 > ema200) strength += 20;

  // Check price vs EMAs
  if (currentPrice > ema9) strength += 10;
  if (currentPrice > ema21) strength += 10;
  if (currentPrice > ema50) strength += 10;
  if (ema200 !== undefined && currentPrice > ema200) strength += 10;

  return Math.min(strength, 100);
}

/**
 * Calculate technical indicators
 */
export function calculateIndicators(data: CryptoData): TechnicalIndicators {
  const ema = calculateAllEMAs(data.candles);

  const currentEMA9 = ema.ema9[ema.ema9.length - 1] || 0;
  const currentEMA21 = ema.ema21[ema.ema21.length - 1] || 0;
  const currentEMA50 = ema.ema50[ema.ema50.length - 1] || 0;
  const currentEMA200 = ema.ema200.length > 0 ? ema.ema200[ema.ema200.length - 1] : undefined;

  // Detect crossover between EMA9 and EMA21
  const emaCrossover = detectCrossover(ema.ema9, ema.ema21);

  // Price vs EMA position
  const priceVsEMA = getPriceVsEMA(data.currentPrice, currentEMA9, currentEMA21, currentEMA50);

  // Determine trend
  let trend: "bullish" | "bearish" | "neutral";
  if (currentEMA9 > currentEMA21 && currentEMA21 > currentEMA50) {
    trend = "bullish";
  } else if (currentEMA9 < currentEMA21 && currentEMA21 < currentEMA50) {
    trend = "bearish";
  } else {
    trend = "neutral";
  }

  // Calculate trend strength
  const trendStrength = calculateTrendStrength(
    data.currentPrice,
    currentEMA9,
    currentEMA21,
    currentEMA50,
    currentEMA200
  );

  return {
    ema,
    currentEMA9,
    currentEMA21,
    currentEMA50,
    currentEMA200: currentEMA200 || 0,
    emaCrossover,
    priceVsEMA,
    trend,
    trendStrength,
  };
}

/**
 * Generate trading signal based on EMA analysis
 */
export function generateSignal(data: CryptoData): TradingSignal {
  const indicators = calculateIndicators(data);
  const reasoning: string[] = [];
  let signal: SignalType = "HOLD";
  let confidence = 50;
  let stopLoss = 3;
  let takeProfit = 6;

  // EMA Crossover signals
  if (indicators.emaCrossover === "golden") {
    signal = "BUY";
    confidence += 25;
    reasoning.push("Golden cross detected (EMA9 crossed above EMA21)");
  } else if (indicators.emaCrossover === "death") {
    signal = "SELL";
    confidence += 25;
    reasoning.push("Death cross detected (EMA9 crossed below EMA21)");
  }

  // Price position relative to EMAs
  if (indicators.priceVsEMA === "above_all") {
    if (signal !== "SELL") {
      signal = signal === "HOLD" ? "BUY" : signal;
      confidence += 15;
    }
    reasoning.push("Price is above all major EMAs (9, 21, 50)");
  } else if (indicators.priceVsEMA === "below_all") {
    if (signal !== "BUY") {
      signal = signal === "HOLD" ? "SELL" : signal;
      confidence += 15;
    }
    reasoning.push("Price is below all major EMAs (9, 21, 50)");
  } else {
    reasoning.push("Price is mixed relative to EMAs - consolidation phase");
  }

  // Trend analysis
  if (indicators.trend === "bullish") {
    if (signal !== "SELL") {
      confidence += 10;
    }
    reasoning.push("EMAs are aligned bullishly (EMA9 > EMA21 > EMA50)");
  } else if (indicators.trend === "bearish") {
    if (signal !== "BUY") {
      confidence += 10;
    }
    reasoning.push("EMAs are aligned bearishly (EMA9 < EMA21 < EMA50)");
  } else {
    reasoning.push("EMAs show no clear trend alignment");
  }

  // EMA200 analysis (if available)
  if (indicators.currentEMA200 > 0) {
    if (data.currentPrice > indicators.currentEMA200) {
      if (signal === "BUY") confidence += 10;
      reasoning.push("Price is above EMA200 (long-term bullish)");
    } else {
      if (signal === "SELL") confidence += 10;
      reasoning.push("Price is below EMA200 (long-term bearish)");
    }
  }

  // 24h price change consideration
  if (Math.abs(data.priceChangePercent24h) > 5) {
    if (data.priceChangePercent24h > 5 && signal === "BUY") {
      reasoning.push(`Strong momentum: +${data.priceChangePercent24h.toFixed(2)}% in 24h`);
      confidence += 5;
    } else if (data.priceChangePercent24h < -5 && signal === "SELL") {
      reasoning.push(`Strong downward momentum: ${data.priceChangePercent24h.toFixed(2)}% in 24h`);
      confidence += 5;
    } else if (Math.abs(data.priceChangePercent24h) > 10) {
      reasoning.push(`Caution: High volatility (${data.priceChangePercent24h.toFixed(2)}% in 24h)`);
      confidence -= 5;
    }
  }

  // Adjust stop-loss and take-profit based on signal and confidence
  if (signal === "BUY") {
    // Set stop-loss below recent support (EMA21)
    const distanceToEMA21 =
      ((data.currentPrice - indicators.currentEMA21) / data.currentPrice) * 100;
    stopLoss = Math.max(2, Math.min(distanceToEMA21 + 1, 5));
    takeProfit = stopLoss * 2; // 2:1 risk-reward ratio
  } else if (signal === "SELL") {
    // For sell signals, stop-loss above resistance
    const distanceToEMA21 =
      ((indicators.currentEMA21 - data.currentPrice) / data.currentPrice) * 100;
    stopLoss = Math.max(2, Math.min(Math.abs(distanceToEMA21) + 1, 5));
    takeProfit = stopLoss * 2;
  }

  // Cap confidence at 95%
  confidence = Math.min(confidence, 95);
  confidence = Math.max(confidence, 10);

  // If no clear signals, suggest HOLD
  if (reasoning.length <= 2 && indicators.emaCrossover === "none") {
    signal = "HOLD";
    reasoning.push("No clear trading signal - recommend waiting for better setup");
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
export function formatSignalSummary(signal: TradingSignal, symbol: string, price: number): string {
  const signalEmoji =
    signal.signal === "BUY" ? "\u{1F7E2}" : signal.signal === "SELL" ? "\u{1F534}" : "\u{1F7E1}";
  const trendEmoji =
    signal.indicators.trend === "bullish"
      ? "\u{2197}\u{FE0F}"
      : signal.indicators.trend === "bearish"
        ? "\u{2198}\u{FE0F}"
        : "\u{27A1}\u{FE0F}";

  return `
${signalEmoji} Signal: ${signal.signal}
Confidence: ${signal.confidence}%
Stop-Loss: ${signal.stopLoss}%
Take-Profit: ${signal.takeProfit}%

Current Price: $${price.toLocaleString()}
Trend: ${signal.indicators.trend} ${trendEmoji}
EMA9: $${signal.indicators.currentEMA9.toFixed(2)}
EMA21: $${signal.indicators.currentEMA21.toFixed(2)}
EMA50: $${signal.indicators.currentEMA50.toFixed(2)}
${signal.indicators.currentEMA200 > 0 ? `EMA200: $${signal.indicators.currentEMA200.toFixed(2)}` : ""}
`;
}
