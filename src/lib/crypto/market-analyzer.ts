/* global fetch */
/**
 * Advanced Market Analyzer
 * Multi-timeframe analysis with timing recommendations
 */

import { fetchCryptoData, CryptoData, TimeInterval, OHLCV } from "./data-fetcher";
import {
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  analyzeVolume,
  calculateSupportResistance,
  analyzeTrend,
  RSIResult,
  MACDResult,
  BollingerResult,
  ATRResult,
  VolumeResult,
  SupportResistance,
  TrendResult,
} from "./indicators";

// ============================================
// TYPES
// ============================================

export type RecommendationType =
  | "STRONG_BUY"
  | "BUY"
  | "WAIT_TO_BUY"
  | "HOLD"
  | "WAIT_TO_SELL"
  | "SELL"
  | "STRONG_SELL";

export interface TimeframeAnalysis {
  interval: TimeInterval;
  trend: TrendResult;
  rsi: RSIResult;
  macd: MACDResult;
  bollinger: BollingerResult;
  ema: {
    ema9: number;
    ema21: number;
    ema50: number;
    ema200: number;
  };
  signal: "bullish" | "bearish" | "neutral";
}

export interface TimingRecommendation {
  action:
    | "enter_now"
    | "wait_for_pullback"
    | "wait_for_breakout"
    | "wait_for_confirmation"
    | "avoid";
  timing: string;
  entryZone: {
    low: number;
    high: number;
  };
  reason: string;
}

export interface TradeSetup {
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  riskRewardRatio: number;
  positionSizeRisk: number; // % of portfolio to risk
}

export interface MarketCondition {
  type: "trending" | "ranging" | "volatile" | "breakout";
  description: string;
  tradingAdvice: string;
}

export interface ComprehensiveAnalysis {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;

  // Main recommendation
  recommendation: RecommendationType;
  confidence: number;
  riskLevel: "low" | "medium" | "high";

  // Multi-timeframe
  timeframes: {
    short: TimeframeAnalysis; // 15m or 1h
    medium: TimeframeAnalysis; // 4h
    long: TimeframeAnalysis; // 1d
  };
  timeframeAlignment: "aligned_bullish" | "aligned_bearish" | "mixed";

  // All indicators
  indicators: {
    rsi: RSIResult;
    macd: MACDResult;
    bollinger: BollingerResult;
    atr: ATRResult;
    volume: VolumeResult;
    supportResistance: SupportResistance;
    trend: TrendResult;
  };

  // Timing
  timing: TimingRecommendation;

  // Trade setup
  tradeSetup: TradeSetup;

  // Market condition
  marketCondition: MarketCondition;

  // Detailed reasoning
  reasoning: {
    summary: string;
    bullishFactors: string[];
    bearishFactors: string[];
    keyLevels: string[];
    warnings: string[];
  };
}

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Analyze a single timeframe
 */
function analyzeTimeframe(data: CryptoData): TimeframeAnalysis {
  const closePrices = data.candles.map((c) => c.close);

  const ema9 = calculateEMA(closePrices, 9);
  const ema21 = calculateEMA(closePrices, 21);
  const ema50 = calculateEMA(closePrices, 50);
  const ema200 = calculateEMA(closePrices, 200);

  const rsi = calculateRSI(closePrices, 14);
  const macd = calculateMACD(closePrices);
  const bollinger = calculateBollingerBands(closePrices);
  const trend = analyzeTrend(data.candles);

  // Determine signal
  let bullishPoints = 0;
  let bearishPoints = 0;

  // EMA alignment
  const currentEMA9 = ema9[ema9.length - 1] || 0;
  const currentEMA21 = ema21[ema21.length - 1] || 0;
  const currentEMA50 = ema50[ema50.length - 1] || 0;

  if (currentEMA9 > currentEMA21 && currentEMA21 > currentEMA50) bullishPoints += 2;
  else if (currentEMA9 < currentEMA21 && currentEMA21 < currentEMA50) bearishPoints += 2;

  // RSI
  if (rsi.condition === "oversold") bullishPoints += 1;
  if (rsi.condition === "overbought") bearishPoints += 1;
  if (rsi.divergence === "bullish") bullishPoints += 2;
  if (rsi.divergence === "bearish") bearishPoints += 2;

  // MACD
  if (macd.crossover === "bullish") bullishPoints += 2;
  if (macd.crossover === "bearish") bearishPoints += 2;
  if (macd.momentum === "increasing" && macd.current.histogram > 0) bullishPoints += 1;
  if (macd.momentum === "decreasing" && macd.current.histogram < 0) bearishPoints += 1;

  // Bollinger
  if (bollinger.pricePosition === "below_lower") bullishPoints += 1;
  if (bollinger.pricePosition === "above_upper") bearishPoints += 1;

  // Trend
  if (trend.direction === "bullish") bullishPoints += 2;
  if (trend.direction === "bearish") bearishPoints += 2;

  let signal: "bullish" | "bearish" | "neutral" = "neutral";
  if (bullishPoints > bearishPoints + 2) signal = "bullish";
  else if (bearishPoints > bullishPoints + 2) signal = "bearish";

  return {
    interval: data.interval as TimeInterval,
    trend,
    rsi,
    macd,
    bollinger,
    ema: {
      ema9: currentEMA9,
      ema21: currentEMA21,
      ema50: currentEMA50,
      ema200: ema200[ema200.length - 1] || 0,
    },
    signal,
  };
}

