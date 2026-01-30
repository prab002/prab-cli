/**
 * Smart Trading Strategy Engine
 * Combines multiple factors for high-probability trade setups
 */

/* global fetch */

import chalk from "chalk";
import ora from "ora";
import {
  fetchCryptoData,
  fetchOHLCV,
  OHLCV,
  TimeInterval,
  validateSymbol,
  findSimilarSymbols,
} from "./data-fetcher";
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  analyzeTrend,
  calculateSupportResistance,
  analyzeVolume,
} from "./indicators";
import { findOrderBlocks, findFairValueGaps } from "./smc-indicators";
import { fetchCryptoNews } from "./news-fetcher";

// ============================================
// TYPES
// ============================================

export interface TradeSetupResult {
  symbol: string;
  direction: "LONG" | "SHORT" | "NO_TRADE";
  confidence: number; // 0-100

  // Entry & Exit
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;

  // Risk Management
  recommendedLeverage: number;
  maxLeverage: number;
  riskRewardRatio: number;
  positionSizePercent: number; // % of account to risk

  // Scores
  technicalScore: number;
  smcScore: number;
  volumeWhaleScore: number;
  newsScore: number;
  overallScore: number;

  // Multi-timeframe
  mtfAlignment: {
    m15: "bullish" | "bearish" | "neutral";
    h1: "bullish" | "bearish" | "neutral";
    h4: "bullish" | "bearish" | "neutral";
  };
  mtfConfirmed: boolean;

  // Trailing Stop
  trailingStopLevels: {
    trigger: number;
    newStop: number;
    description: string;
  }[];

  // Alert Status
  alertStatus: "FORMING" | "READY" | "ACTIVE" | "MISSED";
  alertReasons: string[];

  // Detailed Analysis
  analysis: {
    emaStatus: string;
    rsiStatus: string;
    macdStatus: string;
    bbStatus: string;
    smcStatus: string;
    volumeStatus: string;
    newsStatus: string;
  };

  // Warnings
  warnings: string[];

  timestamp: number;
}

export interface StrategyConfig {
  maxLeverage: number;
  riskPerTrade: number; // % of account
  style: "conservative" | "moderate" | "aggressive";
  direction: "both" | "long" | "short";
}

// Default config
const DEFAULT_CONFIG: StrategyConfig = {
  maxLeverage: 20,
  riskPerTrade: 2, // 2% per trade
  style: "moderate",
  direction: "both",
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateEMAs(closes: number[]): {
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  alignment: "bullish" | "bearish" | "neutral";
} {
  const ema = (data: number[], period: number): number => {
    const k = 2 / (period + 1);
    let emaValue = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      emaValue = data[i] * k + emaValue * (1 - k);
    }
    return emaValue;
  };

  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const ema200 = closes.length >= 200 ? ema(closes, 200) : ema50;

  // Check alignment
  let alignment: "bullish" | "bearish" | "neutral" = "neutral";
  if (ema9 > ema21 && ema21 > ema50 && ema50 > ema200) {
    alignment = "bullish";
  } else if (ema9 < ema21 && ema21 < ema50 && ema50 < ema200) {
    alignment = "bearish";
  }

  return { ema9, ema21, ema50, ema200, alignment };
}

function detectRSIDivergence(
  closes: number[],
  rsiValues: number[]
): { type: "bullish" | "bearish" | "none"; strength: number } {
  if (rsiValues.length < 20) return { type: "none", strength: 0 };

  const recentCloses = closes.slice(-20);
  const recentRSI = rsiValues.slice(-20);

  // Find local lows/highs in price
  const priceLows: number[] = [];
  const priceHighs: number[] = [];
  const rsiAtLows: number[] = [];
  const rsiAtHighs: number[] = [];

  for (let i = 2; i < recentCloses.length - 2; i++) {
    if (
      recentCloses[i] < recentCloses[i - 1] &&
      recentCloses[i] < recentCloses[i - 2] &&
      recentCloses[i] < recentCloses[i + 1] &&
      recentCloses[i] < recentCloses[i + 2]
    ) {
      priceLows.push(recentCloses[i]);
      rsiAtLows.push(recentRSI[i]);
    }
    if (
      recentCloses[i] > recentCloses[i - 1] &&
      recentCloses[i] > recentCloses[i - 2] &&
      recentCloses[i] > recentCloses[i + 1] &&
      recentCloses[i] > recentCloses[i + 2]
    ) {
      priceHighs.push(recentCloses[i]);
      rsiAtHighs.push(recentRSI[i]);
    }
  }

  // Bullish divergence: price makes lower low, RSI makes higher low
  if (priceLows.length >= 2) {
    const lastTwoLows = priceLows.slice(-2);
    const lastTwoRSILows = rsiAtLows.slice(-2);
    if (lastTwoLows[1] < lastTwoLows[0] && lastTwoRSILows[1] > lastTwoRSILows[0]) {
      return { type: "bullish", strength: 70 };
    }
  }

  // Bearish divergence: price makes higher high, RSI makes lower high
  if (priceHighs.length >= 2) {
    const lastTwoHighs = priceHighs.slice(-2);
    const lastTwoRSIHighs = rsiAtHighs.slice(-2);
    if (lastTwoHighs[1] > lastTwoHighs[0] && lastTwoRSIHighs[1] < lastTwoRSIHighs[0]) {
      return { type: "bearish", strength: 70 };
    }
  }

  return { type: "none", strength: 0 };
}

