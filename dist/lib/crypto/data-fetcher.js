"use strict";
/* global fetch */
/**
 * Cryptocurrency Data Fetcher
 * Fetches OHLCV data from Binance public API (no API key required)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAllSymbols = fetchAllSymbols;
exports.findSimilarSymbols = findSimilarSymbols;
exports.normalizeSymbol = normalizeSymbol;
exports.fetchOHLCV = fetchOHLCV;
exports.fetch24hTicker = fetch24hTicker;
exports.fetchCryptoData = fetchCryptoData;
exports.getSupportedSymbols = getSupportedSymbols;
exports.isValidSymbol = isValidSymbol;
exports.validateSymbol = validateSymbol;
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
const BYBIT_API_BASE = "https://api.bybit.com/v5/market";
const CRYPTOCOMPARE_API_BASE = "https://min-api.cryptocompare.com/data";
// Map Binance intervals to Bybit intervals
const BYBIT_INTERVAL_MAP = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "1h": "60",
    "4h": "240",
    "1d": "D",
    "1w": "W",
};
// Map intervals to CryptoCompare endpoints and params
const CRYPTOCOMPARE_INTERVAL_MAP = {
    "1m": { endpoint: "histominute", aggregate: 1 },
    "5m": { endpoint: "histominute", aggregate: 5 },
    "15m": { endpoint: "histominute", aggregate: 15 },
    "1h": { endpoint: "histohour", aggregate: 1 },
    "4h": { endpoint: "histohour", aggregate: 4 },
    "1d": { endpoint: "histoday", aggregate: 1 },
    "1w": { endpoint: "histoday", aggregate: 7 },
};
// Cache for valid Binance symbols
let cachedSymbols = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache
/**
 * Fetch all valid USDT trading pairs from Bybit (fallback)
 */
async function fetchAllSymbolsFromBybit() {
    try {
        const response = await fetch(`${BYBIT_API_BASE}/instruments-info?category=spot`);
        if (!response.ok) {
            throw new Error("Failed to fetch exchange info from Bybit");
        }
        const data = await response.json();
        const symbols = new Set();
        if (data.retCode === 0 && data.result.list) {
            for (const instrument of data.result.list) {
                // Only include USDT pairs that are trading
                if (instrument.status === "Trading" && instrument.quoteCoin === "USDT") {
                    symbols.add(instrument.symbol);
                    // Also add the base asset for easy lookup
                    symbols.add(instrument.baseCoin.toLowerCase());
                }
            }
        }
        return symbols;
    }
    catch {
        return new Set();
    }
}
/**
 * Get common crypto symbols as fallback (when all APIs are blocked)
 */
function getCommonSymbols() {
    const common = [
        "BTC",
        "ETH",
        "BNB",
        "XRP",
        "SOL",
        "ADA",
        "DOGE",
        "DOT",
        "MATIC",
        "LTC",
        "AVAX",
        "LINK",
        "ATOM",
        "UNI",
        "XLM",
        "ALGO",
        "NEAR",
        "APT",
        "ARB",
        "OP",
        "SUI",
        "PEPE",
        "SHIB",
        "WIF",
        "TRX",
        "ETC",
        "FIL",
        "HBAR",
        "VET",
        "ICP",
    ];
    const symbols = new Set();
    for (const sym of common) {
        symbols.add(`${sym}USDT`);
        symbols.add(sym.toLowerCase());
    }
    return symbols;
}
/**
 * Fetch all valid USDT trading pairs (tries Binance -> Bybit -> fallback to common)
 */
async function fetchAllSymbols() {
    // Return cached symbols if still valid
    if (cachedSymbols && Date.now() - cacheTimestamp < CACHE_DURATION) {
        return cachedSymbols;
    }
    // Try Binance first
    try {
        const response = await fetch(`${BINANCE_API_BASE}/exchangeInfo`);
        if (response.ok) {
            const data = await response.json();
            const symbols = new Set();
            for (const symbol of data.symbols) {
                // Only include USDT pairs that are trading
                if (symbol.status === "TRADING" && symbol.quoteAsset === "USDT") {
                    symbols.add(symbol.symbol);
                    // Also add the base asset for easy lookup
                    symbols.add(symbol.baseAsset.toLowerCase());
                }
            }
            cachedSymbols = symbols;
            cacheTimestamp = Date.now();
            return symbols;
        }
    }
    catch {
        // Continue to fallback
    }
    // Try Bybit as fallback
    try {
        const symbols = await fetchAllSymbolsFromBybit();
        if (symbols.size > 0) {
            cachedSymbols = symbols;
            cacheTimestamp = Date.now();
            return symbols;
        }
    }
    catch {
        // Continue to fallback
    }
    // Use common symbols as final fallback
    const symbols = getCommonSymbols();
    cachedSymbols = symbols;
    cacheTimestamp = Date.now();
    return symbols;
}
/**
 * Get similar symbols for suggestions
 */
