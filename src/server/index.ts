/**
 * Trading Signal API Server
 * REST API for crypto trading strategies
 *
 * Free deployment options:
 * - Railway.app (free tier)
 * - Render.com (free tier)
 * - Vercel (serverless)
 * - Fly.io (free tier)
 * - Local: node dist/server/index.js
 */

// Suppress ora spinners in server mode
process.env.CI = "true";

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import {
  fetchCryptoData,
  analyzeSMC,
  findOrderBlocks,
  findSwingPoints,
  calculatePremiumDiscount,
  TimeInterval,
  generateSignal,
} from "../lib/crypto";
import { generateTradeSetup } from "../lib/crypto/strategy-engine";
import { analyzeMarket } from "../lib/crypto/market-analyzer";
import { generateOrderBlockSignal } from "../lib/crypto/orderblock-strategy";
import { generateICTSignal } from "../lib/crypto/ict-strategy";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get("/", (req: Request, res: Response) => {
  res.json({
    name: "Crypto Trading Signal API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      signal: "GET /api/signal/:symbol",
      analyze: "GET /api/analyze/:symbol",
      smc: "GET /api/smc/:symbol",
      orderblock: "GET /api/orderblock/:symbol",
      ict: "GET /api/ict/:symbol",
      strategy: "GET /api/strategy/:symbol",
      price: "GET /api/price/:symbol",
    },
    documentation: "https://github.com/your-repo/trading-api",
  });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "healthy", timestamp: Date.now() });
});

// ============================================
// TRADING SIGNAL ENDPOINTS
// ============================================

/**
 * Quick Trading Signal
 * GET /api/signal/:symbol?interval=1h
 */
