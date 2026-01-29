"use strict";
/**
 * Trading Signal Generator with AI Reasoning
 * Combines technical analysis with AI-powered insights
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTradingSignal = generateTradingSignal;
exports.displaySignal = displaySignal;
exports.quickSignal = quickSignal;
exports.fullSignal = fullSignal;
exports.displayComprehensiveAnalysis = displayComprehensiveAnalysis;
exports.comprehensiveAnalysis = comprehensiveAnalysis;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const data_fetcher_1 = require("./data-fetcher");
const analyzer_1 = require("./analyzer");
const market_analyzer_1 = require("./market-analyzer");
const config_1 = require("../config");
const groq_provider_1 = require("../models/groq-provider");
/**
 * Generate AI reasoning for the trading signal
 */
async function generateAIReasoning(symbol, signal, price, priceChange24h) {
    const apiKey = (0, config_1.getApiKey)();
    if (!apiKey) {
        return "AI reasoning unavailable (no API key configured)";
    }
    const modelConfig = (0, config_1.getModelConfig)();
    const provider = new groq_provider_1.GroqProvider(modelConfig.modelId, 0.7);
    provider.initialize(apiKey, modelConfig.modelId);
    const prompt = `You are a crypto trading analyst. Based on the following technical analysis, provide a brief (2-3 sentences) trading insight and recommendation.

Symbol: ${symbol}
Current Price: $${price.toLocaleString()}
24h Change: ${priceChange24h.toFixed(2)}%

Technical Analysis:
- Signal: ${signal.signal}
- Confidence: ${signal.confidence}%
- Trend: ${signal.indicators.trend}
- EMA Crossover: ${signal.indicators.emaCrossover}
- Price vs EMAs: ${signal.indicators.priceVsEMA}
- Suggested Stop-Loss: ${signal.stopLoss}%
- Suggested Take-Profit: ${signal.takeProfit}%

Key Observations:
${signal.reasoning.map((r) => `- ${r}`).join("\n")}

Provide a concise trading insight (2-3 sentences) explaining the signal and any cautions. Be direct and actionable.`;
    try {
        const stream = provider.streamChat([{ role: "user", content: prompt }], [] // No tools needed
        );
        let response = "";
        for await (const chunk of stream) {
            if (chunk.content && typeof chunk.content === "string") {
                response += chunk.content;
            }
        }
        return response.trim();
    }
    catch (error) {
        return `AI reasoning unavailable: ${error.message}`;
    }
}
/**
 * Main function to generate trading signal with AI reasoning
 */
async function generateTradingSignal(symbol, interval = "1h", includeAI = true) {
    const spinner = (0, ora_1.default)(`Fetching ${symbol.toUpperCase()} data...`).start();
    try {
        // Fetch crypto data
        const data = await (0, data_fetcher_1.fetchCryptoData)(symbol, interval, 250); // Get 250 candles for EMA200
        spinner.text = "Analyzing chart data...";
        // Generate technical signal
        const signal = (0, analyzer_1.generateSignal)(data);
        spinner.text = "Generating trading signal...";
        let aiReasoning;
        // Generate AI reasoning if requested
        if (includeAI) {
            spinner.text = "Getting AI insights...";
            aiReasoning = await generateAIReasoning(data.symbol, signal, data.currentPrice, data.priceChangePercent24h);
        }
        spinner.succeed(`Analysis complete for ${data.symbol}`);
        return {
            success: true,
            symbol: data.symbol,
            signal,
            aiReasoning,
            price: data.currentPrice,
            priceChange24h: data.priceChangePercent24h,
        };
    }
    catch (error) {
        spinner.fail(`Failed to analyze ${symbol}`);
        return {
            success: false,
            symbol: (0, data_fetcher_1.normalizeSymbol)(symbol),
            error: error.message,
        };
    }
}
/**
 * Display trading signal in terminal
 */