async function findSimilarSymbols(input, limit = 5) {
    const symbols = await fetchAllSymbols();
    const inputUpper = input.toUpperCase();
    const similar = [];
    for (const symbol of symbols) {
        // Only show USDT pairs, not base assets
        if (!symbol.endsWith("USDT"))
            continue;
        const baseAsset = symbol.replace("USDT", "");
        // Check if base asset starts with or contains the input
        if (baseAsset.startsWith(inputUpper) || baseAsset.includes(inputUpper)) {
            similar.push(baseAsset);
            if (similar.length >= limit)
                break;
        }
    }
    return similar;
}
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
 * Fetch OHLCV candle data from Bybit (fallback)
 */
async function fetchOHLCVFromBybit(symbol, interval = "1h", limit = 100) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const bybitInterval = BYBIT_INTERVAL_MAP[interval];
    const url = `${BYBIT_API_BASE}/kline?category=spot&symbol=${normalizedSymbol}&interval=${bybitInterval}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch data for ${normalizedSymbol}: ${error}`);
    }
    const data = await response.json();
    if (data.retCode !== 0) {
        throw new Error(`Bybit API error: ${data.retMsg}`);
    }
    // Bybit klines are in reverse order (newest first), so we reverse them
    // Format: [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
    return data.result.list
        .map((candle) => ({
        timestamp: parseInt(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
    }))
        .reverse();
}
/**
 * Fetch 24h ticker data from Bybit (fallback)
 */