app.get("/api/signal/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const interval = (req.query.interval as TimeInterval) || "1h";

    // Fetch data and generate signal directly (avoid ora spinner issues)
    const data = await fetchCryptoData(symbol, interval, 250);
    const signal = generateSignal(data);

    res.json({
      success: true,
      data: {
        symbol: data.symbol,
        price: data.currentPrice,
        priceChange24h: data.priceChangePercent24h,
        signal: signal.signal,
        confidence: signal.confidence,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        indicators: signal.indicators,
        reasoning: signal.reasoning,
      },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error(`Signal error for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      symbol: req.params.symbol,
    });
  }
});

/**
 * Comprehensive Market Analysis
 * GET /api/analyze/:symbol
 */
app.get("/api/analyze/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    const analysis = await analyzeMarket(symbol);

    res.json({
      success: true,
      data: {
        symbol: analysis.symbol,
        currentPrice: analysis.currentPrice,
        priceChange24h: analysis.priceChange24h,
        recommendation: analysis.recommendation,
        confidence: analysis.confidence,
        riskLevel: analysis.riskLevel,
        timeframes: analysis.timeframes,
        timeframeAlignment: analysis.timeframeAlignment,
        indicators: analysis.indicators,
        timing: analysis.timing,
        tradeSetup: analysis.tradeSetup,
        marketCondition: analysis.marketCondition,
        reasoning: analysis.reasoning,
      },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

/**
 * Smart Money Concepts Analysis
 * GET /api/smc/:symbol?interval=4h
 */
app.get("/api/smc/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const interval = (req.query.interval as TimeInterval) || "4h";

    const data = await fetchCryptoData(symbol, interval, 200);
    const smc = analyzeSMC(data.candles);

    res.json({
      success: true,
      data: {
        symbol: data.symbol,
        currentPrice: data.currentPrice,
        priceChange24h: data.priceChangePercent24h,
        marketStructure: smc.marketStructure,
        orderBlocks: {
          bullish: smc.orderBlocks.bullish,
          bearish: smc.orderBlocks.bearish,
          nearest: smc.orderBlocks.nearest,
        },
        fairValueGaps: {
          bullish: smc.fairValueGaps.bullish,
          bearish: smc.fairValueGaps.bearish,
          unfilled: smc.fairValueGaps.unfilled,
        },
        liquidity: smc.liquidity,
        premiumDiscount: smc.premiumDiscount,
        bias: smc.bias,
      },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

/**
 * Order Block Strategy
 * GET /api/orderblock/:symbol?interval=4h
 */
app.get("/api/orderblock/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const interval = (req.query.interval as TimeInterval) || "4h";

    const result = await generateOrderBlockSignal(symbol, interval);

    res.json({
      success: true,
      data: {
        symbol: result.symbol,
        currentPrice: result.currentPrice,
        signal: result.signal,
        confidence: result.confidence,
        activeOrderBlock: result.activeOB,
        orderBlocks: {
          bullish: result.bullishOBs,
          bearish: result.bearishOBs,
        },
        tradeSetup: {
          entry: result.entry,
          stopLoss: result.stopLoss,
          takeProfit1: result.takeProfit1,
          takeProfit2: result.takeProfit2,
          takeProfit3: result.takeProfit3,
          riskRewardRatio: result.riskRewardRatio,
        },
        context: {
          trend: result.trend,
          premiumDiscount: result.premiumDiscount,
        },
        reasoning: result.reasoning,
        warnings: result.warnings,
      },
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

/**
 * ICT Strategy
 * GET /api/ict/:symbol?interval=1h
 */
app.get("/api/ict/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const interval = (req.query.interval as TimeInterval) || "1h";

    const result = await generateICTSignal(symbol, interval);

    res.json({
      success: true,
      data: {
        symbol: result.symbol,
        currentPrice: result.currentPrice,
        signal: result.signal,
        confidence: result.confidence,
        modelType: result.modelType,
        killzone: result.killzone,
        inKillzone: result.inKillzone,
        ote: result.ote,
        powerOf3: result.powerOf3,
        marketStructure: result.marketStructure,
        premiumDiscount: result.premiumDiscount,
        displacement: result.displacement,
        breakerBlocks: result.breakerBlocks,
        activeBreaker: result.activeBreaker,
        inducements: result.inducements,
        recentSweep: result.recentSweep,
        tradeSetup: {
          entry: result.entry,
          stopLoss: result.stopLoss,
          takeProfit1: result.takeProfit1,
          takeProfit2: result.takeProfit2,
          takeProfit3: result.takeProfit3,
          riskRewardRatio: result.riskRewardRatio,
        },
        confluenceFactors: result.confluenceFactors,
        reasoning: result.reasoning,
        warnings: result.warnings,
      },
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

/**
 * Full Trading Strategy
 * GET /api/strategy/:symbol?style=moderate&direction=both&leverage=20
 */
app.get("/api/strategy/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const style = (req.query.style as "conservative" | "moderate" | "aggressive") || "moderate";
    const direction = (req.query.direction as "both" | "long" | "short") || "both";
    const maxLeverage = parseInt(req.query.leverage as string) || 20;

    const result = await generateTradeSetup(symbol, {
      style,
      direction,
      maxLeverage,
      riskPerTrade: 2,
    });

    res.json({
      success: true,
      data: {
        symbol: result.symbol,
        direction: result.direction,
        confidence: result.confidence,
        entry: {
          price: result.entryPrice,
          stopLoss: result.stopLoss,
          takeProfit1: result.takeProfit1,
          takeProfit2: result.takeProfit2,
          takeProfit3: result.takeProfit3,
        },
        riskManagement: {
          recommendedLeverage: result.recommendedLeverage,
          maxLeverage: result.maxLeverage,
          riskRewardRatio: result.riskRewardRatio,
          positionSizePercent: result.positionSizePercent,
        },
        scores: {
          technical: result.technicalScore,
          smc: result.smcScore,
          volumeWhale: result.volumeWhaleScore,
          news: result.newsScore,
          overall: result.overallScore,
        },
        multiTimeframe: {
          alignment: result.mtfAlignment,
          confirmed: result.mtfConfirmed,
        },
        trailingStops: result.trailingStopLevels,
        alert: {
          status: result.alertStatus,
          reasons: result.alertReasons,
        },
        analysis: result.analysis,
        warnings: result.warnings,
      },
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

/**
 * Price Data
 * GET /api/price/:symbol?interval=1h&limit=100
 */
app.get("/api/price/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const interval = (req.query.interval as TimeInterval) || "1h";
    const limit = parseInt(req.query.limit as string) || 100;

    const data = await fetchCryptoData(symbol, interval, limit);

    // Calculate 24h high/low/volume from candles
    const recentCandles = data.candles.slice(-24);
    const high24h = Math.max(...recentCandles.map((c) => c.high));
    const low24h = Math.min(...recentCandles.map((c) => c.low));
    const volume24h = recentCandles.reduce((sum, c) => sum + c.volume, 0);

    res.json({
      success: true,
      data: {
        symbol: data.symbol,
        currentPrice: data.currentPrice,
        priceChange24h: data.priceChangePercent24h,
        high24h,
        low24h,
        volume24h,
        candles: data.candles.map((c) => ({
          timestamp: c.timestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        })),
      },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

/**
 * Batch Analysis - Multiple symbols
 * POST /api/batch/signal
 * Body: { symbols: ["BTC", "ETH", "SOL"], interval: "1h" }
 */
app.post("/api/batch/signal", async (req: Request, res: Response) => {
  try {
    const { symbols, interval = "1h" } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        error: "symbols array is required",
      });
    }

    const results = await Promise.all(
      symbols.slice(0, 10).map(async (symbol: string) => {
        try {
          const data = await fetchCryptoData(symbol, interval as TimeInterval, 250);
          const signal = generateSignal(data);
          return {
            symbol: data.symbol,
            success: true,
            price: data.currentPrice,
            signal: signal.signal,
            confidence: signal.confidence,
          };
        } catch (error: any) {
          return {
            symbol,
            success: false,
            error: error.message,
          };
        }
      })
    );

    res.json({
      success: true,
      data: results,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    availableEndpoints: [
      "GET /api/signal/:symbol",
      "GET /api/analyze/:symbol",
      "GET /api/smc/:symbol",
      "GET /api/orderblock/:symbol",
      "GET /api/ict/:symbol",
      "GET /api/strategy/:symbol",
      "GET /api/price/:symbol",
      "POST /api/batch/signal",
    ],
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         🚀 CRYPTO TRADING SIGNAL API SERVER               ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                 ║
║                                                           ║
║  Endpoints:                                               ║
║    GET  /api/signal/:symbol      Quick signal             ║
║    GET  /api/analyze/:symbol     Comprehensive analysis   ║
║    GET  /api/smc/:symbol         Smart Money Concepts     ║
║    GET  /api/orderblock/:symbol  Order Block strategy     ║
║    GET  /api/ict/:symbol         ICT strategy             ║
║    GET  /api/strategy/:symbol    Full trading strategy    ║
║    GET  /api/price/:symbol       Price & candle data      ║
║    POST /api/batch/signal        Batch signals            ║
║                                                           ║
║  Free Deployment:                                         ║
║    - Railway.app                                          ║
║    - Render.com                                           ║
║    - Fly.io                                               ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
