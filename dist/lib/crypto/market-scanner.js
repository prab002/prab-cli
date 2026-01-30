"use strict";
/**
 * Market Scanner - Find Best Trading Opportunities
 * Scans top cryptocurrencies and scores them based on multiple criteria
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayScanResults = displayScanResults;
exports.runMarketScanner = runMarketScanner;
/* global fetch */
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const data_fetcher_1 = require("./data-fetcher");
const indicators_1 = require("./indicators");
// ============================================
// TOP CRYPTOCURRENCIES
// ============================================
// Top 100 by market cap (symbols for Binance)
const TOP_CRYPTOS = [
    "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "AVAX", "DOGE", "DOT", "LINK",
    "MATIC", "SHIB", "LTC", "ATOM", "UNI", "XLM", "ETC", "FIL", "NEAR", "APT",
    "ARB", "OP", "INJ", "IMX", "VET", "ALGO", "FTM", "SAND", "MANA", "AXS",
    "GALA", "THETA", "EGLD", "EOS", "AAVE", "MKR", "GRT", "SNX", "CRV", "LDO",
    "RUNE", "KAVA", "ZEC", "DASH", "NEO", "XTZ", "IOTA", "WAVES", "CHZ", "ENJ",
    "BAT", "1INCH", "COMP", "YFI", "SUSHI", "ZRX", "ANKR", "STORJ", "SKL", "CELO",
    "ICX", "ONT", "QTUM", "ZIL", "IOST", "SXP", "RSR", "REN", "BAND", "ALPHA",
    "DENT", "CELR", "OGN", "NKN", "ARPA", "CTSI", "SLP", "TLM", "REEF", "DODO",
    "LINA", "PERP", "SUPER", "TVK", "BADGER", "AUCTION", "MASK", "HIGH", "FRONT", "AKRO",
    "UNFI", "WING", "CREAM", "SFP", "TKO", "BURGER", "HARD", "AUTO", "EPS", "BEL"
];
// ============================================
// WICK ANALYSIS
// ============================================
/**
 * Calculate wick ratio for candles
 * Lower ratio = cleaner candles = more reliable price action
 */
function calculateWickRatio(candles) {
    let totalRatio = 0;
    let cleanCount = 0;
    for (const candle of candles) {
        const body = Math.abs(candle.close - candle.open);
        const totalRange = candle.high - candle.low;
        if (totalRange === 0)
            continue;
        const wickRatio = 1 - (body / totalRange); // 0 = all body, 1 = all wick
        totalRatio += wickRatio;
        // Clean candle = wick is less than 30% of total range
        if (wickRatio < 0.3)
            cleanCount++;
    }
    return {
        avgRatio: totalRatio / candles.length,
        cleanCandles: cleanCount,
    };
}
/**
 * Calculate upper and lower wick sizes
 */
function analyzeWicks(candles) {
    let totalUpperWick = 0;
    let totalLowerWick = 0;
    for (const candle of candles) {
        const body = Math.abs(candle.close - candle.open);
        const totalRange = candle.high - candle.low;
        if (totalRange === 0)
            continue;
        const isGreen = candle.close >= candle.open;
        const bodyTop = isGreen ? candle.close : candle.open;
        const bodyBottom = isGreen ? candle.open : candle.close;
        const upperWick = candle.high - bodyTop;
        const lowerWick = bodyBottom - candle.low;
        totalUpperWick += upperWick / totalRange;
        totalLowerWick += lowerWick / totalRange;
    }
    const avgUpperWick = totalUpperWick / candles.length;
    const avgLowerWick = totalLowerWick / candles.length;
    // Positive = more upper wicks (bearish rejection), Negative = more lower wicks (bullish rejection)
    const wickImbalance = avgUpperWick - avgLowerWick;
    return { avgUpperWick, avgLowerWick, wickImbalance };
}
// ============================================
// SCORING FUNCTIONS
// ============================================
/**
 * Calculate risk/reward score
 */