function calculateLeverage(
  atr: number,
  price: number,
  confidence: number,
  config: StrategyConfig
): { recommended: number; max: number } {
  // ATR as percentage of price
  const atrPercent = (atr / price) * 100;

  // Base leverage calculation
  // Higher volatility = lower leverage
  let baseLeverage: number;
  if (atrPercent > 5) {
    baseLeverage = 3; // Very high volatility
  } else if (atrPercent > 3) {
    baseLeverage = 5;
  } else if (atrPercent > 2) {
    baseLeverage = 10;
  } else if (atrPercent > 1) {
    baseLeverage = 15;
  } else {
    baseLeverage = 20;
  }

  // Adjust based on confidence
  const confidenceMultiplier = confidence >= 80 ? 1.2 : confidence >= 60 ? 1 : 0.8;

  // Adjust based on style
  const styleMultiplier =
    config.style === "conservative" ? 0.5 : config.style === "aggressive" ? 1.5 : 1;

  const recommended = Math.min(
    Math.round(baseLeverage * confidenceMultiplier * styleMultiplier),
    config.maxLeverage
  );

  return {
    recommended: Math.max(1, recommended),
    max: config.maxLeverage,
  };
}

function calculatePositionSize(entryPrice: number, stopLoss: number, riskPercent: number): number {
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  const riskRatio = riskPerUnit / entryPrice;

  // Position size as % of account
  // If risk per trade is 2% and stop is 5% away, position size = 2/5 = 40%
  const positionSize = riskPercent / (riskRatio * 100);

  return Math.min(positionSize, 100);
}

function generateTrailingStops(
  entry: number,
  tp1: number,
  tp2: number,
  tp3: number,
  stopLoss: number,
  direction: "LONG" | "SHORT"
): { trigger: number; newStop: number; description: string }[] {
  const stops = [];

  if (direction === "LONG") {
    // Move stop to breakeven when TP1 hit
    stops.push({
      trigger: tp1,
      newStop: entry * 1.001, // Slightly above entry
      description: "Move stop to breakeven when TP1 reached",
    });

    // Move stop to TP1 when TP2 hit
    stops.push({
      trigger: tp2,
      newStop: tp1,
      description: "Move stop to TP1 level when TP2 reached",
    });

    // Move stop to TP2 when approaching TP3
    const tp2_tp3_mid = (tp2 + tp3) / 2;
    stops.push({
      trigger: tp2_tp3_mid,
      newStop: tp2,
      description: "Move stop to TP2 level when halfway to TP3",
    });
  } else {
    // SHORT positions - reverse logic
    stops.push({
      trigger: tp1,
      newStop: entry * 0.999,
      description: "Move stop to breakeven when TP1 reached",
    });

    stops.push({
      trigger: tp2,
      newStop: tp1,
      description: "Move stop to TP1 level when TP2 reached",
    });

    const tp2_tp3_mid = (tp2 + tp3) / 2;
    stops.push({
      trigger: tp2_tp3_mid,
      newStop: tp2,
      description: "Move stop to TP2 level when halfway to TP3",
    });
  }

  return stops;
}

// ============================================
// MULTI-TIMEFRAME ANALYSIS
// ============================================

async function analyzeTimeframe(
  symbol: string,
  interval: TimeInterval
): Promise<"bullish" | "bearish" | "neutral"> {
  try {
    const candles = await fetchOHLCV(symbol, interval, 100);
    if (candles.length < 50) return "neutral";

    const closes = candles.map((c) => c.close);
    const emas = calculateEMAs(closes);
    const rsi = calculateRSI(closes, 14);
    const macd = calculateMACD(closes);
    const trend = analyzeTrend(candles);

    let bullishPoints = 0;
    let bearishPoints = 0;

    // EMA alignment
    if (emas.alignment === "bullish") bullishPoints += 2;
    else if (emas.alignment === "bearish") bearishPoints += 2;

    // RSI
    if (rsi.current < 40) bullishPoints += 1;
    else if (rsi.current > 60) bearishPoints += 1;

    // MACD
    if (macd.crossover === "bullish") bullishPoints += 1;
    else if (macd.crossover === "bearish") bearishPoints += 1;

    // Trend
    if (trend.direction === "bullish") bullishPoints += 1;
    else if (trend.direction === "bearish") bearishPoints += 1;

    if (bullishPoints >= 3) return "bullish";
    if (bearishPoints >= 3) return "bearish";
    return "neutral";
  } catch {
    return "neutral";
  }
}

