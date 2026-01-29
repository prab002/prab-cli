/**
 * Trading Signal Generator with AI Reasoning
 * Combines technical analysis with AI-powered insights
 */

import chalk from "chalk";
import ora from "ora";
import { fetchCryptoData, normalizeSymbol, TimeInterval } from "./data-fetcher";
import { generateSignal, TradingSignal } from "./analyzer";
import { getApiKey, getModelConfig } from "../config";
import { GroqProvider } from "../models/groq-provider";

export interface SignalResult {
  success: boolean;
  symbol: string;
  signal?: TradingSignal;
  aiReasoning?: string;
  error?: string;
  price?: number;
  priceChange24h?: number;
}

/**
 * Generate AI reasoning for the trading signal
 */
async function generateAIReasoning(
  symbol: string,
  signal: TradingSignal,
  price: number,
  priceChange24h: number
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return "AI reasoning unavailable (no API key configured)";
  }

  const modelConfig = getModelConfig();
  const provider = new GroqProvider(modelConfig.modelId, 0.7);
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
    const stream = provider.streamChat(
      [{ role: "user", content: prompt }] as any,
      [] // No tools needed
    );

    let response = "";
    for await (const chunk of stream) {
      if (chunk.content && typeof chunk.content === "string") {
        response += chunk.content;
      }
    }

    return response.trim();
  } catch (error: any) {
    return `AI reasoning unavailable: ${error.message}`;
  }
}

/**
 * Main function to generate trading signal with AI reasoning
 */
