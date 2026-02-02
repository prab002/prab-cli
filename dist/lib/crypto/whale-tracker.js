"use strict";
/**
 * Whale Activity Tracker
 * Monitors large cryptocurrency transactions and exchange flows
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayWhaleActivity = displayWhaleActivity;
exports.runWhaleTracker = runWhaleTracker;
/* global fetch */
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
// Known exchange addresses (simplified list)
const EXCHANGE_ADDRESSES = {
    BTC: [
        "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97", // Binance
        "3FupZp77ySr7jwoLYEJ9mwzJpvoNBXsBnE", // Binance
        "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s", // Binance
        "bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h", // Binance
        "3Kzh9qAqVWQhEsfQz7zEQL1EuSx5tyNLNS", // Coinbase
        "3JZq4atUahhuA9rLhXLMhhTo133J9rF97j", // Coinbase
        "1Pzaqw98PeRfyHypfqyEgg5yycJRsENrE7", // Bitfinex
    ],
    ETH: [
        "0x28c6c06298d514db089934071355e5743bf21d60", // Binance
        "0x21a31ee1afc51d94c2efccaa2092ad1028285549", // Binance
        "0xdfd5293d8e347dfe59e90efd55b2956a1343963d", // Binance
        "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43", // Coinbase
        "0x503828976d22510aad0201ac7ec88293211d23da", // Coinbase
        "0x77134cbc06cb00b66f4c7e623d5fdbf6777635ec", // Kraken
    ],
};
// ============================================
// BLOCKCHAIN DATA FETCHING
// ============================================
/**
 * Fetch recent large BTC transactions from Blockchain.info
 */
async function fetchBTCWhaleTransactions(minAmount = 100) {
    const transactions = [];
    try {
        // Fetch latest unconfirmed transactions (more reliable than blocks)
        const response = await fetch("https://blockchain.info/unconfirmed-transactions?format=json");
        const data = await response.json();
        if (!data || !data.txs || !Array.isArray(data.txs)) {
            // Fallback: try fetching latest block
            const blocksRes = await fetch("https://blockchain.info/latestblock");
            const latestBlock = await blocksRes.json();
            if (latestBlock && latestBlock.hash) {
                const blockRes = await fetch(`https://blockchain.info/rawblock/${latestBlock.hash}?format=json`);
                const blockData = await blockRes.json();
                if (blockData && blockData.tx) {
                    for (const tx of blockData.tx.slice(0, 30)) {
                        processTransaction(tx, latestBlock.height, minAmount, transactions);
                    }
                }
            }
            return transactions;
        }
        // Process unconfirmed transactions
        for (const tx of data.txs.slice(0, 50)) {
            processTransaction(tx, 0, minAmount, transactions);
        }
    }
    catch (error) {
        // Silently handle errors - whale data is supplementary
    }
    return transactions;
}
/**
 * Process a single transaction and add to list if it meets criteria
 */
function processTransaction(tx, blockHeight, minAmount, transactions) {
    try {
        if (!tx || !tx.out)
            return;
        const totalOutput = tx.out.reduce((sum, out) => sum + (out.value || 0), 0);
        const btcAmount = totalOutput / 100000000; // Convert satoshis to BTC
        if (btcAmount >= minAmount) {
            const fromAddr = tx.inputs?.[0]?.prev_out?.addr || "unknown";
            const toAddr = tx.out?.[0]?.addr || "unknown";
            const fromType = isExchangeAddress(fromAddr, "BTC") ? "exchange" : "wallet";
            const toType = isExchangeAddress(toAddr, "BTC") ? "exchange" : "wallet";
            let flowType = "unknown";
            if (fromType === "wallet" && toType === "exchange")
                flowType = "exchange_inflow";
            else if (fromType === "exchange" && toType === "wallet")
                flowType = "exchange_outflow";
            else if (fromType === "wallet" && toType === "wallet")
                flowType = "wallet_transfer";
            transactions.push({
                hash: tx.hash || "unknown",
                coin: "BTC",
                amount: btcAmount,
                amountUSD: 0,
                from: fromAddr,
                to: toAddr,
                fromType,
                toType,
                flowType,
                timestamp: (tx.time || Date.now() / 1000) * 1000,
                blockHeight,
            });
        }
    }
    catch {
        // Skip invalid transactions
    }
}
/**
 * Fetch recent large ETH transactions from Etherscan (public API - limited)
 */
