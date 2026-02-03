"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Suppress ora spinners in server mode
process.env.CI = "true";
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const crypto_1 = require("../lib/crypto");
const strategy_engine_1 = require("../lib/crypto/strategy-engine");
const market_analyzer_1 = require("../lib/crypto/market-analyzer");
const orderblock_strategy_1 = require("../lib/crypto/orderblock-strategy");
const ict_strategy_1 = require("../lib/crypto/ict-strategy");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// CORS Configuration for Vercel
const corsOptions = {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    credentials: false,
};
// Middleware
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
// Handle preflight OPTIONS requests
app.options("*", (0, cors_1.default)(corsOptions));
// Manual CORS headers for all responses (backup for serverless)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});
// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
// ============================================
// HEALTH CHECK
// ============================================
app.get("/", (req, res) => {
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
app.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: Date.now() });
});
// ============================================
// TRADING SIGNAL ENDPOINTS
// ============================================
/**
 * Quick Trading Signal
 * GET /api/signal/:symbol?interval=1h
 */
app.get("/api/signal/:symbol", async (req, res) => {
    try {
        const { symbol } = req.params;
        const interval = req.query.interval || "1h";
        // Fetch data and generate signal directly (avoid ora spinner issues)
        const data = await (0, crypto_1.fetchCryptoData)(symbol, interval, 250);
        const signal = (0, crypto_1.generateSignal)(data);
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
    }
    catch (error) {
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
app.get("/api/analyze/:symbol", async (req, res) => {
    try {
        const { symbol } = req.params;
        const analysis = await (0, market_analyzer_1.analyzeMarket)(symbol);
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
    }
    catch (error) {
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
app.get("/api/smc/:symbol", async (req, res) => {
    try {
        const { symbol } = req.params;
        const interval = req.query.interval || "4h";
        const data = await (0, crypto_1.fetchCryptoData)(symbol, interval, 200);
        const smc = (0, crypto_1.analyzeSMC)(data.candles);
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
    }
    catch (error) {
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
app.get("/api/orderblock/:symbol", async (req, res) => {
    try {
        const { symbol } = req.params;
        const interval = req.query.interval || "4h";
        const result = await (0, orderblock_strategy_1.generateOrderBlockSignal)(symbol, interval);
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
    }
    catch (error) {
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
app.get("/api/ict/:symbol", async (req, res) => {
    try {
        const { symbol } = req.params;
        const interval = req.query.interval || "1h";
        const result = await (0, ict_strategy_1.generateICTSignal)(symbol, interval);
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
    }
    catch (error) {
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
app.get("/api/strategy/:symbol", async (req, res) => {
    try {
        const { symbol } = req.params;
        const style = req.query.style || "moderate";
        const direction = req.query.direction || "both";
        const maxLeverage = parseInt(req.query.leverage) || 20;
        const result = await (0, strategy_engine_1.generateTradeSetup)(symbol, {
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
    }
    catch (error) {
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
app.get("/api/price/:symbol", async (req, res) => {
    try {
        const { symbol } = req.params;
        const interval = req.query.interval || "1h";
        const limit = parseInt(req.query.limit) || 100;
        const data = await (0, crypto_1.fetchCryptoData)(symbol, interval, limit);
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
    }
    catch (error) {
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
app.post("/api/batch/signal", async (req, res) => {
    try {
        const { symbols, interval = "1h" } = req.body;
        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({
                success: false,
                error: "symbols array is required",
            });
        }
        const results = await Promise.all(symbols.slice(0, 10).map(async (symbol) => {
            try {
                const data = await (0, crypto_1.fetchCryptoData)(symbol, interval, 250);
                const signal = (0, crypto_1.generateSignal)(data);
                return {
                    symbol: data.symbol,
                    success: true,
                    price: data.currentPrice,
                    signal: signal.signal,
                    confidence: signal.confidence,
                };
            }
            catch (error) {
                return {
                    symbol,
                    success: false,
                    error: error.message,
                };
            }
        }));
        res.json({
            success: true,
            data: results,
            timestamp: Date.now(),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || "Internal server error",
        });
    }
});
// ============================================
// ERROR HANDLING
// ============================================
app.use((req, res) => {
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
app.use((err, req, res, next) => {
    console.error("Server error:", err);
    res.status(500).json({
        success: false,
        error: "Internal server error",
    });
});
// ============================================
// START SERVER (only when not in serverless)
// ============================================
// For Vercel serverless, we export the app without calling listen()
if (!process.env.VERCEL) {
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
}
// Export for Vercel serverless
exports.default = app;
module.exports = app;