async function fetch24hTickerFromBybit(symbol) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const url = `${BYBIT_API_BASE}/tickers?category=spot&symbol=${normalizedSymbol}`;
    const response = await fetch(url);
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch ticker for ${normalizedSymbol}: ${error}`);
    }
    const data = await response.json();
    if (data.retCode !== 0 || !data.result.list.length) {
        throw new Error(`Bybit API error: ${data.retMsg || "Symbol not found"}`);
    }
    const ticker = data.result.list[0];
    const price = parseFloat(ticker.lastPrice);
    const prevPrice = parseFloat(ticker.prevPrice24h);
    const priceChange = price - prevPrice;
    const priceChangePercent = parseFloat(ticker.price24hPcnt) * 100;
    return {
        price,
        priceChange,
        priceChangePercent,
        high24h: parseFloat(ticker.highPrice24h),
        low24h: parseFloat(ticker.lowPrice24h),
        volume24h: parseFloat(ticker.volume24h),
    };
}
/**
 * Check if error is due to geo-restriction or CloudFront block
 */
function isGeoRestricted(error) {
    return (error.includes("restricted location") ||
        error.includes("Service unavailable") ||
        error.includes("CloudFront") ||
        error.includes("403") ||
        error.includes("block access from your country"));
}
/**
 * Extract base symbol from normalized symbol (e.g., BTCUSDT -> BTC)
 */
function getBaseSymbol(normalizedSymbol) {
    if (normalizedSymbol.endsWith("USDT")) {
        return normalizedSymbol.slice(0, -4);
    }
    if (normalizedSymbol.endsWith("USD")) {
        return normalizedSymbol.slice(0, -3);
    }
    return normalizedSymbol;
}
/**
 * Fetch OHLCV candle data from CryptoCompare (globally accessible, no geo-restrictions)
 */
async function fetchOHLCVFromCryptoCompare(symbol, interval = "1h", limit = 100) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const baseSymbol = getBaseSymbol(normalizedSymbol);
    const { endpoint, aggregate } = CRYPTOCOMPARE_INTERVAL_MAP[interval];
    const url = `${CRYPTOCOMPARE_API_BASE}/v2/${endpoint}?fsym=${baseSymbol}&tsym=USDT&limit=${limit}&aggregate=${aggregate}`;
    const response = await fetch(url);
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`CryptoCompare error for ${baseSymbol}: ${error}`);
    }
    const data = await response.json();
    if (data.Response === "Error") {
        throw new Error(`CryptoCompare error: ${data.Message}`);
    }
    // CryptoCompare format: { time, open, high, low, close, volumefrom, volumeto }
    return data.Data.Data.map((candle) => ({
        timestamp: candle.time * 1000, // Convert to milliseconds
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volumefrom,
    }));
}
/**
 * Fetch 24h ticker data from CryptoCompare (globally accessible)
 */
async function fetch24hTickerFromCryptoCompare(symbol) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const baseSymbol = getBaseSymbol(normalizedSymbol);
    // Fetch current price and 24h data
    const [priceResponse, dayResponse] = await Promise.all([
        fetch(`${CRYPTOCOMPARE_API_BASE}/price?fsym=${baseSymbol}&tsyms=USDT`),
        fetch(`${CRYPTOCOMPARE_API_BASE}/v2/histoday?fsym=${baseSymbol}&tsym=USDT&limit=1`),
    ]);
    if (!priceResponse.ok || !dayResponse.ok) {
        throw new Error(`CryptoCompare error fetching ticker for ${baseSymbol}`);
    }
    const priceData = await priceResponse.json();
    const dayData = await dayResponse.json();
    if (priceData.Response === "Error" || dayData.Response === "Error") {
        throw new Error(`CryptoCompare error: Symbol ${baseSymbol} not found`);
    }
    const currentPrice = priceData.USDT;
    const dayCandles = dayData.Data.Data;
    // Get yesterday's data for 24h change calculation
    const yesterday = dayCandles[0];
    const today = dayCandles[1] || yesterday;
    const priceChange = currentPrice - yesterday.close;
    const priceChangePercent = (priceChange / yesterday.close) * 100;
    return {
        price: currentPrice,
        priceChange,
        priceChangePercent,
        high24h: today.high,
        low24h: today.low,
        volume24h: today.volumefrom,
    };
}
/**
 * Fetch OHLCV candle data (tries Binance -> Bybit -> CryptoCompare)
 */
async function fetchOHLCV(symbol, interval = "1h", limit = 100) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const errors = [];
    // Try Binance first
    try {
        const url = `${BINANCE_API_BASE}/klines?symbol=${normalizedSymbol}&interval=${interval}&limit=${limit}`;
        const response = await fetch(url);
        if (response.ok) {
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
        errors.push(`Binance: ${response.status}`);
    }
    catch (e) {
        errors.push(`Binance: ${e.message}`);
    }
    // Try Bybit as fallback
    try {
        return await fetchOHLCVFromBybit(symbol, interval, limit);
    }
    catch (e) {
        errors.push(`Bybit: ${e.message}`);
    }
    // Try CryptoCompare as final fallback (globally accessible)
    try {
        return await fetchOHLCVFromCryptoCompare(symbol, interval, limit);
    }
    catch (e) {
        errors.push(`CryptoCompare: ${e.message}`);
    }
    throw new Error(`Failed to fetch data for ${normalizedSymbol}. Tried all providers: ${errors.join("; ")}`);
}
/**
 * Fetch 24h ticker data for price change info (tries Binance -> Bybit -> CryptoCompare)
 */
async function fetch24hTicker(symbol) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const errors = [];
    // Try Binance first
    try {
        const url = `${BINANCE_API_BASE}/ticker/24hr?symbol=${normalizedSymbol}`;
        const response = await fetch(url);
        if (response.ok) {
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
        errors.push(`Binance: ${response.status}`);
    }
    catch (e) {
        errors.push(`Binance: ${e.message}`);
    }
    // Try Bybit as fallback
    try {
        return await fetch24hTickerFromBybit(symbol);
    }
    catch (e) {
        errors.push(`Bybit: ${e.message}`);
    }
    // Try CryptoCompare as final fallback (globally accessible)
    try {
        return await fetch24hTickerFromCryptoCompare(symbol);
    }
    catch (e) {
        errors.push(`CryptoCompare: ${e.message}`);
    }
    throw new Error(`Failed to fetch ticker for ${normalizedSymbol}. Tried all providers: ${errors.join("; ")}`);
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
 * Check if a symbol is valid/supported by trying to fetch its price
 */
async function isValidSymbol(symbol) {
    try {
        const normalizedSymbol = normalizeSymbol(symbol);
        // First check our symbol cache
        const symbols = await fetchAllSymbols();
        if (symbols.has(normalizedSymbol) || symbols.has(normalizedSymbol.toLowerCase())) {
            return true;
        }
        // Try to actually fetch the ticker to validate
        try {
            await fetch24hTicker(symbol);
            return true;
        }
        catch {
            return false;
        }
    }
    catch {
        return false;
    }
}
/**
 * Validate symbol and get suggestions if invalid
 */
async function validateSymbol(symbol) {
    const normalized = normalizeSymbol(symbol);
    try {
        // Try to fetch the ticker - this will try all providers
        await fetch24hTicker(symbol);
        return { valid: true, normalized, suggestions: [] };
    }
    catch {
        // If invalid, find similar symbols from our cache
        const suggestions = await findSimilarSymbols(symbol, 5);
        return { valid: false, normalized, suggestions };
    }
}