async function getMultiTimeframeAnalysis(symbol: string): Promise<{
  m15: "bullish" | "bearish" | "neutral";
  h1: "bullish" | "bearish" | "neutral";
  h4: "bullish" | "bearish" | "neutral";
  confirmed: boolean;
}> {
  const [m15, h1, h4] = await Promise.all([
    analyzeTimeframe(symbol, "15m"),
    analyzeTimeframe(symbol, "1h"),
    analyzeTimeframe(symbol, "4h"),
  ]);

  // Confirmed if all timeframes align
  const confirmed =
    (m15 === "bullish" && h1 === "bullish" && h4 === "bullish") ||
    (m15 === "bearish" && h1 === "bearish" && h4 === "bearish");

  return { m15, h1, h4, confirmed };
}

// ============================================
// NEWS SENTIMENT ANALYSIS
// ============================================

async function getNewsSentiment(symbol: string): Promise<{ score: number; status: string }> {
  try {
    // Extract coin from symbol (BTCUSDT -> BTC)
    const coin = symbol.replace(/USDT$/, "").replace(/USD$/, "");
    const newsResult = await fetchCryptoNews(coin);

    if (newsResult.news.length === 0) {
      return { score: 50, status: "No recent news" };
    }

    const positive = newsResult.news.filter((n) => n.sentiment === "positive").length;
    const negative = newsResult.news.filter((n) => n.sentiment === "negative").length;
    const total = newsResult.news.length;

    // Score: 0-100, 50 is neutral
    const score = 50 + ((positive - negative) / total) * 50;

    let status: string;
    if (score > 65) status = "Bullish news sentiment";
    else if (score < 35) status = "Bearish news sentiment";
    else status = "Neutral news sentiment";

    return { score: Math.round(score), status };
  } catch {
    return { score: 50, status: "Unable to fetch news" };
  }
}

// ============================================
// VOLUME & WHALE ANALYSIS
// ============================================

async function getVolumeWhaleScore(
  candles: OHLCV[],
  symbol: string
): Promise<{ score: number; status: string }> {
  const volumes = candles.map((c) => c.volume);
  const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const volumeRatio = recentVolume / avgVolume;

  // Analyze recent candle volume spikes
  const closes = candles.map((c) => c.close);
  const lastCandle = candles[candles.length - 1];
  const priceUp = lastCandle.close > lastCandle.open;

  let score = 50;
  let status = "Normal volume";

  if (volumeRatio > 2) {
    if (priceUp) {
      score = 75;
      status = "High volume buying (whale accumulation possible)";
    } else {
      score = 25;
      status = "High volume selling (whale distribution possible)";
    }
  } else if (volumeRatio > 1.5) {
    if (priceUp) {
      score = 65;
      status = "Above average buying volume";
    } else {
      score = 35;
      status = "Above average selling volume";
    }
  } else if (volumeRatio < 0.5) {
    score = 50;
    status = "Low volume - weak move";
  }

  return { score, status };
}

// ============================================
// MAIN STRATEGY FUNCTION
// ============================================