/**
 * Generate timing recommendation
 */
function generateTimingRecommendation(
  analysis: TimeframeAnalysis,
  indicators: ComprehensiveAnalysis["indicators"],
  currentPrice: number,
  recommendation: RecommendationType
): TimingRecommendation {
  const { supportResistance, rsi, macd, bollinger } = indicators;

  // Default entry zone
  let entryLow = currentPrice * 0.99;
  let entryHigh = currentPrice * 1.01;

  if (recommendation.includes("BUY")) {
    // For buy signals
    if (rsi.current > 60) {
      // RSI high, wait for pullback
      entryLow = supportResistance.nearestSupport;
      entryHigh = analysis.ema.ema21;
      return {
        action: "wait_for_pullback",
        timing: "Wait for price to pull back to EMA21 or support level",
        entryZone: { low: entryLow, high: entryHigh },
        reason: `RSI at ${rsi.current.toFixed(0)} is elevated. Better entry near $${entryHigh.toFixed(2)}`,
      };
    } else if (bollinger.squeeze) {
      // Squeeze, wait for breakout
      entryLow = bollinger.current.upper;
      entryHigh = bollinger.current.upper * 1.01;
      return {
        action: "wait_for_breakout",
        timing: "Wait for breakout above Bollinger upper band",
        entryZone: { low: entryLow, high: entryHigh },
        reason: "Bollinger squeeze detected. Wait for volatility expansion",
      };
    } else if (macd.crossover === "bullish") {
      // Fresh MACD crossover, enter now
      return {
        action: "enter_now",
        timing: "Enter on current candle close",
        entryZone: { low: currentPrice * 0.995, high: currentPrice * 1.005 },
        reason: "Fresh MACD bullish crossover provides good entry",
      };
    } else {
      // Wait for confirmation
      return {
        action: "wait_for_confirmation",
        timing: "Wait for next 1-4 hour candle to confirm direction",
        entryZone: { low: analysis.ema.ema9, high: currentPrice },
        reason: "Wait for price to hold above EMA9 for confirmation",
      };
    }
  } else if (recommendation.includes("SELL")) {
    // For sell signals
    if (rsi.current < 40) {
      entryHigh = supportResistance.nearestResistance;
      entryLow = analysis.ema.ema21;
      return {
        action: "wait_for_pullback",
        timing: "Wait for price to bounce to resistance before shorting",
        entryZone: { low: entryLow, high: entryHigh },
        reason: `RSI at ${rsi.current.toFixed(0)} is low. Wait for bounce to short`,
      };
    } else if (macd.crossover === "bearish") {
      return {
        action: "enter_now",
        timing: "Enter short on current candle close",
        entryZone: { low: currentPrice * 0.995, high: currentPrice * 1.005 },
        reason: "Fresh MACD bearish crossover provides good short entry",
      };
    } else {
      return {
        action: "wait_for_confirmation",
        timing: "Wait for break below EMA21 to confirm",
        entryZone: { low: analysis.ema.ema21 * 0.99, high: analysis.ema.ema21 },
        reason: "Wait for price to break below EMA21 for confirmation",
      };
    }
  } else {
    // HOLD
    return {
      action: "avoid",
      timing: "No clear setup - wait for better opportunity",
      entryZone: {
        low: supportResistance.nearestSupport,
        high: supportResistance.nearestResistance,
      },
      reason: "Mixed signals suggest waiting for clearer direction",
    };
  }
}