function calculateRiskRewardScore(price, support, resistance) {
    const distToSupport = ((price - support) / price) * 100;
    const distToResist = ((resistance - price) / price) * 100;
    // Risk = distance to support (stop loss area)
    // Reward = distance to resistance (take profit area)
    const ratio = distToResist / Math.max(distToSupport, 0.1);
    // Score: higher ratio = better
    let score = 0;
    if (ratio >= 3)
        score = 100;
    else if (ratio >= 2.5)
        score = 90;
    else if (ratio >= 2)
        score = 80;
    else if (ratio >= 1.5)
        score = 70;
    else if (ratio >= 1)
        score = 50;
    else
        score = 30;
    return { score, ratio, distToSupport, distToResist };
}
/**
 * Calculate signal strength score based on indicator confluence
 */
function calculateSignalStrengthScore(rsi, macdCrossover, trend, priceVsEMA) {
    let score = 50; // Base score
    // RSI contribution
    if (rsi < 30)
        score += 20; // Oversold = bullish
    else if (rsi < 40)
        score += 10;
    else if (rsi > 70)
        score -= 20; // Overbought = bearish
    else if (rsi > 60)
        score -= 10;
    // MACD contribution
    if (macdCrossover === "bullish")
        score += 15;
    else if (macdCrossover === "bearish")
        score -= 15;
    // Trend contribution
    if (trend === "bullish")
        score += 15;
    else if (trend === "bearish")
        score -= 15;
    // Price vs EMA contribution
    if (priceVsEMA === "above_all")
        score += 10;
    else if (priceVsEMA === "below_all")
        score -= 10;
    return Math.max(0, Math.min(100, score));
}
/**
 * Calculate momentum score
 */
function calculateMomentumScore(change24h, volumeRatio, trendStrength) {
    let score = 50;
    // Price change contribution (positive change = bullish momentum)
    if (change24h > 10)
        score += 25;
    else if (change24h > 5)
        score += 15;
    else if (change24h > 2)
        score += 10;
    else if (change24h < -10)
        score -= 25;
    else if (change24h < -5)
        score -= 15;
    else if (change24h < -2)
        score -= 10;
    // Volume contribution
    if (volumeRatio > 2)
        score += 20;
    else if (volumeRatio > 1.5)
        score += 10;
    else if (volumeRatio < 0.5)
        score -= 15;
    // Trend strength
    score += (trendStrength - 50) * 0.3;
    return Math.max(0, Math.min(100, score));
}
/**
 * Calculate wick score (higher = cleaner candles)
 */
function calculateWickScore(avgWickRatio) {
    // avgWickRatio: 0 = perfect (no wicks), 1 = all wicks
    // We want to reward LOW wick ratios
    const score = (1 - avgWickRatio) * 100;
    return Math.max(0, Math.min(100, score));
}
// ============================================
// ANALYSIS FUNCTIONS
// ============================================
/**
 * Analyze a single cryptocurrency
 */