function displaySignal(result) {
    if (!result.success || !result.signal) {
        console.log(chalk_1.default.red(`\nError: ${result.error}`));
        return;
    }
    const { signal, symbol, price, priceChange24h, aiReasoning } = result;
    // Signal colors
    const signalColor = signal.signal === "BUY"
        ? chalk_1.default.green.bold
        : signal.signal === "SELL"
            ? chalk_1.default.red.bold
            : chalk_1.default.yellow.bold;
    const signalIcon = signal.signal === "BUY" ? "\u{1F7E2}" : signal.signal === "SELL" ? "\u{1F534}" : "\u{1F7E1}";
    const trendIcon = signal.indicators.trend === "bullish"
        ? chalk_1.default.green("\u{2191}")
        : signal.indicators.trend === "bearish"
            ? chalk_1.default.red("\u{2193}")
            : chalk_1.default.yellow("\u{2192}");
    const changeColor = priceChange24h >= 0 ? chalk_1.default.green : chalk_1.default.red;
    const changeSign = priceChange24h >= 0 ? "+" : "";
    // Format price for display
    const formattedPrice = price < 1
        ? `$${price.toFixed(4)}`
        : price < 100
            ? `$${price.toFixed(2)}`
            : `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    // Header with current price
    console.log("");
    console.log(chalk_1.default.cyan("\u{250C}" + "\u{2500}".repeat(45) + "\u{2510}"));
    console.log(chalk_1.default.cyan("\u{2502}") +
        chalk_1.default.bold.white(`  \u{1F4CA} ${symbol}`.padEnd(44)) +
        chalk_1.default.cyan("\u{2502}"));
    console.log(chalk_1.default.cyan("\u{2502}") +
        chalk_1.default.bold.yellow(`  Current Price: ${formattedPrice}`).padEnd(44) +
        chalk_1.default.cyan("\u{2502}"));
    console.log(chalk_1.default.cyan("\u{2502}") +
        `  24h: ${changeColor(changeSign + priceChange24h.toFixed(2) + "%")}`.padEnd(52) +
        chalk_1.default.cyan("\u{2502}"));
    console.log(chalk_1.default.cyan("\u{251C}" + "\u{2500}".repeat(45) + "\u{2524}"));
    // Signal
    console.log(chalk_1.default.cyan("\u{2502}") +
        `  Signal:      ${signalIcon} ${signalColor(signal.signal)}`.padEnd(53) +
        chalk_1.default.cyan("\u{2502}"));
    console.log(chalk_1.default.cyan("\u{2502}") +
        `  Confidence:  ${chalk_1.default.white(signal.confidence + "%")}`.padEnd(53) +
        chalk_1.default.cyan("\u{2502}"));
    console.log(chalk_1.default.cyan("\u{2502}") +
        `  Stop-Loss:   ${chalk_1.default.red("-" + signal.stopLoss + "%")}`.padEnd(53) +
        chalk_1.default.cyan("\u{2502}"));
    console.log(chalk_1.default.cyan("\u{2502}") +
        `  Take-Profit: ${chalk_1.default.green("+" + signal.takeProfit + "%")}`.padEnd(53) +
        chalk_1.default.cyan("\u{2502}"));
    // Trend info
    console.log(chalk_1.default.cyan("\u{251C}" + "\u{2500}".repeat(45) + "\u{2524}"));
    console.log(chalk_1.default.cyan("\u{2502}") +
        `  Trend:       ${trendIcon} ${chalk_1.default.white(signal.indicators.trend)}`.padEnd(53) +
        chalk_1.default.cyan("\u{2502}"));
    // EMA Values
    console.log(chalk_1.default.cyan("\u{251C}" + "\u{2500}".repeat(45) + "\u{2524}"));
    console.log(chalk_1.default.cyan("\u{2502}") + chalk_1.default.gray("  EMA Indicators:").padEnd(53) + chalk_1.default.cyan("\u{2502}"));
    console.log(chalk_1.default.cyan("\u{2502}") +
        chalk_1.default.gray(`    EMA9:   $${signal.indicators.currentEMA9.toFixed(2)}`).padEnd(44) +
        chalk_1.default.cyan("\u{2502}"));
    console.log(chalk_1.default.cyan("\u{2502}") +
        chalk_1.default.gray(`    EMA21:  $${signal.indicators.currentEMA21.toFixed(2)}`).padEnd(44) +
        chalk_1.default.cyan("\u{2502}"));
    console.log(chalk_1.default.cyan("\u{2502}") +
        chalk_1.default.gray(`    EMA50:  $${signal.indicators.currentEMA50.toFixed(2)}`).padEnd(44) +
        chalk_1.default.cyan("\u{2502}"));
    if (signal.indicators.currentEMA200 > 0) {
        console.log(chalk_1.default.cyan("\u{2502}") +
            chalk_1.default.gray(`    EMA200: $${signal.indicators.currentEMA200.toFixed(2)}`).padEnd(44) +
            chalk_1.default.cyan("\u{2502}"));
    }
    // Technical observations
    console.log(chalk_1.default.cyan("\u{251C}" + "\u{2500}".repeat(45) + "\u{2524}"));
    console.log(chalk_1.default.cyan("\u{2502}") + chalk_1.default.gray("  Technical Analysis:").padEnd(53) + chalk_1.default.cyan("\u{2502}"));
    for (const reason of signal.reasoning.slice(0, 4)) {
        const truncated = reason.length > 40 ? reason.substring(0, 37) + "..." : reason;
        console.log(chalk_1.default.cyan("\u{2502}") +
            chalk_1.default.gray(`    \u{2022} ${truncated}`).padEnd(44) +
            chalk_1.default.cyan("\u{2502}"));
    }
    // AI Reasoning
    if (aiReasoning) {
        console.log(chalk_1.default.cyan("\u{251C}" + "\u{2500}".repeat(45) + "\u{2524}"));
        console.log(chalk_1.default.cyan("\u{2502}") +
            chalk_1.default.magenta.bold("  \u{1F916} AI Insight:").padEnd(53) +
            chalk_1.default.cyan("\u{2502}"));
        // Word wrap AI reasoning
        const words = aiReasoning.split(" ");
        let line = "    ";
        for (const word of words) {
            if (line.length + word.length > 40) {
                console.log(chalk_1.default.cyan("\u{2502}") + chalk_1.default.white(line.padEnd(44)) + chalk_1.default.cyan("\u{2502}"));
                line = "    " + word + " ";
            }
            else {
                line += word + " ";
            }
        }
        if (line.trim()) {
            console.log(chalk_1.default.cyan("\u{2502}") + chalk_1.default.white(line.padEnd(44)) + chalk_1.default.cyan("\u{2502}"));
        }
    }
    // Footer
    console.log(chalk_1.default.cyan("\u{2514}" + "\u{2500}".repeat(45) + "\u{2518}"));
    // Disclaimer
    console.log("");
    console.log(chalk_1.default.gray.italic("  \u{26A0}\u{FE0F}  This is not financial advice. Always do your own research."));
    console.log("");
}
/**
 * Quick signal check (no AI)
 */
async function quickSignal(symbol) {
    const result = await generateTradingSignal(symbol, "1h", false);
    displaySignal(result);
}
/**
 * Full signal with AI reasoning
 */
async function fullSignal(symbol, interval = "1h") {
    const result = await generateTradingSignal(symbol, interval, true);
    displaySignal(result);
}
// ============================================
// COMPREHENSIVE ANALYSIS
// ============================================
/**
 * Generate AI analysis for comprehensive market data
 */
async function generateComprehensiveAIAnalysis(analysis) {
    const apiKey = (0, config_1.getApiKey)();
    if (!apiKey) {
        return "AI analysis unavailable (no API key configured)";
    }
    const modelConfig = (0, config_1.getModelConfig)();
    const provider = new groq_provider_1.GroqProvider(modelConfig.modelId, 0.7);
    provider.initialize(apiKey, modelConfig.modelId);
    const prompt = `You are an expert crypto trading analyst. Provide a detailed but concise analysis (4-6 sentences) based on the following comprehensive market data.

Symbol: ${analysis.symbol}
Current Price: $${analysis.currentPrice.toLocaleString()}
24h Change: ${analysis.priceChange24h.toFixed(2)}%

RECOMMENDATION: ${analysis.recommendation}
Confidence: ${analysis.confidence}%
Risk Level: ${analysis.riskLevel}

MULTI-TIMEFRAME ANALYSIS:
- 1H Trend: ${analysis.timeframes.short.signal} (${analysis.timeframes.short.trend.direction})
- 4H Trend: ${analysis.timeframes.medium.signal} (${analysis.timeframes.medium.trend.direction})
- 1D Trend: ${analysis.timeframes.long.signal} (${analysis.timeframes.long.trend.direction})
- Timeframe Alignment: ${analysis.timeframeAlignment}

INDICATORS:
- RSI(14): ${analysis.indicators.rsi.current.toFixed(1)} (${analysis.indicators.rsi.condition})
- MACD: ${analysis.indicators.macd.crossover} crossover, momentum ${analysis.indicators.macd.momentum}
- Bollinger: Price ${analysis.indicators.bollinger.pricePosition}, ${analysis.indicators.bollinger.squeeze ? "SQUEEZE detected" : "normal bandwidth"}
- Volume: ${analysis.indicators.volume.volumeRatio.toFixed(1)}x average, ${analysis.indicators.volume.trend} trend
- ATR Volatility: ${analysis.indicators.atr.volatility} (${analysis.indicators.atr.percentOfPrice.toFixed(1)}% of price)

KEY LEVELS:
- Support: $${analysis.indicators.supportResistance.nearestSupport.toFixed(2)} (${analysis.indicators.supportResistance.distanceToSupport.toFixed(1)}% away)
- Resistance: $${analysis.indicators.supportResistance.nearestResistance.toFixed(2)} (${analysis.indicators.supportResistance.distanceToResistance.toFixed(1)}% away)

TIMING:
- Action: ${analysis.timing.action}
- Entry Zone: $${analysis.timing.entryZone.low.toFixed(2)} - $${analysis.timing.entryZone.high.toFixed(2)}

TRADE SETUP:
- Entry: $${analysis.tradeSetup.entry.toFixed(2)}
- Stop Loss: $${analysis.tradeSetup.stopLoss.toFixed(2)}
- Target 1: $${analysis.tradeSetup.target1.toFixed(2)}
- Target 2: $${analysis.tradeSetup.target2.toFixed(2)}
- Risk/Reward: ${analysis.tradeSetup.riskRewardRatio}:1

MARKET CONDITION: ${analysis.marketCondition.type}
${analysis.marketCondition.description}

Bullish Factors:
${analysis.reasoning.bullishFactors.slice(0, 3).map((f) => `- ${f}`).join("\n")}

Bearish Factors:
${analysis.reasoning.bearishFactors.slice(0, 3).map((f) => `- ${f}`).join("\n")}

Warnings:
${analysis.reasoning.warnings.map((w) => `- ${w}`).join("\n")}

Provide a detailed trading analysis (4-6 sentences) that:
1. Explains the current market structure and why the recommendation makes sense
2. Specifies WHEN to enter (now, wait for pullback, wait for breakout, etc.)
3. Mentions specific price levels to watch
4. Highlights any risks or cautions
Be specific with prices and actionable advice.`;
    try {
        const stream = provider.streamChat([{ role: "user", content: prompt }], []);
        let response = "";
        for await (const chunk of stream) {
            if (chunk.content && typeof chunk.content === "string") {
                response += chunk.content;
            }
        }
        return response.trim();
    }
    catch (error) {
        return `AI analysis unavailable: ${error.message}`;
    }
}
/**
 * Format price for display
 */
function formatPrice(price) {
    if (price < 0.01)
        return `$${price.toFixed(6)}`;
    if (price < 1)
        return `$${price.toFixed(4)}`;
    if (price < 100)
        return `$${price.toFixed(2)}`;
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
/**
 * Word wrap text for terminal display
 */
function wordWrap(text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";
    for (const word of words) {
        if (currentLine.length + word.length + 1 > maxWidth) {
            lines.push(currentLine.trim());
            currentLine = word + " ";
        }
        else {
            currentLine += word + " ";
        }
    }
    if (currentLine.trim()) {
        lines.push(currentLine.trim());
    }
    return lines;
}
/**
 * Display comprehensive analysis in terminal
 */
function displayComprehensiveAnalysis(analysis, aiAnalysis) {
    const boxWidth = 55;
    const contentWidth = boxWidth - 4;
    const border = {
        top: chalk_1.default.cyan("\u{250C}" + "\u{2500}".repeat(boxWidth) + "\u{2510}"),
        mid: chalk_1.default.cyan("\u{251C}" + "\u{2500}".repeat(boxWidth) + "\u{2524}"),
        bot: chalk_1.default.cyan("\u{2514}" + "\u{2500}".repeat(boxWidth) + "\u{2518}"),
        left: chalk_1.default.cyan("\u{2502}"),
        right: chalk_1.default.cyan("\u{2502}"),
    };
    const line = (content, padEnd = contentWidth) => {
        console.log(border.left + "  " + content.padEnd(padEnd) + "  " + border.right);
    };
    // Recommendation colors and icons
    const recColors = {
        STRONG_BUY: chalk_1.default.green.bold,
        BUY: chalk_1.default.green,
        WAIT_TO_BUY: chalk_1.default.greenBright,
        HOLD: chalk_1.default.yellow,
        WAIT_TO_SELL: chalk_1.default.redBright,
        SELL: chalk_1.default.red,
        STRONG_SELL: chalk_1.default.red.bold,
    };
    const recIcons = {
        STRONG_BUY: "\u{1F7E2}\u{1F7E2}",
        BUY: "\u{1F7E2}",
        WAIT_TO_BUY: "\u{1F7E1}\u{2197}",
        HOLD: "\u{1F7E1}",
        WAIT_TO_SELL: "\u{1F7E1}\u{2198}",
        SELL: "\u{1F534}",
        STRONG_SELL: "\u{1F534}\u{1F534}",
    };
    const changeColor = analysis.priceChange24h >= 0 ? chalk_1.default.green : chalk_1.default.red;
    const changeSign = analysis.priceChange24h >= 0 ? "+" : "";
    console.log("");
    // Header
    console.log(border.top);
    line(chalk_1.default.bold.white(`\u{1F4CA} ${analysis.symbol} - Comprehensive Analysis`));
    line(chalk_1.default.bold.yellow(`Current Price: ${formatPrice(analysis.currentPrice)}`) +
        `  ${changeColor(changeSign + analysis.priceChange24h.toFixed(2) + "%")}`);
    console.log(border.mid);
    // Main Recommendation
    const recColor = recColors[analysis.recommendation] || chalk_1.default.white;
    const recIcon = recIcons[analysis.recommendation] || "";
    line(chalk_1.default.bold(`\u{1F3AF} RECOMMENDATION: ${recIcon} ${recColor(analysis.recommendation)}`));
    line(`   Confidence: ${chalk_1.default.white(analysis.confidence + "%")}  |  Risk: ${analysis.riskLevel === "low" ? chalk_1.default.green(analysis.riskLevel) :
        analysis.riskLevel === "medium" ? chalk_1.default.yellow(analysis.riskLevel) :
            chalk_1.default.red(analysis.riskLevel)}`);
    // Timing
    console.log(border.mid);
    line(chalk_1.default.bold("\u{23F0} TIMING"));
    const timingAction = analysis.timing.action.replace(/_/g, " ").toUpperCase();
    line(`   ${chalk_1.default.cyan(timingAction)}`);
    line(`   Entry Zone: ${chalk_1.default.white(formatPrice(analysis.timing.entryZone.low))} - ${chalk_1.default.white(formatPrice(analysis.timing.entryZone.high))}`);
    const timingLines = wordWrap(analysis.timing.reason, contentWidth - 3);
    timingLines.forEach((l) => line(chalk_1.default.gray(`   ${l}`)));
    // Trade Setup
    console.log(border.mid);
    line(chalk_1.default.bold("\u{1F4B0} TRADE SETUP"));
    line(`   Entry:      ${chalk_1.default.white(formatPrice(analysis.tradeSetup.entry))}`);
    line(`   Stop Loss:  ${chalk_1.default.red(formatPrice(analysis.tradeSetup.stopLoss))} (${chalk_1.default.red("-" + (((analysis.tradeSetup.entry - analysis.tradeSetup.stopLoss) / analysis.tradeSetup.entry) * 100).toFixed(1) + "%")})`);
    line(`   Target 1:   ${chalk_1.default.green(formatPrice(analysis.tradeSetup.target1))} (${chalk_1.default.green("+" + (((analysis.tradeSetup.target1 - analysis.tradeSetup.entry) / analysis.tradeSetup.entry) * 100).toFixed(1) + "%")})`);
    line(`   Target 2:   ${chalk_1.default.green(formatPrice(analysis.tradeSetup.target2))} (${chalk_1.default.green("+" + (((analysis.tradeSetup.target2 - analysis.tradeSetup.entry) / analysis.tradeSetup.entry) * 100).toFixed(1) + "%")})`);
    line(`   R/R Ratio:  ${chalk_1.default.cyan(analysis.tradeSetup.riskRewardRatio + ":1")}`);
    // Multi-Timeframe
    console.log(border.mid);
    line(chalk_1.default.bold("\u{1F4C8} MULTI-TIMEFRAME ANALYSIS"));
    const tfIcon = (signal) => signal === "bullish" ? chalk_1.default.green("\u{2191}") : signal === "bearish" ? chalk_1.default.red("\u{2193}") : chalk_1.default.yellow("\u{2192}");
    line(`   1H:  ${tfIcon(analysis.timeframes.short.signal)} ${analysis.timeframes.short.signal.padEnd(8)} | RSI: ${analysis.timeframes.short.rsi.current.toFixed(0)}`);
    line(`   4H:  ${tfIcon(analysis.timeframes.medium.signal)} ${analysis.timeframes.medium.signal.padEnd(8)} | RSI: ${analysis.timeframes.medium.rsi.current.toFixed(0)}`);
    line(`   1D:  ${tfIcon(analysis.timeframes.long.signal)} ${analysis.timeframes.long.signal.padEnd(8)} | RSI: ${analysis.timeframes.long.rsi.current.toFixed(0)}`);
    const alignmentColor = analysis.timeframeAlignment === "aligned_bullish" ? chalk_1.default.green :
        analysis.timeframeAlignment === "aligned_bearish" ? chalk_1.default.red : chalk_1.default.yellow;
    line(`   Alignment: ${alignmentColor(analysis.timeframeAlignment.replace(/_/g, " "))}`);
    // Indicators
    console.log(border.mid);
    line(chalk_1.default.bold("\u{1F4CA} INDICATORS"));
    // RSI
    const rsiColor = analysis.indicators.rsi.condition === "overbought" ? chalk_1.default.red :
        analysis.indicators.rsi.condition === "oversold" ? chalk_1.default.green : chalk_1.default.white;
    line(`   RSI(14):    ${rsiColor(analysis.indicators.rsi.current.toFixed(1))} (${analysis.indicators.rsi.condition})${analysis.indicators.rsi.divergence !== "none" ? chalk_1.default.magenta(` - ${analysis.indicators.rsi.divergence} div`) : ""}`);
    // MACD
    const macdColor = analysis.indicators.macd.crossover === "bullish" ? chalk_1.default.green :
        analysis.indicators.macd.crossover === "bearish" ? chalk_1.default.red : chalk_1.default.gray;
    line(`   MACD:       ${macdColor(analysis.indicators.macd.crossover)} | momentum ${analysis.indicators.macd.momentum}`);
    // Bollinger
    const bbPosition = analysis.indicators.bollinger.pricePosition.replace(/_/g, " ");
    line(`   Bollinger:  ${bbPosition}${analysis.indicators.bollinger.squeeze ? chalk_1.default.yellow(" [SQUEEZE]") : ""}`);
    // Volume
    const volColor = analysis.indicators.volume.volumeRatio > 1.2 ? chalk_1.default.green :
        analysis.indicators.volume.volumeRatio < 0.8 ? chalk_1.default.red : chalk_1.default.white;
    line(`   Volume:     ${volColor(analysis.indicators.volume.volumeRatio.toFixed(1) + "x")} avg | ${analysis.indicators.volume.trend}`);
    // ATR
    const atrColor = analysis.indicators.atr.volatility === "high" ? chalk_1.default.red :
        analysis.indicators.atr.volatility === "low" ? chalk_1.default.green : chalk_1.default.yellow;
    line(`   Volatility: ${atrColor(analysis.indicators.atr.volatility)} (ATR: ${analysis.indicators.atr.percentOfPrice.toFixed(1)}%)`);
    // Key Levels
    console.log(border.mid);
    line(chalk_1.default.bold("\u{1F511} KEY LEVELS"));
    line(`   Support:    ${chalk_1.default.green(formatPrice(analysis.indicators.supportResistance.nearestSupport))} (${analysis.indicators.supportResistance.distanceToSupport.toFixed(1)}% away)`);
    line(`   Resistance: ${chalk_1.default.red(formatPrice(analysis.indicators.supportResistance.nearestResistance))} (${analysis.indicators.supportResistance.distanceToResistance.toFixed(1)}% away)`);
    line(`   EMA21:      ${chalk_1.default.gray(formatPrice(analysis.timeframes.medium.ema.ema21))}`);
    line(`   EMA50:      ${chalk_1.default.gray(formatPrice(analysis.timeframes.medium.ema.ema50))}`);
    line(`   EMA200:     ${chalk_1.default.gray(formatPrice(analysis.timeframes.medium.ema.ema200))}`);
    // Market Condition
    console.log(border.mid);
    line(chalk_1.default.bold(`\u{1F30A} MARKET: ${analysis.marketCondition.type.toUpperCase()}`));
    const conditionLines = wordWrap(analysis.marketCondition.tradingAdvice, contentWidth - 3);
    conditionLines.forEach((l) => line(chalk_1.default.gray(`   ${l}`)));
    // Bullish/Bearish Factors
    if (analysis.reasoning.bullishFactors.length > 0 || analysis.reasoning.bearishFactors.length > 0) {
        console.log(border.mid);
        if (analysis.reasoning.bullishFactors.length > 0) {
            line(chalk_1.default.green.bold("\u{2705} BULLISH FACTORS"));
            analysis.reasoning.bullishFactors.slice(0, 3).forEach((f) => {
                const lines = wordWrap(f, contentWidth - 5);
                lines.forEach((l, i) => line(chalk_1.default.green(`   ${i === 0 ? "\u{2022}" : " "} ${l}`)));
            });
        }
        if (analysis.reasoning.bearishFactors.length > 0) {
            line(chalk_1.default.red.bold("\u{274C} BEARISH FACTORS"));
            analysis.reasoning.bearishFactors.slice(0, 3).forEach((f) => {
                const lines = wordWrap(f, contentWidth - 5);
                lines.forEach((l, i) => line(chalk_1.default.red(`   ${i === 0 ? "\u{2022}" : " "} ${l}`)));
            });
        }
    }
    // Warnings
    if (analysis.reasoning.warnings.length > 0) {
        console.log(border.mid);
        line(chalk_1.default.yellow.bold("\u{26A0}\u{FE0F} WARNINGS"));
        analysis.reasoning.warnings.forEach((w) => {
            const lines = wordWrap(w, contentWidth - 5);
            lines.forEach((l, i) => line(chalk_1.default.yellow(`   ${i === 0 ? "\u{2022}" : " "} ${l}`)));
        });
    }
    // AI Analysis
    if (aiAnalysis) {
        console.log(border.mid);
        line(chalk_1.default.magenta.bold("\u{1F916} AI ANALYSIS"));
        const aiLines = wordWrap(aiAnalysis, contentWidth - 3);
        aiLines.forEach((l) => line(chalk_1.default.white(`   ${l}`)));
    }
    // Footer
    console.log(border.bot);
    console.log("");
    console.log(chalk_1.default.gray.italic("  \u{26A0}\u{FE0F}  This is not financial advice. Always do your own research."));
    console.log("");
}
/**
 * Perform and display comprehensive market analysis
 */
async function comprehensiveAnalysis(symbol) {
    const spinner = (0, ora_1.default)(`Analyzing ${symbol.toUpperCase()} across multiple timeframes...`).start();
    try {
        spinner.text = "Fetching 1H, 4H, and 1D data...";
        const analysis = await (0, market_analyzer_1.analyzeMarket)(symbol);
        spinner.text = "Generating AI insights...";
        const aiAnalysis = await generateComprehensiveAIAnalysis(analysis);
        spinner.succeed(`Comprehensive analysis complete for ${analysis.symbol}`);
        displayComprehensiveAnalysis(analysis, aiAnalysis);
    }
    catch (error) {
        spinner.fail(`Failed to analyze ${symbol}`);
        console.log(chalk_1.default.red(`\nError: ${error.message}`));
    }
}