async function fetchETHWhaleTransactions(minAmount = 1000) {
    const transactions = [];
    try {
        // Use public Etherscan API (limited but no key needed for basic queries)
        // Fetch internal transactions of known whale addresses or latest blocks
        const response = await fetch(`https://api.etherscan.io/api?module=account&action=txlist&address=0x28c6c06298d514db089934071355e5743bf21d60&startblock=0&endblock=99999999&page=1&offset=20&sort=desc`);
        const data = await response.json();
        if (data.status !== "1" || !data.result)
            return transactions;
        for (const tx of data.result) {
            const ethAmount = parseFloat(tx.value) / 1e18;
            if (ethAmount >= minAmount) {
                const fromType = isExchangeAddress(tx.from, "ETH") ? "exchange" : "wallet";
                const toType = isExchangeAddress(tx.to, "ETH") ? "exchange" : "wallet";
                let flowType = "unknown";
                if (fromType === "wallet" && toType === "exchange")
                    flowType = "exchange_inflow";
                else if (fromType === "exchange" && toType === "wallet")
                    flowType = "exchange_outflow";
                else if (fromType === "wallet" && toType === "wallet")
                    flowType = "wallet_transfer";
                transactions.push({
                    hash: tx.hash,
                    coin: "ETH",
                    amount: ethAmount,
                    amountUSD: 0,
                    from: tx.from,
                    to: tx.to,
                    fromType,
                    toType,
                    flowType,
                    timestamp: parseInt(tx.timeStamp) * 1000,
                    blockHeight: parseInt(tx.blockNumber),
                });
            }
        }
    }
    catch (error) {
        console.error("Error fetching ETH whale transactions:", error);
    }
    return transactions;
}
/**
 * Check if address is a known exchange address
 */
function isExchangeAddress(address, coin) {
    const addresses = EXCHANGE_ADDRESSES[coin] || [];
    return addresses.some((a) => a.toLowerCase() === address.toLowerCase());
}
/**
 * Fetch current prices for USD conversion
 */
async function fetchPrices() {
    try {
        const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbols=[%22BTCUSDT%22,%22ETHUSDT%22]");
        const data = await response.json();
        const prices = {};
        for (const item of data) {
            const symbol = item.symbol.replace("USDT", "");
            prices[symbol] = parseFloat(item.price);
        }
        return prices;
    }
    catch {
        return { BTC: 85000, ETH: 2800 }; // Fallback prices
    }
}
// ============================================
// WHALE ACTIVITY ANALYSIS
// ============================================
/**
 * Analyze whale activity and generate summary
 */