async function analyzeCrypto(symbol) {
    try {
        const data = await (0, data_fetcher_1.fetchCryptoData)(symbol, "4h", 100);
        if (!data || data.candles.length < 50)
            return null;
        const closes = data.candles.map((c) => c.close);
        const volumes = data.candles.map((c) => c.volume);
        // Calculate indicators
        const rsiResult = (0, indicators_1.calculateRSI)(closes, 14);
        const currentRSI = rsiResult.current;
        const macd = (0, indicators_1.calculateMACD)(closes);
        const macdCrossover = macd.crossover;
        const trend = (0, indicators_1.analyzeTrend)(data.candles);
        const supportResistance = (0, indicators_1.calculateSupportResistance)(data.candles);
        // Volume analysis
        const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const volumeRatio = avgVolume > 0 ? recentVolume / avgVolume : 1;
        // Wick analysis
        const recentCandles = data.candles.slice(-20);
        const wickData = calculateWickRatio(recentCandles);
        const wickAnalysis = analyzeWicks(recentCandles);
        // Calculate scores
        const rrData = calculateRiskRewardScore(data.currentPrice, supportResistance.nearestSupport, supportResistance.nearestResistance);
        // Determine price position relative to trend
        const pricePosition = trend.direction === "bullish" ? "above_all" :
            trend.direction === "bearish" ? "below_all" : "neutral";
        const signalStrengthScore = calculateSignalStrengthScore(currentRSI, macdCrossover, trend.direction, pricePosition);
        const momentumScore = calculateMomentumScore(data.priceChangePercent24h, volumeRatio, trend.strength);
        const wickScore = calculateWickScore(wickData.avgRatio);
        // Calculate overall score (weighted average)
        const overallScore = Math.round(rrData.score * 0.25 +
            signalStrengthScore * 0.30 +
            momentumScore * 0.25 +
            wickScore * 0.20);
        // Determine signal
        let signal = "HOLD";
        if (overallScore >= 80 && signalStrengthScore >= 70)
            signal = "STRONG_BUY";
        else if (overallScore >= 65 && signalStrengthScore >= 55)
            signal = "BUY";
        else if (overallScore <= 30 && signalStrengthScore <= 35)
            signal = "STRONG_SELL";
        else if (overallScore <= 45 && signalStrengthScore <= 45)
            signal = "SELL";
        // Generate reasoning
        const reasoning = [];
        if (currentRSI < 35)
            reasoning.push(`RSI oversold (${currentRSI.toFixed(0)})`);
        if (currentRSI > 65)
            reasoning.push(`RSI overbought (${currentRSI.toFixed(0)})`);
        if (macdCrossover === "bullish")
            reasoning.push("Bullish MACD crossover");
        if (macdCrossover === "bearish")
            reasoning.push("Bearish MACD crossover");
        if (rrData.ratio >= 2)
            reasoning.push(`Good R:R ratio (${rrData.ratio.toFixed(1)}:1)`);
        if (wickScore >= 70)
            reasoning.push("Clean price action (low wicks)");
        if (wickScore < 40)
            reasoning.push("Choppy price action (high wicks)");
        if (volumeRatio > 1.5)
            reasoning.push(`High volume (${volumeRatio.toFixed(1)}x avg)`);
        return {
            symbol: data.symbol,
            price: data.currentPrice,
            change24h: data.priceChangePercent24h,
            overallScore,
            riskRewardScore: rrData.score,
            signalStrengthScore,
            momentumScore,
            wickScore,
            rsi: currentRSI,
            trend: trend.direction,
            macdSignal: macdCrossover,
            volumeRatio,
            distanceToSupport: rrData.distToSupport,
            distanceToResistance: rrData.distToResist,
            riskRewardRatio: rrData.ratio,
            avgWickRatio: wickData.avgRatio,
            signal,
            confidence: overallScore,
            reasoning,
        };
    }
    catch (error) {
        return null;
    }
}
// ============================================
// DISPLAY FUNCTIONS
// ============================================
function formatPrice(price) {
    if (price < 0.001)
        return `$${price.toFixed(6)}`;
    if (price < 1)
        return `$${price.toFixed(4)}`;
    if (price < 100)
        return `$${price.toFixed(2)}`;
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function getScoreBar(score, width = 10) {
    const filled = Math.round((score / 100) * width);
    const empty = width - filled;
    let color = chalk_1.default.green;
    if (score < 40)
        color = chalk_1.default.red;
    else if (score < 60)
        color = chalk_1.default.yellow;
    return color("█".repeat(filled)) + chalk_1.default.gray("░".repeat(empty));
}
function getSignalColor(signal) {
    switch (signal) {
        case "STRONG_BUY":
            return chalk_1.default.green.bold;
        case "BUY":
            return chalk_1.default.green;
        case "SELL":
            return chalk_1.default.red;
        case "STRONG_SELL":
            return chalk_1.default.red.bold;
        default:
            return chalk_1.default.yellow;
    }
}
function displayScanResults(result) {
    console.log("");
    console.log(chalk_1.default.bold.cyan("  ═══════════════════════════════════════════════════════════════════"));
    console.log(chalk_1.default.bold.cyan("              🔍 MARKET SCANNER - TRADING OPPORTUNITIES              "));
    console.log(chalk_1.default.bold.cyan("  ═══════════════════════════════════════════════════════════════════"));
    console.log("");
    console.log(chalk_1.default.gray(`  Scanned ${result.totalScanned} cryptocurrencies | ${new Date(result.timestamp).toLocaleString()}`));
    console.log(chalk_1.default.gray(`  Found ${result.opportunities.length} valid results`));
    console.log("");
    // Show all opportunities sorted by score
    console.log(chalk_1.default.bold.yellow("  ┌─────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.bold.yellow("  │                    📊 ALL OPPORTUNITIES (Sorted)                │"));
    console.log(chalk_1.default.bold.yellow("  └─────────────────────────────────────────────────────────────────┘"));
    console.log("");
    console.log(chalk_1.default.gray("  Symbol       Price          24h     Score  R:R    Wick   Signal"));
    console.log(chalk_1.default.gray("  " + "─".repeat(65)));
    // Show top 15 results
    for (const opp of result.opportunities.slice(0, 15)) {
        const changeColor = opp.change24h >= 0 ? chalk_1.default.green : chalk_1.default.red;
        const changeStr = `${opp.change24h >= 0 ? "+" : ""}${opp.change24h.toFixed(1)}%`;
        console.log(chalk_1.default.white(`  ${opp.symbol.padEnd(12)}`) +
            chalk_1.default.yellow(`${formatPrice(opp.price).padEnd(14)}`) +
            changeColor(`${changeStr.padEnd(8)}`) +
            `${getScoreBar(opp.overallScore, 6)} ` +
            chalk_1.default.cyan(`${opp.riskRewardRatio.toFixed(1)}:1`.padEnd(6)) +
            `${getScoreBar(opp.wickScore, 4)} ` +
            getSignalColor(opp.signal)(opp.signal));
        if (opp.reasoning.length > 0) {
            console.log(chalk_1.default.gray(`             ${opp.reasoning.slice(0, 2).join(" | ")}`));
        }
    }
    console.log("");
    // Top Buy Opportunities
    if (result.topBuys.length > 0) {
        console.log(chalk_1.default.bold.green("  ┌─────────────────────────────────────────────────────────────────┐"));
        console.log(chalk_1.default.bold.green("  │                    🟢 TOP BUY OPPORTUNITIES                     │"));
        console.log(chalk_1.default.bold.green("  └─────────────────────────────────────────────────────────────────┘"));
        console.log("");
        console.log(chalk_1.default.gray("  Symbol       Price          24h     Score  R:R    Wick   Signal"));
        console.log(chalk_1.default.gray("  " + "─".repeat(65)));
    }
    for (const opp of result.topBuys.slice(0, 10)) {
        const changeColor = opp.change24h >= 0 ? chalk_1.default.green : chalk_1.default.red;
        const changeStr = `${opp.change24h >= 0 ? "+" : ""}${opp.change24h.toFixed(1)}%`;
        console.log(chalk_1.default.white(`  ${opp.symbol.padEnd(12)}`) +
            chalk_1.default.yellow(`${formatPrice(opp.price).padEnd(14)}`) +
            changeColor(`${changeStr.padEnd(8)}`) +
            `${getScoreBar(opp.overallScore, 6)} ` +
            chalk_1.default.cyan(`${opp.riskRewardRatio.toFixed(1)}:1`.padEnd(6)) +
            `${getScoreBar(opp.wickScore, 4)} ` +
            getSignalColor(opp.signal)(opp.signal));
        if (opp.reasoning.length > 0) {
            console.log(chalk_1.default.gray(`             ${opp.reasoning.slice(0, 2).join(" | ")}`));
        }
    }
    console.log("");
    // Top Sell Opportunities
    if (result.topSells.length > 0) {
        console.log(chalk_1.default.bold.red("  ┌─────────────────────────────────────────────────────────────────┐"));
        console.log(chalk_1.default.bold.red("  │                    🔴 TOP SELL SIGNALS                          │"));
        console.log(chalk_1.default.bold.red("  └─────────────────────────────────────────────────────────────────┘"));
        console.log("");
        for (const opp of result.topSells.slice(0, 5)) {
            const changeColor = opp.change24h >= 0 ? chalk_1.default.green : chalk_1.default.red;
            const changeStr = `${opp.change24h >= 0 ? "+" : ""}${opp.change24h.toFixed(1)}%`;
            console.log(chalk_1.default.white(`  ${opp.symbol.padEnd(12)}`) +
                chalk_1.default.yellow(`${formatPrice(opp.price).padEnd(14)}`) +
                changeColor(`${changeStr.padEnd(8)}`) +
                `${getScoreBar(opp.overallScore, 6)} ` +
                getSignalColor(opp.signal)(opp.signal));
            if (opp.reasoning.length > 0) {
                console.log(chalk_1.default.gray(`             ${opp.reasoning.slice(0, 2).join(" | ")}`));
            }
        }
        console.log("");
    }
    // Cleanest Charts (Best for trading - low manipulation)
    console.log(chalk_1.default.bold.cyan("  ┌─────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.bold.cyan("  │              📊 CLEANEST CHARTS (Low Wick = Reliable)           │"));
    console.log(chalk_1.default.bold.cyan("  └─────────────────────────────────────────────────────────────────┘"));
    console.log("");
    console.log(chalk_1.default.gray("  Lower wick ratio = cleaner price action = more reliable trades"));
    console.log("");
    for (const opp of result.cleanestCharts.slice(0, 5)) {
        const wickPct = ((1 - opp.avgWickRatio) * 100).toFixed(0);
        console.log(chalk_1.default.white(`  ${opp.symbol.padEnd(12)}`) +
            chalk_1.default.cyan(`Wick Score: ${opp.wickScore.toFixed(0)}/100`.padEnd(20)) +
            chalk_1.default.green(`${wickPct}% body (clean)`.padEnd(18)) +
            getSignalColor(opp.signal)(opp.signal));
    }
    console.log("");
    // Legend
    console.log(chalk_1.default.gray("  ─".repeat(33)));
    console.log(chalk_1.default.gray("  Score: ") + chalk_1.default.green("███") + chalk_1.default.gray(" High (>60)  ") + chalk_1.default.yellow("███") + chalk_1.default.gray(" Medium (40-60)  ") + chalk_1.default.red("███") + chalk_1.default.gray(" Low (<40)"));
    console.log(chalk_1.default.gray("  R:R = Risk/Reward Ratio | Wick = Price Action Cleanliness"));
    console.log("");
    console.log(chalk_1.default.gray.italic("  ⚠️  This is not financial advice. Always do your own research."));
    console.log("");
}
// ============================================
// MAIN FUNCTION
// ============================================
async function runMarketScanner(limit = 50, minScore = 50) {
    const spinner = (0, ora_1.default)("Scanning market for opportunities...").start();
    const opportunities = [];
    const cryptosToScan = TOP_CRYPTOS.slice(0, limit);
    let scanned = 0;
    const batchSize = 5; // Scan in batches to avoid rate limiting
    for (let i = 0; i < cryptosToScan.length; i += batchSize) {
        const batch = cryptosToScan.slice(i, i + batchSize);
        spinner.text = `Scanning ${scanned + batch.length}/${cryptosToScan.length} cryptocurrencies...`;
        const results = await Promise.all(batch.map((symbol) => analyzeCrypto(symbol)));
        for (const result of results) {
            if (result) {
                opportunities.push(result);
            }
        }
        scanned += batch.length;
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < cryptosToScan.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    spinner.succeed(`Scanned ${scanned} cryptocurrencies`);
    // Sort and categorize
    const sortedByScore = [...opportunities].sort((a, b) => b.overallScore - a.overallScore);
    const topBuys = sortedByScore.filter((o) => o.signal === "STRONG_BUY" || o.signal === "BUY");
    const topSells = sortedByScore.filter((o) => o.signal === "STRONG_SELL" || o.signal === "SELL");
    const cleanestCharts = [...opportunities]
        .sort((a, b) => b.wickScore - a.wickScore)
        .filter((o) => o.wickScore >= 60);
    const result = {
        timestamp: Date.now(),
        totalScanned: scanned,
        opportunities: sortedByScore,
        topBuys,
        topSells,
        cleanestCharts,
    };
    displayScanResults(result);
    return result;
}
