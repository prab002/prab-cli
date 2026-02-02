"use strict";
/**
 * Crypto News Fetcher
 * Fetches latest cryptocurrency news from free APIs
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayNews = displayNews;
exports.fetchCryptoNews = fetchCryptoNews;
exports.runCryptoNews = runCryptoNews;
/* global fetch */
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
// ============================================
// NEWS SOURCES
// ============================================
/**
 * Fetch news from CryptoPanic (free public API)
 */
async function fetchCryptoPanicNews(filter) {
    try {
        // CryptoPanic free public feed
        let url = "https://cryptopanic.com/api/free/v1/posts/?public=true";
        if (filter) {
            url += `&currencies=${filter.toUpperCase()}`;
        }
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
            },
        });
        if (!response.ok) {
            return [];
        }
        const data = await response.json();
        if (!data.results || !Array.isArray(data.results)) {
            return [];
        }
        return data.results.slice(0, 15).map((item) => ({
            title: item.title || "No title",
            description: item.title || "", // CryptoPanic doesn't always have description
            url: item.url || "",
            source: item.source?.title || "CryptoPanic",
            publishedAt: item.published_at || new Date().toISOString(),
            sentiment: item.votes ? determineSentiment(item.votes) : "neutral",
            coins: item.currencies?.map((c) => c.code) || [],
        }));
    }
    catch (error) {
        return [];
    }
}
/**
 * Fetch news from CoinGecko status updates (free, no API key)
 */
async function fetchCoinGeckoNews() {
    try {
        const response = await fetch("https://api.coingecko.com/api/v3/news", {
            headers: {
                Accept: "application/json",
            },
        });
        if (!response.ok) {
            return [];
        }
        const data = await response.json();
        if (!data.data || !Array.isArray(data.data)) {
            return [];
        }
        return data.data.slice(0, 10).map((item) => ({
            title: item.title || "No title",
            description: item.description || "",
            url: item.url || "",
            source: item.news_site || "CoinGecko",
            publishedAt: item.updated_at || new Date().toISOString(),
            sentiment: "neutral",
            coins: [],
        }));
    }
    catch (error) {
        return [];
    }
}
/**
 * Fetch from alternative free news API
 */
async function fetchAlternativeNews(query = "cryptocurrency") {
    try {
        // Using a free RSS-to-JSON service for crypto news
        const feeds = [
            `https://api.rss2json.com/v1/api.json?rss_url=https://cointelegraph.com/rss`,
            `https://api.rss2json.com/v1/api.json?rss_url=https://coindesk.com/arc/outboundfeeds/rss/`,
        ];
        const results = [];
        for (const feedUrl of feeds) {
            try {
                const response = await fetch(feedUrl);
                if (response.ok) {
                    const data = await response.json();
                    if (data.items && Array.isArray(data.items)) {
                        const newsItems = data.items.slice(0, 5).map((item) => ({
                            title: item.title || "No title",
                            description: stripHtml(item.description || ""),
                            url: item.link || "",
                            source: data.feed?.title || "Crypto News",
                            publishedAt: item.pubDate || new Date().toISOString(),
                            sentiment: "neutral",
                            coins: extractCoins(item.title + " " + item.description),
                        }));
                        results.push(...newsItems);
                    }
                }
            }
            catch {
                // Skip failed feed
            }
        }
        return results;
    }
    catch (error) {
        return [];
    }
}
// ============================================
// HELPER FUNCTIONS
// ============================================
function determineSentiment(votes) {
    if (!votes)
        return "neutral";
    const positive = (votes.positive || 0) + (votes.liked || 0);
    const negative = (votes.negative || 0) + (votes.disliked || 0);
    if (positive > negative + 2)
        return "positive";
    if (negative > positive + 2)
        return "negative";
    return "neutral";
}
function stripHtml(html) {
    return html
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim()
        .slice(0, 200);
}
function extractCoins(text) {
    const coins = [];
    const coinPatterns = [
        /\bBTC\b/gi,
        /\bBitcoin\b/gi,
        /\bETH\b/gi,
        /\bEthereum\b/gi,
        /\bSOL\b/gi,
        /\bSolana\b/gi,
        /\bXRP\b/gi,
        /\bRipple\b/gi,
        /\bADA\b/gi,
        /\bCardano\b/gi,
        /\bDOGE\b/gi,
        /\bDogecoin\b/gi,
        /\bBNB\b/gi,
        /\bAVAX\b/gi,
        /\bAvalanche\b/gi,
        /\bDOT\b/gi,
        /\bPolkadot\b/gi,
        /\bLINK\b/gi,
        /\bChainlink\b/gi,
        /\bMATIC\b/gi,
        /\bPolygon\b/gi,
        /\bSHIB\b/gi,
        /\bPEPE\b/gi,
    ];
    const normalizeMap = {
        bitcoin: "BTC",
        btc: "BTC",
        ethereum: "ETH",
        eth: "ETH",
        solana: "SOL",
        sol: "SOL",
        ripple: "XRP",
        xrp: "XRP",
        cardano: "ADA",
        ada: "ADA",
        dogecoin: "DOGE",
        doge: "DOGE",
        bnb: "BNB",
        avalanche: "AVAX",
        avax: "AVAX",
        polkadot: "DOT",
        dot: "DOT",
        chainlink: "LINK",
        link: "LINK",
        polygon: "MATIC",
        matic: "MATIC",
        shib: "SHIB",
        pepe: "PEPE",
    };
    for (const pattern of coinPatterns) {
        const matches = text.match(pattern);
        if (matches) {
            for (const match of matches) {
                const normalized = normalizeMap[match.toLowerCase()] || match.toUpperCase();
                if (!coins.includes(normalized)) {
                    coins.push(normalized);
                }
            }
        }
    }
    return coins;
}
function formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1)
        return "just now";
    if (diffMins < 60)
        return `${diffMins}m ago`;
    if (diffHours < 24)
        return `${diffHours}h ago`;
    if (diffDays < 7)
        return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