export async function generateTradeSetup(
  symbol: string,
  config: StrategyConfig = DEFAULT_CONFIG
): Promise<TradeSetupResult> {
  const spinner = ora(`Analyzing ${symbol} for trade setup...`).start();

  try {
    // Fetch main data (1h timeframe)
    spinner.text = "Fetching market data...";
    const data = await fetchCryptoData(symbol, "1h", 200);
    const candles = data.candles;
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const currentPrice = data.currentPrice;

    // =====================
    // TECHNICAL ANALYSIS
    // =====================
    spinner.text = "Calculating technical indicators...";

    // EMAs
    const emas = calculateEMAs(closes);

    // RSI
    const rsi = calculateRSI(closes, 14);
    const rsiDivergence = detectRSIDivergence(closes, rsi.values);

    // MACD
    const macd = calculateMACD(closes);

    // Bollinger Bands
    const bb = calculateBollingerBands(closes);

    // ATR for volatility
    const atr = calculateATR(candles, 14);

    // Trend
    const trend = analyzeTrend(candles);

    // Support/Resistance
    const sr = calculateSupportResistance(candles);

    // Calculate technical score
    let technicalScore = 50;
    let technicalBias: "bullish" | "bearish" | "neutral" = "neutral";

    // EMA scoring
    if (emas.alignment === "bullish") {
      technicalScore += 15;
      technicalBias = "bullish";
    } else if (emas.alignment === "bearish") {
      technicalScore -= 15;
      technicalBias = "bearish";
    }

    // Price vs EMAs
    if (currentPrice > emas.ema9 && currentPrice > emas.ema21) {
      technicalScore += 5;
    } else if (currentPrice < emas.ema9 && currentPrice < emas.ema21) {
      technicalScore -= 5;
    }

    // RSI scoring
    if (rsi.current < 30) {
      technicalScore += 10; // Oversold = bullish
    } else if (rsi.current > 70) {
      technicalScore -= 10; // Overbought = bearish
    }

    // RSI divergence
    if (rsiDivergence.type === "bullish") {
      technicalScore += 15;
    } else if (rsiDivergence.type === "bearish") {
      technicalScore -= 15;
    }

    // MACD scoring
    if (macd.crossover === "bullish") {
      technicalScore += 10;
    } else if (macd.crossover === "bearish") {
      technicalScore -= 10;
    }

    // Bollinger Band scoring
    if (currentPrice <= bb.current.lower) {
      technicalScore += 10; // At lower band = potential bounce
    } else if (currentPrice >= bb.current.upper) {
      technicalScore -= 10; // At upper band = potential rejection
    }

    technicalScore = Math.max(0, Math.min(100, technicalScore));

    // =====================
    // SMC ANALYSIS
    // =====================
    spinner.text = "Analyzing Smart Money Concepts...";

    const smcCandles = candles.slice(-50);
    const orderBlocks = findOrderBlocks(smcCandles);
    const fvgs = findFairValueGaps(candles.slice(-30));
    // Note: liquidityZones requires swingPoints, but we're not using it for scoring
    // const swingPoints = findSwingPoints(smcCandles);
    // const liquidityZones = findLiquidityZones(smcCandles, swingPoints);

    let smcScore = 50;
    let smcStatus = "No clear SMC setup";

    // Check if price is near bullish order block
    const bullishOBs = orderBlocks.filter((ob) => ob.type === "bullish");
    const bearishOBs = orderBlocks.filter((ob) => ob.type === "bearish");

    for (const ob of bullishOBs) {
      if (currentPrice >= ob.bottom && currentPrice <= ob.top * 1.01) {
        smcScore += 20;
        smcStatus = "Price at bullish order block";
        break;
      }
    }

    for (const ob of bearishOBs) {
      if (currentPrice <= ob.top && currentPrice >= ob.bottom * 0.99) {
        smcScore -= 20;
        smcStatus = "Price at bearish order block";
        break;
      }
    }

    // Check FVG
    const bullishFVGs = fvgs.filter((f) => f.type === "bullish" && !f.filled);
    const bearishFVGs = fvgs.filter((f) => f.type === "bearish" && !f.filled);

    if (bullishFVGs.length > 0) {
      const nearestBullishFVG = bullishFVGs[bullishFVGs.length - 1];
      if (currentPrice >= nearestBullishFVG.bottom && currentPrice <= nearestBullishFVG.top) {
        smcScore += 15;
        smcStatus = "Price filling bullish FVG";
      }
    }

    if (bearishFVGs.length > 0) {
      const nearestBearishFVG = bearishFVGs[bearishFVGs.length - 1];
      if (currentPrice >= nearestBearishFVG.bottom && currentPrice <= nearestBearishFVG.top) {
        smcScore -= 15;
        smcStatus = "Price filling bearish FVG";
      }
    }

    smcScore = Math.max(0, Math.min(100, smcScore));

    // =====================
    // VOLUME & WHALE ANALYSIS
    // =====================
    spinner.text = "Analyzing volume and whale activity...";
    const volumeWhale = await getVolumeWhaleScore(candles, symbol);

    // =====================
    // NEWS SENTIMENT
    // =====================
    spinner.text = "Checking news sentiment...";
    const news = await getNewsSentiment(symbol);

    // =====================
    // MULTI-TIMEFRAME
    // =====================
    spinner.text = "Performing multi-timeframe analysis...";
    const mtf = await getMultiTimeframeAnalysis(symbol);

    // =====================
    // CALCULATE OVERALL SCORE & DIRECTION
    // =====================
    const overallScore = Math.round(
      technicalScore * 0.4 + smcScore * 0.25 + volumeWhale.score * 0.2 + news.score * 0.15
    );

    // Determine direction
    let direction: "LONG" | "SHORT" | "NO_TRADE" = "NO_TRADE";
    const confidence = overallScore;

    if (config.direction === "both" || config.direction === "long") {
      if (overallScore >= 65 && (mtf.h1 === "bullish" || mtf.h4 === "bullish")) {
        direction = "LONG";
      }
    }

    if (config.direction === "both" || config.direction === "short") {
      if (overallScore <= 35 && (mtf.h1 === "bearish" || mtf.h4 === "bearish")) {
        direction = "SHORT";
      }
    }

    // =====================
    // CALCULATE ENTRY, SL, TP
    // =====================
    let entryPrice = currentPrice;
    let stopLoss: number;
    let tp1: number, tp2: number, tp3: number;

    const atrValue = atr.current;

    if (direction === "LONG") {
      // Entry at current price or slightly below
      entryPrice = currentPrice;

      // Stop loss below recent support or 1.5x ATR
      const supportStop = sr.nearestSupport * 0.995;
      const atrStop = currentPrice - atrValue * 1.5;
      stopLoss = Math.max(supportStop, atrStop);

      // Take profits
      const riskAmount = entryPrice - stopLoss;
      tp1 = entryPrice + riskAmount * 1.5; // 1:1.5 RR
      tp2 = entryPrice + riskAmount * 2.5; // 1:2.5 RR
      tp3 = entryPrice + riskAmount * 4; // 1:4 RR
    } else if (direction === "SHORT") {
      entryPrice = currentPrice;

      // Stop loss above recent resistance or 1.5x ATR
      const resistanceStop = sr.nearestResistance * 1.005;
      const atrStop = currentPrice + atrValue * 1.5;
      stopLoss = Math.min(resistanceStop, atrStop);

      // Take profits
      const riskAmount = stopLoss - entryPrice;
      tp1 = entryPrice - riskAmount * 1.5;
      tp2 = entryPrice - riskAmount * 2.5;
      tp3 = entryPrice - riskAmount * 4;
    } else {
      // No trade
      stopLoss = currentPrice;
      tp1 = currentPrice;
      tp2 = currentPrice;
      tp3 = currentPrice;
    }

    // =====================
    // RISK MANAGEMENT
    // =====================
    const leverage = calculateLeverage(atrValue, currentPrice, confidence, config);
    const riskRewardRatio =
      direction !== "NO_TRADE" ? Math.abs(tp2 - entryPrice) / Math.abs(entryPrice - stopLoss) : 0;
    const positionSize = calculatePositionSize(entryPrice, stopLoss, config.riskPerTrade);

    // =====================
    // TRAILING STOPS
    // =====================
    const trailingStops =
      direction !== "NO_TRADE"
        ? generateTrailingStops(entryPrice, tp1, tp2, tp3, stopLoss, direction)
        : [];

    // =====================
    // ALERT STATUS
    // =====================
    let alertStatus: "FORMING" | "READY" | "ACTIVE" | "MISSED" = "FORMING";
    const alertReasons: string[] = [];

    if (direction !== "NO_TRADE") {
      if (mtf.confirmed) {
        alertStatus = "READY";
        alertReasons.push("Multi-timeframe alignment confirmed");
      }
      if (confidence >= 70) {
        alertStatus = "READY";
        alertReasons.push(`High confidence setup (${confidence}%)`);
      }
      if (rsiDivergence.type !== "none") {
        alertReasons.push(`RSI ${rsiDivergence.type} divergence detected`);
      }
      if (smcScore > 60 || smcScore < 40) {
        alertReasons.push(smcStatus);
      }
    } else {
      alertReasons.push("No clear setup - waiting for better conditions");
    }

    // =====================
    // WARNINGS
    // =====================
    const warnings: string[] = [];

    if (atrValue / currentPrice > 0.03) {
      warnings.push("High volatility - consider reducing position size");
    }
    if (!mtf.confirmed && direction !== "NO_TRADE") {
      warnings.push("Multi-timeframe not aligned - trade with caution");
    }
    if (rsi.current > 80 && direction === "LONG") {
      warnings.push("RSI extremely overbought - potential pullback");
    }
    if (rsi.current < 20 && direction === "SHORT") {
      warnings.push("RSI extremely oversold - potential bounce");
    }

    spinner.succeed(`Analysis complete for ${symbol}`);

    return {
      symbol: data.symbol,
      direction,
      confidence,
      entryPrice,
      stopLoss,
      takeProfit1: tp1,
      takeProfit2: tp2,
      takeProfit3: tp3,
      recommendedLeverage: leverage.recommended,
      maxLeverage: leverage.max,
      riskRewardRatio,
      positionSizePercent: positionSize,
      technicalScore,
      smcScore,
      volumeWhaleScore: volumeWhale.score,
      newsScore: news.score,
      overallScore,
      mtfAlignment: {
        m15: mtf.m15,
        h1: mtf.h1,
        h4: mtf.h4,
      },
      mtfConfirmed: mtf.confirmed,
      trailingStopLevels: trailingStops,
      alertStatus,
      alertReasons,
      analysis: {
        emaStatus: `EMA alignment: ${emas.alignment}`,
        rsiStatus: `RSI: ${rsi.current.toFixed(1)} (${rsi.current < 30 ? "oversold" : rsi.current > 70 ? "overbought" : "neutral"})`,
        macdStatus: `MACD: ${macd.crossover} crossover`,
        bbStatus: `BB: Price at ${currentPrice <= bb.current.lower ? "lower" : currentPrice >= bb.current.upper ? "upper" : "middle"} band`,
        smcStatus,
        volumeStatus: volumeWhale.status,
        newsStatus: news.status,
      },
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

export function displayTradeSetup(setup: TradeSetupResult): void {
  console.log("");

  // Header based on direction
  const headerColor =
    setup.direction === "LONG"
      ? chalk.green
      : setup.direction === "SHORT"
        ? chalk.red
        : chalk.yellow;
  const directionEmoji =
    setup.direction === "LONG" ? "🟢" : setup.direction === "SHORT" ? "🔴" : "⚪";

  console.log(
    headerColor("  ╔═══════════════════════════════════════════════════════════════════════╗")
  );
  console.log(
    headerColor(
      `  ║          ${directionEmoji} SMART TRADING STRATEGY - ${setup.symbol.padEnd(20)}        ║`
    )
  );
  console.log(
    headerColor("  ╚═══════════════════════════════════════════════════════════════════════╝")
  );
  console.log("");

  // Direction and Confidence
  const directionBadge =
    setup.direction === "LONG"
      ? chalk.bgGreen.white(" LONG ")
      : setup.direction === "SHORT"
        ? chalk.bgRed.white(" SHORT ")
        : chalk.bgYellow.black(" NO TRADE ");

  const confidenceBar = getConfidenceBar(setup.confidence);

  console.log(`  ${directionBadge}  Confidence: ${confidenceBar} ${setup.confidence}%`);
  console.log("");

  // Alert Status
  const alertColor =
    setup.alertStatus === "READY"
      ? chalk.green
      : setup.alertStatus === "FORMING"
        ? chalk.yellow
        : chalk.gray;
  console.log(`  ${chalk.cyan("📢 Alert:")} ${alertColor(setup.alertStatus)}`);
  for (const reason of setup.alertReasons) {
    console.log(`     ${chalk.dim("•")} ${chalk.gray(reason)}`);
  }
  console.log("");

  if (setup.direction !== "NO_TRADE") {
    // Entry & Exit Box
    console.log(
      chalk.cyan("  ┌─────────────────────────────────────────────────────────────────────┐")
    );
    console.log(
      chalk.cyan("  │                      📍 ENTRY & EXIT LEVELS                        │")
    );
    console.log(
      chalk.cyan("  ├─────────────────────────────────────────────────────────────────────┤")
    );

    console.log(
      `  │  ${chalk.yellow("Entry Price:")}    ${chalk.white.bold(formatPrice(setup.entryPrice))}`
    );
    console.log(
      `  │  ${chalk.red("Stop Loss:")}      ${chalk.red.bold(formatPrice(setup.stopLoss))} ${chalk.dim(`(${((Math.abs(setup.entryPrice - setup.stopLoss) / setup.entryPrice) * 100).toFixed(2)}%)`)}`
    );
    console.log(`  │`);
    console.log(
      `  │  ${chalk.green("Take Profit 1:")} ${chalk.green(formatPrice(setup.takeProfit1))} ${chalk.dim("(1.5R)")}`
    );
    console.log(
      `  │  ${chalk.green("Take Profit 2:")} ${chalk.green(formatPrice(setup.takeProfit2))} ${chalk.dim("(2.5R)")}`
    );
    console.log(
      `  │  ${chalk.green("Take Profit 3:")} ${chalk.green(formatPrice(setup.takeProfit3))} ${chalk.dim("(4R)")}`
    );

    console.log(
      chalk.cyan("  └─────────────────────────────────────────────────────────────────────┘")
    );
    console.log("");

    // Risk Management Box
    console.log(
      chalk.magenta("  ┌─────────────────────────────────────────────────────────────────────┐")
    );
    console.log(
      chalk.magenta("  │                      ⚖️  RISK MANAGEMENT                           │")
    );
    console.log(
      chalk.magenta("  ├─────────────────────────────────────────────────────────────────────┤")
    );

    const leverageBadge =
      setup.recommendedLeverage <= 5
        ? chalk.green
        : setup.recommendedLeverage <= 10
          ? chalk.yellow
          : chalk.red;

    console.log(
      `  │  ${chalk.yellow("Recommended Leverage:")} ${leverageBadge.bold(`${setup.recommendedLeverage}x`)} ${chalk.dim(`(max: ${setup.maxLeverage}x)`)}`
    );
    console.log(
      `  │  ${chalk.yellow("Risk/Reward Ratio:")}    ${chalk.cyan.bold(`1:${setup.riskRewardRatio.toFixed(1)}`)}`
    );
    console.log(
      `  │  ${chalk.yellow("Position Size:")}        ${chalk.white(`${setup.positionSizePercent.toFixed(1)}% of account`)}`
    );

    console.log(
      chalk.magenta("  └─────────────────────────────────────────────────────────────────────┘")
    );
    console.log("");

    // Trailing Stop Box
    console.log(
      chalk.blue("  ┌─────────────────────────────────────────────────────────────────────┐")
    );
    console.log(
      chalk.blue("  │                      📈 TRAILING STOP PLAN                         │")
    );
    console.log(
      chalk.blue("  ├─────────────────────────────────────────────────────────────────────┤")
    );

    for (let i = 0; i < setup.trailingStopLevels.length; i++) {
      const ts = setup.trailingStopLevels[i];
      console.log(
        `  │  ${chalk.cyan(`Step ${i + 1}:`)} When price hits ${chalk.yellow(formatPrice(ts.trigger))}`
      );
      console.log(`  │         → Move stop to ${chalk.green(formatPrice(ts.newStop))}`);
      console.log(`  │         ${chalk.dim(ts.description)}`);
      if (i < setup.trailingStopLevels.length - 1) console.log(`  │`);
    }

    console.log(
      chalk.blue("  └─────────────────────────────────────────────────────────────────────┘")
    );
    console.log("");
  }

  // Multi-Timeframe Analysis
  console.log(
    chalk.yellow("  ┌─────────────────────────────────────────────────────────────────────┐")
  );
  console.log(
    chalk.yellow("  │                   ⏰ MULTI-TIMEFRAME ANALYSIS                      │")
  );
  console.log(
    chalk.yellow("  ├─────────────────────────────────────────────────────────────────────┤")
  );

  const mtfIcon = (bias: string) =>
    bias === "bullish" ? chalk.green("▲") : bias === "bearish" ? chalk.red("▼") : chalk.gray("●");
  const mtfColor = (bias: string) =>
    bias === "bullish" ? chalk.green : bias === "bearish" ? chalk.red : chalk.gray;

  console.log(
    `  │  ${chalk.dim("15min:")} ${mtfIcon(setup.mtfAlignment.m15)} ${mtfColor(setup.mtfAlignment.m15)(setup.mtfAlignment.m15.padEnd(10))}  ${chalk.dim("1hour:")} ${mtfIcon(setup.mtfAlignment.h1)} ${mtfColor(setup.mtfAlignment.h1)(setup.mtfAlignment.h1.padEnd(10))}  ${chalk.dim("4hour:")} ${mtfIcon(setup.mtfAlignment.h4)} ${mtfColor(setup.mtfAlignment.h4)(setup.mtfAlignment.h4)}`
  );
  console.log(`  │`);
  console.log(
    `  │  ${setup.mtfConfirmed ? chalk.green("✓ All timeframes aligned!") : chalk.yellow("⚠ Timeframes not fully aligned")}`
  );

  console.log(
    chalk.yellow("  └─────────────────────────────────────────────────────────────────────┘")
  );
  console.log("");

  // Score Breakdown
  console.log(
    chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐")
  );
  console.log(
    chalk.gray("  │                      📊 SCORE BREAKDOWN                            │")
  );
  console.log(
    chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤")
  );

  console.log(
    `  │  ${chalk.dim("Technical (40%):")}  ${getScoreBar(setup.technicalScore)} ${setup.technicalScore}%`
  );
  console.log(
    `  │  ${chalk.dim("SMC (25%):")}        ${getScoreBar(setup.smcScore)} ${setup.smcScore}%`
  );
  console.log(
    `  │  ${chalk.dim("Volume (20%):")}     ${getScoreBar(setup.volumeWhaleScore)} ${setup.volumeWhaleScore}%`
  );
  console.log(
    `  │  ${chalk.dim("News (15%):")}       ${getScoreBar(setup.newsScore)} ${setup.newsScore}%`
  );
  console.log(`  │  ${"─".repeat(50)}`);
  console.log(
    `  │  ${chalk.white.bold("Overall:")}         ${getScoreBar(setup.overallScore)} ${chalk.bold(setup.overallScore + "%")}`
  );

  console.log(
    chalk.gray("  └─────────────────────────────────────────────────────────────────────┘")
  );
  console.log("");

  // Detailed Analysis
  console.log(
    chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐")
  );
  console.log(
    chalk.gray("  │                      🔍 DETAILED ANALYSIS                          │")
  );
  console.log(
    chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤")
  );

  console.log(`  │  ${chalk.cyan("•")} ${setup.analysis.emaStatus}`);
  console.log(`  │  ${chalk.cyan("•")} ${setup.analysis.rsiStatus}`);
  console.log(`  │  ${chalk.cyan("•")} ${setup.analysis.macdStatus}`);
  console.log(`  │  ${chalk.cyan("•")} ${setup.analysis.bbStatus}`);
  console.log(`  │  ${chalk.cyan("•")} ${setup.analysis.smcStatus}`);
  console.log(`  │  ${chalk.cyan("•")} ${setup.analysis.volumeStatus}`);
  console.log(`  │  ${chalk.cyan("•")} ${setup.analysis.newsStatus}`);

  console.log(
    chalk.gray("  └─────────────────────────────────────────────────────────────────────┘")
  );
  console.log("");

  // Warnings
  if (setup.warnings.length > 0) {
    console.log(
      chalk.red("  ┌─────────────────────────────────────────────────────────────────────┐")
    );
    console.log(
      chalk.red("  │                      ⚠️  WARNINGS                                  │")
    );
    console.log(
      chalk.red("  ├─────────────────────────────────────────────────────────────────────┤")
    );

    for (const warning of setup.warnings) {
      console.log(`  │  ${chalk.yellow("!")} ${chalk.yellow(warning)}`);
    }

    console.log(
      chalk.red("  └─────────────────────────────────────────────────────────────────────┘")
    );
    console.log("");
  }

  // Disclaimer
  console.log(
    chalk.dim.italic("  ⚠️  This is not financial advice. Always manage your risk and DYOR.")
  );
  console.log(
    chalk.dim.italic("  💡 Tip: Wait for price to reach entry zone before executing trade.")
  );
  console.log("");
}

// Helper functions for display
function formatPrice(price: number): string {
  if (price < 0.001) return `$${price.toFixed(8)}`;
  if (price < 1) return `$${price.toFixed(6)}`;
  if (price < 100) return `$${price.toFixed(4)}`;
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getScoreBar(score: number, width: number = 15): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;

  let color = chalk.green;
  if (score < 40) color = chalk.red;
  else if (score < 60) color = chalk.yellow;

  return color("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}

function getConfidenceBar(confidence: number): string {
  const width = 20;
  const filled = Math.round((confidence / 100) * width);
  const empty = width - filled;

  let color = chalk.green;
  if (confidence < 40) color = chalk.red;
  else if (confidence < 60) color = chalk.yellow;

  return "[" + color("█".repeat(filled)) + chalk.gray("░".repeat(empty)) + "]";
}

// ============================================
// MAIN RUNNER FUNCTION
// ============================================

export async function runStrategy(
  symbol: string,
  config?: Partial<StrategyConfig>
): Promise<TradeSetupResult | null> {
  const fullConfig: StrategyConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  try {
    const setup = await generateTradeSetup(symbol, fullConfig);
    displayTradeSetup(setup);
    return setup;
  } catch (error: any) {
    console.log("");
    console.log(
      chalk.red("  ╔═══════════════════════════════════════════════════════════════════════╗")
    );
    console.log(
      chalk.red("  ║                      ❌ STRATEGY ERROR                                ║")
    );
    console.log(
      chalk.red("  ╚═══════════════════════════════════════════════════════════════════════╝")
    );
    console.log("");

    if (error.message?.includes("Invalid symbol") || error.message?.includes("Failed to fetch")) {
      console.log(chalk.yellow(`  ⚠️  Invalid symbol: "${symbol.toUpperCase()}"`));
      console.log("");

      // Get similar symbols from Binance
      const suggestions = await findSimilarSymbols(symbol, 8);

      if (suggestions.length > 0) {
        console.log(chalk.gray("  Did you mean one of these?"));
        console.log("");
        console.log(chalk.cyan(`    ${suggestions.join(", ")}`));
        console.log("");
      }

      console.log(chalk.gray("  The symbol you entered is not available on Binance."));
      console.log(
        chalk.gray("  You can use any valid Binance USDT pair (e.g., BTCUSDT, HYPEUSDT, WIFUSDT)")
      );
    } else {
      console.log(chalk.yellow(`  ⚠️  ${error.message || "An unexpected error occurred"}`));
    }
    console.log("");

    return null;
  }
}
