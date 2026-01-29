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
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const data_fetcher_1 = require("./data-fetcher");
const analyzer_1 = require("./analyzer");
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