export async function generateTradingSignal(
  symbol: string,
  interval: TimeInterval = "1h",
  includeAI: boolean = true
): Promise<SignalResult> {
  const spinner = ora(`Fetching ${symbol.toUpperCase()} data...`).start();

  try {
    // Fetch crypto data
    const data = await fetchCryptoData(symbol, interval, 250); // Get 250 candles for EMA200
    spinner.text = "Analyzing chart data...";

    // Generate technical signal
    const signal = generateSignal(data);
    spinner.text = "Generating trading signal...";

    let aiReasoning: string | undefined;

    // Generate AI reasoning if requested
    if (includeAI) {
      spinner.text = "Getting AI insights...";
      aiReasoning = await generateAIReasoning(
        data.symbol,
        signal,
        data.currentPrice,
        data.priceChangePercent24h
      );
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
  } catch (error: any) {
    spinner.fail(`Failed to analyze ${symbol}`);
    return {
      success: false,
      symbol: normalizeSymbol(symbol),
      error: error.message,
    };
  }
}

/**
 * Display trading signal in terminal
 */
export function displaySignal(result: SignalResult): void {
  if (!result.success || !result.signal) {
    console.log(chalk.red(`\nError: ${result.error}`));
    return;
  }

  const { signal, symbol, price, priceChange24h, aiReasoning } = result;

  // Signal colors
  const signalColor =
    signal.signal === "BUY"
      ? chalk.green.bold
      : signal.signal === "SELL"
        ? chalk.red.bold
        : chalk.yellow.bold;

  const signalIcon =
    signal.signal === "BUY" ? "\u{1F7E2}" : signal.signal === "SELL" ? "\u{1F534}" : "\u{1F7E1}";

  const trendIcon =
    signal.indicators.trend === "bullish"
      ? chalk.green("\u{2191}")
      : signal.indicators.trend === "bearish"
        ? chalk.red("\u{2193}")
        : chalk.yellow("\u{2192}");

  const changeColor = priceChange24h! >= 0 ? chalk.green : chalk.red;
  const changeSign = priceChange24h! >= 0 ? "+" : "";

  // Format price for display
  const formattedPrice =
    price! < 1
      ? `$${price!.toFixed(4)}`
      : price! < 100
        ? `$${price!.toFixed(2)}`
        : `$${price!.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  // Header with current price
  console.log("");
  console.log(chalk.cyan("\u{250C}" + "\u{2500}".repeat(45) + "\u{2510}"));
  console.log(
    chalk.cyan("\u{2502}") +
      chalk.bold.white(`  \u{1F4CA} ${symbol}`.padEnd(44)) +
      chalk.cyan("\u{2502}")
  );
  console.log(
    chalk.cyan("\u{2502}") +
      chalk.bold.yellow(`  Current Price: ${formattedPrice}`).padEnd(44) +
      chalk.cyan("\u{2502}")
  );
  console.log(
    chalk.cyan("\u{2502}") +
      `  24h: ${changeColor(changeSign + priceChange24h!.toFixed(2) + "%")}`.padEnd(52) +
      chalk.cyan("\u{2502}")
  );
  console.log(chalk.cyan("\u{251C}" + "\u{2500}".repeat(45) + "\u{2524}"));

  // Signal
  console.log(
    chalk.cyan("\u{2502}") +
      `  Signal:      ${signalIcon} ${signalColor(signal.signal)}`.padEnd(53) +
      chalk.cyan("\u{2502}")
  );
  console.log(
    chalk.cyan("\u{2502}") +
      `  Confidence:  ${chalk.white(signal.confidence + "%")}`.padEnd(53) +
      chalk.cyan("\u{2502}")
  );
  console.log(
    chalk.cyan("\u{2502}") +
      `  Stop-Loss:   ${chalk.red("-" + signal.stopLoss + "%")}`.padEnd(53) +
      chalk.cyan("\u{2502}")
  );
  console.log(
    chalk.cyan("\u{2502}") +
      `  Take-Profit: ${chalk.green("+" + signal.takeProfit + "%")}`.padEnd(53) +
      chalk.cyan("\u{2502}")
  );

  // Trend info
  console.log(chalk.cyan("\u{251C}" + "\u{2500}".repeat(45) + "\u{2524}"));
  console.log(
    chalk.cyan("\u{2502}") +
      `  Trend:       ${trendIcon} ${chalk.white(signal.indicators.trend)}`.padEnd(53) +
      chalk.cyan("\u{2502}")
  );

  // EMA Values
  console.log(chalk.cyan("\u{251C}" + "\u{2500}".repeat(45) + "\u{2524}"));
  console.log(
    chalk.cyan("\u{2502}") + chalk.gray("  EMA Indicators:").padEnd(53) + chalk.cyan("\u{2502}")
  );
  console.log(
    chalk.cyan("\u{2502}") +
      chalk.gray(`    EMA9:   $${signal.indicators.currentEMA9.toFixed(2)}`).padEnd(44) +
      chalk.cyan("\u{2502}")
  );
  console.log(
    chalk.cyan("\u{2502}") +
      chalk.gray(`    EMA21:  $${signal.indicators.currentEMA21.toFixed(2)}`).padEnd(44) +
      chalk.cyan("\u{2502}")
  );
  console.log(
    chalk.cyan("\u{2502}") +
      chalk.gray(`    EMA50:  $${signal.indicators.currentEMA50.toFixed(2)}`).padEnd(44) +
      chalk.cyan("\u{2502}")
  );
  if (signal.indicators.currentEMA200 > 0) {
    console.log(
      chalk.cyan("\u{2502}") +
        chalk.gray(`    EMA200: $${signal.indicators.currentEMA200.toFixed(2)}`).padEnd(44) +
        chalk.cyan("\u{2502}")
    );
  }

  // Technical observations
  console.log(chalk.cyan("\u{251C}" + "\u{2500}".repeat(45) + "\u{2524}"));
  console.log(
    chalk.cyan("\u{2502}") + chalk.gray("  Technical Analysis:").padEnd(53) + chalk.cyan("\u{2502}")
  );
  for (const reason of signal.reasoning.slice(0, 4)) {
    const truncated = reason.length > 40 ? reason.substring(0, 37) + "..." : reason;
    console.log(
      chalk.cyan("\u{2502}") +
        chalk.gray(`    \u{2022} ${truncated}`).padEnd(44) +
        chalk.cyan("\u{2502}")
    );
  }

  // AI Reasoning
  if (aiReasoning) {
    console.log(chalk.cyan("\u{251C}" + "\u{2500}".repeat(45) + "\u{2524}"));
    console.log(
      chalk.cyan("\u{2502}") +
        chalk.magenta.bold("  \u{1F916} AI Insight:").padEnd(53) +
        chalk.cyan("\u{2502}")
    );

    // Word wrap AI reasoning
    const words = aiReasoning.split(" ");
    let line = "    ";
    for (const word of words) {
      if (line.length + word.length > 40) {
        console.log(chalk.cyan("\u{2502}") + chalk.white(line.padEnd(44)) + chalk.cyan("\u{2502}"));
        line = "    " + word + " ";
      } else {
        line += word + " ";
      }
    }
    if (line.trim()) {
      console.log(chalk.cyan("\u{2502}") + chalk.white(line.padEnd(44)) + chalk.cyan("\u{2502}"));
    }
  }

  // Footer
  console.log(chalk.cyan("\u{2514}" + "\u{2500}".repeat(45) + "\u{2518}"));

  // Disclaimer
  console.log("");
  console.log(
    chalk.gray.italic(
      "  \u{26A0}\u{FE0F}  This is not financial advice. Always do your own research."
    )
  );
  console.log("");
}

/**
 * Quick signal check (no AI)
 */
export async function quickSignal(symbol: string): Promise<void> {
  const result = await generateTradingSignal(symbol, "1h", false);
  displaySignal(result);
}

/**
 * Full signal with AI reasoning
 */
export async function fullSignal(symbol: string, interval: TimeInterval = "1h"): Promise<void> {
  const result = await generateTradingSignal(symbol, interval, true);
  displaySignal(result);
}