function analyzeWhaleActivity(transactions, coin) {
    const coinTxs = transactions.filter((tx) => tx.coin === coin);
    let totalInflow = 0;
    let totalOutflow = 0;
    for (const tx of coinTxs) {
        if (tx.flowType === "exchange_inflow") {
            totalInflow += tx.amountUSD;
        }
        else if (tx.flowType === "exchange_outflow") {
            totalOutflow += tx.amountUSD;
        }
    }
    const netFlow = totalOutflow - totalInflow;
    // Determine sentiment based on net flow
    // Outflow > Inflow = Bullish (coins leaving exchanges = less sell pressure)
    // Inflow > Outflow = Bearish (coins entering exchanges = potential sell pressure)
    let sentiment = "neutral";
    if (netFlow > 1000000)
        sentiment = "bullish";
    else if (netFlow < -1000000)
        sentiment = "bearish";
    // Determine activity level
    let whaleActivity = "low";
    if (coinTxs.length >= 10)
        whaleActivity = "high";
    else if (coinTxs.length >= 5)
        whaleActivity = "medium";
    return {
        coin,
        totalInflow,
        totalOutflow,
        netFlow,
        largeTransactions: coinTxs.length,
        sentiment,
        whaleActivity,
        recentTransactions: coinTxs.slice(0, 5),
    };
}
// ============================================
// DISPLAY FUNCTIONS
// ============================================
function formatAmount(amount, coin) {
    if (amount >= 1000) {
        return `${(amount / 1000).toFixed(1)}K ${coin}`;
    }
    return `${amount.toFixed(2)} ${coin}`;
}
function formatUSD(amount) {
    if (amount >= 1000000000) {
        return `$${(amount / 1000000000).toFixed(2)}B`;
    }
    if (amount >= 1000000) {
        return `$${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
}
function truncateAddress(addr) {
    if (addr.length <= 16)
        return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}
function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (hours > 0)
        return `${hours}h ago`;
    if (minutes > 0)
        return `${minutes}m ago`;
    return "just now";
}
function displayWhaleActivity(summaries) {
    console.log("");
    console.log(chalk_1.default.bold.cyan("  ═══════════════════════════════════════════════════════"));
    console.log(chalk_1.default.bold.cyan("          🐋 WHALE ACTIVITY MONITOR                      "));
    console.log(chalk_1.default.bold.cyan("  ═══════════════════════════════════════════════════════"));
    console.log("");
    for (const summary of summaries) {
        const sentimentColor = summary.sentiment === "bullish"
            ? chalk_1.default.green
            : summary.sentiment === "bearish"
                ? chalk_1.default.red
                : chalk_1.default.yellow;
        const activityColor = summary.whaleActivity === "high"
            ? chalk_1.default.red
            : summary.whaleActivity === "medium"
                ? chalk_1.default.yellow
                : chalk_1.default.gray;
        console.log(chalk_1.default.bold.white(`  ┌─────────────────────────────────────────────────┐`));
        console.log(chalk_1.default.bold.white(`  │`) +
            chalk_1.default.bold.yellow(` 💰 ${summary.coin} WHALE ACTIVITY`.padEnd(48)) +
            chalk_1.default.bold.white(`│`));
        console.log(chalk_1.default.bold.white(`  └─────────────────────────────────────────────────┘`));
        console.log("");
        // Activity Level
        console.log(chalk_1.default.gray("  Activity Level: ") +
            activityColor(`${summary.whaleActivity.toUpperCase()} (${summary.largeTransactions} large txs)`));
        // Sentiment
        const sentimentIcon = summary.sentiment === "bullish" ? "🟢" : summary.sentiment === "bearish" ? "🔴" : "🟡";
        console.log(chalk_1.default.gray("  Market Sentiment: ") +
            sentimentColor(`${sentimentIcon} ${summary.sentiment.toUpperCase()}`));
        console.log("");
        // Flow Summary
        console.log(chalk_1.default.bold.white("  📊 EXCHANGE FLOW SUMMARY"));
        console.log(chalk_1.default.gray("  ┌─────────────────────────────────────────────────┐"));
        console.log(chalk_1.default.gray("  │") +
            chalk_1.default.red(`  📥 Inflow (Sell Pressure):  ${formatUSD(summary.totalInflow).padEnd(15)}`) +
            chalk_1.default.gray("│"));
        console.log(chalk_1.default.gray("  │") +
            chalk_1.default.green(`  📤 Outflow (Accumulation):  ${formatUSD(summary.totalOutflow).padEnd(15)}`) +
            chalk_1.default.gray("│"));
        console.log(chalk_1.default.gray("  │") +
            chalk_1.default.gray("  ─────────────────────────────────────────────") +
            chalk_1.default.gray("│"));
        const netFlowColor = summary.netFlow >= 0 ? chalk_1.default.green : chalk_1.default.red;
        const netFlowIcon = summary.netFlow >= 0 ? "↑" : "↓";
        console.log(chalk_1.default.gray("  │") +
            netFlowColor(`  ${netFlowIcon} Net Flow: ${formatUSD(Math.abs(summary.netFlow))} ${summary.netFlow >= 0 ? "(Bullish)" : "(Bearish)"}`.padEnd(46)) +
            chalk_1.default.gray("│"));
        console.log(chalk_1.default.gray("  └─────────────────────────────────────────────────┘"));
        console.log("");
        // Recent Transactions
        if (summary.recentTransactions.length > 0) {
            console.log(chalk_1.default.bold.white("  📋 RECENT LARGE TRANSACTIONS"));
            console.log("");
            for (const tx of summary.recentTransactions.slice(0, 5)) {
                const flowIcon = tx.flowType === "exchange_inflow"
                    ? chalk_1.default.red("📥 IN")
                    : tx.flowType === "exchange_outflow"
                        ? chalk_1.default.green("📤 OUT")
                        : chalk_1.default.gray("↔️ TFR");
                const typeLabel = tx.flowType === "exchange_inflow"
                    ? chalk_1.default.red("→ Exchange")
                    : tx.flowType === "exchange_outflow"
                        ? chalk_1.default.green("← Exchange")
                        : chalk_1.default.gray("Wallet→Wallet");
                console.log(chalk_1.default.gray("  ") +
                    flowIcon +
                    chalk_1.default.white(` ${formatAmount(tx.amount, tx.coin).padEnd(12)}`) +
                    chalk_1.default.gray(`(${formatUSD(tx.amountUSD)})`.padEnd(12)) +
                    typeLabel);
                console.log(chalk_1.default.gray(`      ${truncateAddress(tx.from)} → ${truncateAddress(tx.to)}`));
                console.log(chalk_1.default.gray(`      ${formatTimeAgo(tx.timestamp)}`));
                console.log("");
            }
        }
        // Interpretation
        console.log(chalk_1.default.bold.white("  💡 INTERPRETATION"));
        if (summary.sentiment === "bullish") {
            console.log(chalk_1.default.green("  Whales are moving coins OFF exchanges → Less sell pressure"));
            console.log(chalk_1.default.green("  This typically indicates accumulation phase"));
        }
        else if (summary.sentiment === "bearish") {
            console.log(chalk_1.default.red("  Whales are moving coins TO exchanges → Potential selling"));
            console.log(chalk_1.default.red("  This may indicate distribution phase"));
        }
        else {
            console.log(chalk_1.default.yellow("  Mixed whale activity → No clear directional bias"));
            console.log(chalk_1.default.yellow("  Wait for clearer signals before trading"));
        }
        console.log("");
        console.log(chalk_1.default.gray("  ─".repeat(25)));
        console.log("");
    }
}
/**
 * Detect whale activity based on volume analysis from Binance
 */
async function detectWhaleActivityFromVolume(symbol) {
    try {
        const pair = symbol.toUpperCase() + "USDT";
        // Fetch recent trades
        const tradesRes = await fetch(`https://api.binance.com/api/v3/trades?symbol=${pair}&limit=500`);
        const trades = await tradesRes.json();
        if (!Array.isArray(trades) || trades.length === 0)
            return null;
        // Fetch 24h ticker for context
        const tickerRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
        const ticker = await tickerRes.json();
        // Calculate average trade size
        const tradeSizes = trades.map((t) => parseFloat(t.quoteQty));
        const avgTradeSize = tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length;
        // Count "large" trades (>5x average)
        const largeTradeThreshold = avgTradeSize * 5;
        const largeTrades = trades.filter((t) => parseFloat(t.quoteQty) > largeTradeThreshold);
        // Calculate buy/sell pressure from large trades
        let buyVolume = 0;
        let sellVolume = 0;
        for (const trade of largeTrades) {
            const qty = parseFloat(trade.quoteQty);
            if (trade.isBuyerMaker) {
                sellVolume += qty; // Taker sold
            }
            else {
                buyVolume += qty; // Taker bought
            }
        }
        const totalLargeVolume = buyVolume + sellVolume;
        const buyPressure = totalLargeVolume > 0 ? (buyVolume / totalLargeVolume) * 100 : 50;
        const sellPressure = totalLargeVolume > 0 ? (sellVolume / totalLargeVolume) * 100 : 50;
        // Calculate volume ratio (current vs 24h average)
        const currentVolume = tradeSizes.reduce((a, b) => a + b, 0);
        const avgVolume24h = parseFloat(ticker.quoteVolume) / 24; // Hourly average
        const volumeRatio = avgVolume24h > 0 ? (currentVolume / avgVolume24h) * 60 : 1; // Normalize to ~1 hour
        // Determine sentiment
        let sentiment = "neutral";
        if (buyPressure > 60)
            sentiment = "bullish";
        else if (sellPressure > 60)
            sentiment = "bearish";
        // Determine activity level
        let whaleActivity = "low";
        if (largeTrades.length > 20 || volumeRatio > 2)
            whaleActivity = "high";
        else if (largeTrades.length > 10 || volumeRatio > 1.5)
            whaleActivity = "medium";
        return {
            coin: symbol,
            unusualVolumeRatio: volumeRatio,
            largeTradeCount: largeTrades.length,
            buyPressure,
            sellPressure,
            sentiment,
            whaleActivity,
        };
    }
    catch {
        return null;
    }
}
/**
 * Display volume-based whale activity
 */