/**
 * Generate trade setup with stop loss and targets
 */
function generateTradeSetup(
  currentPrice: number,
  indicators: ComprehensiveAnalysis["indicators"],
  recommendation: RecommendationType
): TradeSetup {
  const { atr, supportResistance } = indicators;
  const atrValue = atr.current;

  const entry = currentPrice;
  let stopLoss: number;
  let target1: number;
  let target2: number;
  let target3: number;

  if (recommendation.includes("BUY") || recommendation === "HOLD") {
    // Long setup
    stopLoss = Math.max(supportResistance.nearestSupport * 0.99, currentPrice - atrValue * 2);
    target1 = currentPrice + atrValue * 1.5;
    target2 = currentPrice + atrValue * 3;
    target3 = supportResistance.nearestResistance;
  } else {
    // Short setup
    stopLoss = Math.min(supportResistance.nearestResistance * 1.01, currentPrice + atrValue * 2);
    target1 = currentPrice - atrValue * 1.5;
    target2 = currentPrice - atrValue * 3;
    target3 = supportResistance.nearestSupport;
  }

  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(target2 - entry);
  const riskRewardRatio = reward / risk;

  // Position size based on 2% account risk
  const positionSizeRisk = (2 / ((risk / entry) * 100)) * 100;

  return {
    entry,
    stopLoss,
    target1,
    target2,
    target3,
    riskRewardRatio: Math.round(riskRewardRatio * 10) / 10,
    positionSizeRisk: Math.min(positionSizeRisk, 100),
  };
}

/**
 * Determine market condition
 */
function determineMarketCondition(
  indicators: ComprehensiveAnalysis["indicators"],
  timeframe: TimeframeAnalysis
): MarketCondition {
  const { atr, bollinger, volume, trend } = indicators;

  if (bollinger.squeeze && volume.trend === "decreasing") {
    return {
      type: "ranging",
      description: "Market is consolidating in a tight range",
      tradingAdvice: "Wait for breakout or trade range boundaries",
    };
  }

  if (atr.volatility === "high" && volume.volumeRatio > 1.5) {
    return {
      type: "volatile",
      description: "High volatility with increased volume",
      tradingAdvice: "Use wider stops, reduce position size",
    };
  }

  if (trend.phase === "trending" && trend.strength > 70) {
    return {
      type: "trending",
      description: `Strong ${trend.direction} trend in progress`,
      tradingAdvice:
        trend.direction === "bullish"
          ? "Buy dips, trail stops, add on pullbacks"
          : "Sell rallies, trail stops, add on bounces",
    };
  }

  if (bollinger.current.bandwidth > 10 && !bollinger.squeeze) {
    return {
      type: "breakout",
      description: "Potential breakout in progress",
      tradingAdvice: "Watch for continuation or false breakout",
    };
  }

  return {
    type: "ranging",
    description: "No clear trend, choppy price action",
    tradingAdvice: "Reduce position size, trade with caution",
  };
}

/**
 * Generate detailed reasoning
 */