function getSentimentIcon(sentiment) {
    switch (sentiment) {
        case "positive":
            return chalk_1.default.green("▲");
        case "negative":
            return chalk_1.default.red("▼");
        default:
            return chalk_1.default.gray("●");
    }
}
function getSentimentColor(sentiment) {
    switch (sentiment) {
        case "positive":
            return chalk_1.default.green;
        case "negative":
            return chalk_1.default.red;
        default:
            return chalk_1.default.gray;
    }
}
// ============================================
// DISPLAY FUNCTION
// ============================================
function displayNews(result, filter) {
    console.log("");
    console.log(chalk_1.default.bold.cyan("  ╔═══════════════════════════════════════════════════════════════════╗"));
    console.log(chalk_1.default.bold.cyan("  ║              📰 LATEST CRYPTO NEWS & UPDATES                     ║"));
    console.log(chalk_1.default.bold.cyan("  ╚═══════════════════════════════════════════════════════════════════╝"));
    console.log("");
    if (filter) {
        console.log(chalk_1.default.bgYellow.black(` 🔍 Filtered: ${filter.toUpperCase()} `));
        console.log("");
    }
    console.log(chalk_1.default.gray(`  📊 ${result.news.length} news items | ${new Date(result.timestamp).toLocaleString()}`));
    console.log("");
    if (result.news.length === 0) {
        console.log(chalk_1.default.yellow("  ⚠️  No news found. Try again later or with a different filter."));
        console.log("");
        return;
    }
    for (let i = 0; i < result.news.length; i++) {
        const news = result.news[i];
        const timeAgo = formatTimeAgo(news.publishedAt);
        const sentimentIcon = getSentimentIcon(news.sentiment || "neutral");
        const sentimentColor = getSentimentColor(news.sentiment || "neutral");
        // News box header
        console.log(chalk_1.default.cyan(`  ┌${"─".repeat(70)}┐`));
        // News number and sentiment
        const numBadge = chalk_1.default.bgCyan.black(` ${(i + 1).toString().padStart(2)} `);
        console.log(`  │ ${numBadge} ${sentimentIcon} ${chalk_1.default.bold.white(truncateText(news.title, 58))}`);
        // Second line of title if needed
        if (news.title.length > 58) {
            console.log(`  │      ${chalk_1.default.white(news.title.slice(55, 120))}`);
        }
        console.log(chalk_1.default.cyan(`  ├${"─".repeat(70)}┤`));
        // Key highlights
        console.log(`  │  ${chalk_1.default.yellow("⏰")} ${chalk_1.default.dim("Time:")}     ${chalk_1.default.white(timeAgo)} ${chalk_1.default.dim("•")} ${chalk_1.default.gray(news.source)}`);
        // Related coins with badges
        if (news.coins && news.coins.length > 0) {
            const coinBadges = news.coins.map((c) => chalk_1.default.bgYellow.black(` ${c} `)).join(" ");
            console.log(`  │  ${chalk_1.default.yellow("🪙")} ${chalk_1.default.dim("Coins:")}    ${coinBadges}`);
        }
        // Sentiment indicator
        const sentimentText = news.sentiment === "positive"
            ? "Bullish"
            : news.sentiment === "negative"
                ? "Bearish"
                : "Neutral";
        console.log(`  │  ${chalk_1.default.yellow("📈")} ${chalk_1.default.dim("Sentiment:")} ${sentimentColor(sentimentText)}`);
        // Description with bullet point
        if (news.description && news.description.length > 20) {
            console.log(`  │`);
            console.log(`  │  ${chalk_1.default.cyan("►")} ${chalk_1.default.gray(truncateText(news.description, 65))}`);
        }
        // Full clickable URL
        console.log(`  │`);
        console.log(`  │  ${chalk_1.default.green("🔗")} ${chalk_1.default.blue.underline(news.url)}`);
        console.log(chalk_1.default.cyan(`  └${"─".repeat(70)}┘`));
        console.log("");
    }
    // Sentiment summary box
    const positive = result.news.filter((n) => n.sentiment === "positive").length;
    const negative = result.news.filter((n) => n.sentiment === "negative").length;
    const neutral = result.news.length - positive - negative;
    console.log(chalk_1.default.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
    console.log(chalk_1.default.gray("  │                        📊 SENTIMENT SUMMARY                        │"));
    console.log(chalk_1.default.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
    console.log(chalk_1.default.gray("  │   ") +
        chalk_1.default.green(`▲ ${positive} Bullish`) +
        "     " +
        chalk_1.default.red(`▼ ${negative} Bearish`) +
        "     " +
        chalk_1.default.gray(`● ${neutral} Neutral`) +
        chalk_1.default.gray("                    │"));
    console.log(chalk_1.default.gray("  └─────────────────────────────────────────────────────────────────────┘"));
    console.log("");
    console.log(chalk_1.default.dim.italic("  💡 Tip: Click on links to read the full article"));
    console.log("");
}
function truncateText(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxLength - 3) + "...";
}
// ============================================
// MAIN FUNCTION
// ============================================
async function fetchCryptoNews(filter) {
    const spinner = (0, ora_1.default)("Fetching latest crypto news...").start();
    try {
        // Fetch from multiple sources in parallel
        const [cryptoPanicNews, alternativeNews] = await Promise.all([
            fetchCryptoPanicNews(filter),
            fetchAlternativeNews(),
        ]);
        // Combine and deduplicate news
        const allNews = [...cryptoPanicNews, ...alternativeNews];
        // Remove duplicates based on similar titles
        const uniqueNews = [];
        const seenTitles = new Set();
        for (const news of allNews) {
            const normalizedTitle = news.title.toLowerCase().slice(0, 50);
            if (!seenTitles.has(normalizedTitle)) {
                seenTitles.add(normalizedTitle);
                uniqueNews.push(news);
            }
        }
        // Sort by date (newest first)
        uniqueNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        // Filter by coin if specified
        let filteredNews = uniqueNews;
        if (filter) {
            const filterUpper = filter.toUpperCase();
            filteredNews = uniqueNews.filter((news) => news.coins?.includes(filterUpper) ||
                news.title.toUpperCase().includes(filterUpper) ||
                news.description?.toUpperCase().includes(filterUpper));
        }
        spinner.succeed(`Fetched ${filteredNews.length} news items`);
        const result = {
            timestamp: Date.now(),
            news: filteredNews.slice(0, 20),
            totalCount: filteredNews.length,
        };
        return result;
    }
    catch (error) {
        spinner.fail("Failed to fetch news");
        return {
            timestamp: Date.now(),
            news: [],
            totalCount: 0,
        };
    }
}
/**
 * Run news fetcher and display results
 */
async function runCryptoNews(filter) {
    const result = await fetchCryptoNews(filter);
    displayNews(result, filter);
}
