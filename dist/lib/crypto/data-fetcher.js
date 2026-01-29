"use strict";
/* global fetch */
/**
 * Cryptocurrency Data Fetcher
 * Fetches OHLCV data from Binance public API (no API key required)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSymbol = normalizeSymbol;
exports.fetchOHLCV = fetchOHLCV;
exports.fetch24hTicker = fetch24hTicker;
exports.fetchCryptoData = fetchCryptoData;
exports.getSupportedSymbols = getSupportedSymbols;
exports.isValidSymbol = isValidSymbol;
// Common crypto symbols mapping (user-friendly -> Binance format)
const SYMBOL_MAP = {
    btc: "BTCUSDT",
    bitcoin: "BTCUSDT",
    eth: "ETHUSDT",
    ethereum: "ETHUSDT",
    sol: "SOLUSDT",
    solana: "SOLUSDT",
    xrp: "XRPUSDT",
    ripple: "XRPUSDT",
    doge: "DOGEUSDT",
    dogecoin: "DOGEUSDT",
    ada: "ADAUSDT",
    cardano: "ADAUSDT",
    bnb: "BNBUSDT",
    dot: "DOTUSDT",
    polkadot: "DOTUSDT",
    matic: "MATICUSDT",
    polygon: "MATICUSDT",
    link: "LINKUSDT",
    chainlink: "LINKUSDT",
    avax: "AVAXUSDT",
    avalanche: "AVAXUSDT",
    ltc: "LTCUSDT",
    litecoin: "LTCUSDT",
    atom: "ATOMUSDT",
    cosmos: "ATOMUSDT",
    uni: "UNIUSDT",
    uniswap: "UNIUSDT",
    xlm: "XLMUSDT",
    stellar: "XLMUSDT",
    algo: "ALGOUSDT",
    algorand: "ALGOUSDT",
    near: "NEARUSDT",
    apt: "APTUSDT",
    aptos: "APTUSDT",
    arb: "ARBUSDT",
    arbitrum: "ARBUSDT",
    op: "OPUSDT",
    optimism: "OPUSDT",
    sui: "SUIUSDT",
    pepe: "PEPEUSDT",
    shib: "SHIBUSDT",
    wif: "WIFUSDT",
};
const BINANCE_API_BASE = "https://api.binance.com/api/v3";
/**
 * Normalize symbol to Binance format
 */
function normalizeSymbol(input) {
    const lower = input.toLowerCase().trim();
    // Check if it's in our mapping
    if (SYMBOL_MAP[lower]) {
        return SYMBOL_MAP[lower];
    }
    // If already in USDT format, return uppercase
    if (lower.endsWith("usdt")) {
        return lower.toUpperCase();
    }
    // If ends with USD (not USDT), replace with USDT
    if (lower.endsWith("usd")) {
        return lower.slice(0, -3).toUpperCase() + "USDT";
    }
    // If ends with other quote currencies, keep as is
    if (lower.endsWith("btc") || lower.endsWith("eth") || lower.endsWith("bnb")) {
        return lower.toUpperCase();
    }
    // Default: append USDT
    return lower.toUpperCase() + "USDT";
}
/**
 * Fetch OHLCV candle data from Binance
 */
async function fetchOHLCV(symbol, interval = "1h", limit = 100) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const url = `${BINANCE_API_BASE}/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch data for ${normalizedSymbol}: ${error}`);
    }
    const data = await response.json();
    // Binance klines format:
    // [0] Open time, [1] Open, [2] High, [3] Low, [4] Close, [5] Volume, ...
    return data.map((candle) => ({
        timestamp: candle[0],
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
    }));
}
/**
 * Fetch 24h ticker data for price change info
 */
async function fetch24hTicker(symbol) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const url = `${BINANCE_API_BASE}/ticker/24hr?symbol=${normalizedSymbol}`;
    const response = await fetch(url);
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch ticker for ${normalizedSymbol}: ${error}`);
    }
    const data = await response.json();
    return {
        price: parseFloat(data.lastPrice),
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        volume24h: parseFloat(data.volume),
    };
}
/**
 * Fetch complete crypto data for analysis
 */
async function fetchCryptoData(symbol, interval = "1h", limit = 100) {
    const normalizedSymbol = normalizeSymbol(symbol);
    // Fetch both OHLCV and 24h ticker in parallel
    const [candles, ticker] = await Promise.all([
        fetchOHLCV(symbol, interval, limit),
        fetch24hTicker(symbol),
    ]);
    return {
        symbol: normalizedSymbol,
        interval,
        candles,
        currentPrice: ticker.price,
        priceChange24h: ticker.priceChange,
        priceChangePercent24h: ticker.priceChangePercent,
    };
}
/**
 * Get list of supported symbols
 */
function getSupportedSymbols() {
    return [...new Set(Object.keys(SYMBOL_MAP))];
}
/**
 * Check if a symbol is valid/supported
 */
async function isValidSymbol(symbol) {
    try {
        const normalizedSymbol = normalizeSymbol(symbol);
        const url = `${BINANCE_API_BASE}/ticker/price?symbol=${normalizedSymbol}`;
        const response = await fetch(url);
        return response.ok;
    }
    catch {
        return false;
    }
}