function generateReasoning(
  indicators: ComprehensiveAnalysis["indicators"],
  timeframes: ComprehensiveAnalysis["timeframes"],
  currentPrice: number
): ComprehensiveAnalysis["reasoning"] {
  const bullishFactors: string[] = [];
  const bearishFactors: string[] = [];
  const keyLevels: string[] = [];
  const warnings: string[] = [];

  const { rsi, macd, bollinger, volume, supportResistance, trend, atr } = indicators;

  // RSI analysis
  if (rsi.condition === "oversold") {
    bullishFactors.push(`RSI oversold at ${rsi.current.toFixed(1)} - potential bounce`);
  } else if (rsi.condition === "overbought") {
    bearishFactors.push(`RSI overbought at ${rsi.current.toFixed(1)} - potential pullback`);
  }
  if (rsi.divergence === "bullish") {
    bullishFactors.push("Bullish RSI divergence detected - reversal signal");
  } else if (rsi.divergence === "bearish") {
    bearishFactors.push("Bearish RSI divergence detected - reversal signal");
  }

  // MACD analysis
  if (macd.crossover === "bullish") {
    bullishFactors.push("MACD bullish crossover - momentum shifting up");
  } else if (macd.crossover === "bearish") {
    bearishFactors.push("MACD bearish crossover - momentum shifting down");
  }
  if (macd.current.histogram > 0 && macd.momentum === "increasing") {
    bullishFactors.push("MACD histogram increasing - strong bullish momentum");
  } else if (macd.current.histogram < 0 && macd.momentum === "decreasing") {
    bearishFactors.push("MACD histogram decreasing - strong bearish momentum");
  }

  // Bollinger analysis
  if (bollinger.pricePosition === "below_lower") {
    bullishFactors.push("Price below lower Bollinger Band - oversold");
  } else if (bollinger.pricePosition === "above_upper") {
    bearishFactors.push("Price above upper Bollinger Band - overbought");
  }
  if (bollinger.squeeze) {
    warnings.push("Bollinger squeeze - expect volatility expansion soon");
  }

  // Volume analysis
  if (volume.volumeRatio > 1.5 && volume.confirmation) {
    bullishFactors.push("High volume confirming price movement");
  } else if (volume.volumeRatio < 0.5) {
    warnings.push("Low volume - move may lack conviction");
  }

  // Trend analysis
  if (trend.direction === "bullish" && trend.strength > 60) {
    bullishFactors.push(`Strong uptrend (${trend.strength}% strength)`);
  } else if (trend.direction === "bearish" && trend.strength > 60) {
    bearishFactors.push(`Strong downtrend (${trend.strength}% strength)`);
  }
  if (trend.phase === "reversing") {
    warnings.push("Trend may be reversing - watch for confirmation");
  }

  // Multi-timeframe
  const { short, medium, long } = timeframes;
  if (short.signal === medium.signal && medium.signal === long.signal) {
    if (short.signal === "bullish") {
      bullishFactors.push("All timeframes aligned bullish - high probability setup");
    } else if (short.signal === "bearish") {
      bearishFactors.push("All timeframes aligned bearish - high probability setup");
    }
  } else {
    warnings.push("Timeframes not aligned - reduced probability");
  }

  // Key levels
  keyLevels.push(
    `Support: $${supportResistance.nearestSupport.toFixed(2)} (${supportResistance.distanceToSupport.toFixed(1)}% away)`
  );
  keyLevels.push(
    `Resistance: $${supportResistance.nearestResistance.toFixed(2)} (${supportResistance.distanceToResistance.toFixed(1)}% away)`
  );
  keyLevels.push(`EMA21: $${timeframes.medium.ema.ema21.toFixed(2)}`);
  keyLevels.push(`EMA50: $${timeframes.medium.ema.ema50.toFixed(2)}`);

  // Volatility warning
  if (atr.volatility === "high") {
    warnings.push(`High volatility (ATR: ${atr.percentOfPrice.toFixed(1)}%) - use wider stops`);
  }

  // Generate summary
  let summary: string;
  if (bullishFactors.length > bearishFactors.length + 2) {
    summary = `Strong bullish setup with ${bullishFactors.length} positive factors. `;
    summary += bullishFactors[0] + ". ";
    if (warnings.length > 0) summary += `Caution: ${warnings[0]}`;
  } else if (bearishFactors.length > bullishFactors.length + 2) {
    summary = `Strong bearish setup with ${bearishFactors.length} negative factors. `;
    summary += bearishFactors[0] + ". ";
    if (warnings.length > 0) summary += `Caution: ${warnings[0]}`;
  } else {
    summary = "Mixed signals present. ";
    if (bullishFactors.length > 0) summary += bullishFactors[0] + ", but ";
    if (bearishFactors.length > 0) summary += bearishFactors[0] + ". ";
    summary += "Wait for clearer setup.";
  }

  return { summary, bullishFactors, bearishFactors, keyLevels, warnings };
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Perform comprehensive market analysis
 */
export async function analyzeMarket(symbol: string): Promise<ComprehensiveAnalysis> {
  // Fetch data for multiple timeframes in parallel
  const [data1h, data4h, data1d] = await Promise.all([
    fetchCryptoData(symbol, "1h", 200),
    fetchCryptoData(symbol, "4h", 200),
    fetchCryptoData(symbol, "1d", 200),
  ]);

  // Analyze each timeframe
  const shortTF = analyzeTimeframe(data1h);
  const mediumTF = analyzeTimeframe(data4h);
  const longTF = analyzeTimeframe(data1d);

  // Calculate all indicators on 4h (primary timeframe)
  const closePrices = data4h.candles.map((c) => c.close);

  const indicators = {
    rsi: calculateRSI(closePrices),
    macd: calculateMACD(closePrices),
    bollinger: calculateBollingerBands(closePrices),
    atr: calculateATR(data4h.candles),
    volume: analyzeVolume(data4h.candles),
    supportResistance: calculateSupportResistance(data4h.candles),
    trend: analyzeTrend(data4h.candles),
  };

  // Determine timeframe alignment
  let timeframeAlignment: "aligned_bullish" | "aligned_bearish" | "mixed" = "mixed";
  if (
    shortTF.signal === "bullish" &&
    mediumTF.signal === "bullish" &&
    longTF.signal === "bullish"
  ) {
    timeframeAlignment = "aligned_bullish";
  } else if (
    shortTF.signal === "bearish" &&
    mediumTF.signal === "bearish" &&
    longTF.signal === "bearish"
  ) {
    timeframeAlignment = "aligned_bearish";
  }

  // Calculate recommendation score
  let score = 0;

  // RSI contribution (-2 to +2)
  if (indicators.rsi.condition === "oversold") score += 2;
  else if (indicators.rsi.condition === "overbought") score -= 2;
  if (indicators.rsi.divergence === "bullish") score += 2;
  else if (indicators.rsi.divergence === "bearish") score -= 2;

  // MACD contribution (-2 to +2)
  if (indicators.macd.crossover === "bullish") score += 2;
  else if (indicators.macd.crossover === "bearish") score -= 2;
  if (indicators.macd.current.histogram > 0) score += 1;
  else score -= 1;

  // Bollinger contribution (-1 to +1)
  if (indicators.bollinger.pricePosition === "below_lower") score += 1;
  else if (indicators.bollinger.pricePosition === "above_upper") score -= 1;

  // Trend contribution (-3 to +3)
  if (indicators.trend.direction === "bullish") score += Math.ceil(indicators.trend.strength / 33);
  else if (indicators.trend.direction === "bearish")
    score -= Math.ceil(indicators.trend.strength / 33);

  // Timeframe alignment contribution (-3 to +3)
  if (timeframeAlignment === "aligned_bullish") score += 3;
  else if (timeframeAlignment === "aligned_bearish") score -= 3;

  // Volume confirmation
  if (indicators.volume.confirmation) score += score > 0 ? 1 : -1;

  // Determine recommendation
  let recommendation: RecommendationType;
  if (score >= 8) recommendation = "STRONG_BUY";
  else if (score >= 4) recommendation = "BUY";
  else if (score >= 1) recommendation = "WAIT_TO_BUY";
  else if (score >= -1) recommendation = "HOLD";
  else if (score >= -4) recommendation = "WAIT_TO_SELL";
  else if (score >= -8) recommendation = "SELL";
  else recommendation = "STRONG_SELL";

  // Calculate confidence
  const maxScore = 15;
  const confidence = Math.min(Math.round((Math.abs(score) / maxScore) * 100), 95);

  // Determine risk level
  let riskLevel: "low" | "medium" | "high" = "medium";
  if (indicators.atr.volatility === "high" || !indicators.volume.confirmation) {
    riskLevel = "high";
  } else if (timeframeAlignment !== "mixed" && indicators.trend.strength > 70) {
    riskLevel = "low";
  }

  const timeframes = { short: shortTF, medium: mediumTF, long: longTF };

  // Generate timing recommendation
  const timing = generateTimingRecommendation(
    mediumTF,
    indicators,
    data4h.currentPrice,
    recommendation
  );

  // Generate trade setup
  const tradeSetup = generateTradeSetup(data4h.currentPrice, indicators, recommendation);

  // Determine market condition
  const marketCondition = determineMarketCondition(indicators, mediumTF);

  // Generate reasoning
  const reasoning = generateReasoning(indicators, timeframes, data4h.currentPrice);

  return {
    symbol: data4h.symbol,
    currentPrice: data4h.currentPrice,
    priceChange24h: data4h.priceChangePercent24h,
    recommendation,
    confidence,
    riskLevel,
    timeframes,
    timeframeAlignment,
    indicators,
    timing,
    tradeSetup,
    marketCondition,
    reasoning,
  };
}