function displayVolumeWhaleData(data) {
    console.log("");
    console.log(chalk_1.default.bold.magenta("  ┌─────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.bold.magenta("  │          📈 VOLUME-BASED WHALE DETECTION        │"));
    console.log(chalk_1.default.bold.magenta("  └─────────────────────────────────────────────────┘"));
    console.log("");
    console.log(chalk_1.default.gray("  Based on Binance large trade analysis (500 recent trades)"));
    console.log("");
    for (const item of data) {
        const sentimentColor = item.sentiment === "bullish"
            ? chalk_1.default.green
            : item.sentiment === "bearish"
                ? chalk_1.default.red
                : chalk_1.default.yellow;
        const activityColor = item.whaleActivity === "high"
            ? chalk_1.default.red
            : item.whaleActivity === "medium"
                ? chalk_1.default.yellow
                : chalk_1.default.gray;
        const sentimentIcon = item.sentiment === "bullish" ? "🟢" : item.sentiment === "bearish" ? "🔴" : "🟡";
        console.log(chalk_1.default.bold.white(`  ${item.coin}USDT`));
        console.log(chalk_1.default.gray("    Activity Level: ") +
            activityColor(`${item.whaleActivity.toUpperCase()} (${item.largeTradeCount} large trades)`));
        console.log(chalk_1.default.gray("    Volume Ratio:   ") +
            (item.unusualVolumeRatio > 1.5 ? chalk_1.default.yellow : chalk_1.default.gray)(`${item.unusualVolumeRatio.toFixed(1)}x normal`));
        console.log(chalk_1.default.gray("    Whale Pressure: ") +
            chalk_1.default.green(`Buy ${item.buyPressure.toFixed(0)}%`) +
            chalk_1.default.gray(" | ") +
            chalk_1.default.red(`Sell ${item.sellPressure.toFixed(0)}%`));
        console.log(chalk_1.default.gray("    Sentiment:      ") +
            sentimentColor(`${sentimentIcon} ${item.sentiment.toUpperCase()}`));
        // Visual pressure bar
        const buyBar = Math.round(item.buyPressure / 5);
        const sellBar = Math.round(item.sellPressure / 5);
        console.log(chalk_1.default.gray("    ") +
            chalk_1.default.green("█".repeat(buyBar)) +
            chalk_1.default.gray("░".repeat(20 - buyBar - sellBar)) +
            chalk_1.default.red("█".repeat(sellBar)));
        console.log("");
    }
}
// ============================================
// MAIN FUNCTION
// ============================================
async function runWhaleTracker(coins = ["BTC", "ETH"]) {
    const spinner = (0, ora_1.default)("Tracking whale activity...").start();
    try {
        spinner.text = "Fetching current prices...";
        const prices = await fetchPrices();
        spinner.text = "Scanning BTC blockchain for large transactions...";
        const btcTxs = await fetchBTCWhaleTransactions(50); // Lower threshold
        spinner.text = "Scanning ETH blockchain for large transactions...";
        const ethTxs = await fetchETHWhaleTransactions(200); // Lower threshold
        // Add USD values
        const allTransactions = [...btcTxs, ...ethTxs].map((tx) => ({
            ...tx,
            amountUSD: tx.amount * (prices[tx.coin] || 0),
        }));
        spinner.text = "Analyzing whale activity patterns...";
        const summaries = [];
        for (const coin of coins) {
            if (coin === "BTC" || coin === "ETH") {
                summaries.push(analyzeWhaleActivity(allTransactions, coin));
            }
        }
        // Also get volume-based whale detection
        spinner.text = "Analyzing large trade patterns on Binance...";
        const volumeData = [];
        for (const coin of coins) {
            const data = await detectWhaleActivityFromVolume(coin);
            if (data)
                volumeData.push(data);
        }
        spinner.succeed("Whale activity analysis complete");
        displayWhaleActivity(summaries);
        // Show volume-based analysis
        if (volumeData.length > 0) {
            displayVolumeWhaleData(volumeData);
        }
    }
    catch (error) {
        spinner.fail("Failed to track whale activity");
        console.log(chalk_1.default.red(`\nError: ${error.message}`));
    }
}
