/* global fetch */
/**
 * Cryptocurrency Data Fetcher
 * Fetches OHLCV data from Binance public API (no API key required)
 */

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CryptoData {
  symbol: string;
  interval: string;
  candles: OHLCV[];
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
}

export type TimeInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

// Common crypto symbols mapping (user-friendly -> Binance format)
const SYMBOL_MAP: Record<string, string> = {
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

// Cache for valid Binance symbols
let cachedSymbols: Set<string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache

/**
 * Fetch all valid USDT trading pairs from Binance
 */
export async function fetchAllSymbols(): Promise<Set<string>> {
  // Return cached symbols if still valid
  if (cachedSymbols && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedSymbols;
  }

  try {
    const response = await fetch(`${BINANCE_API_BASE}/exchangeInfo`);
    if (!response.ok) {
      throw new Error("Failed to fetch exchange info");
    }

    const data = await response.json();
    const symbols = new Set<string>();

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
  } catch (error) {
    // Return empty set on error, will fall back to direct API check
    return new Set();
  }
}

/**
 * Get similar symbols for suggestions
 */
export async function findSimilarSymbols(input: string, limit: number = 5): Promise<string[]> {
  const symbols = await fetchAllSymbols();
  const inputUpper = input.toUpperCase();
  const similar: string[] = [];

  for (const symbol of symbols) {
    // Only show USDT pairs, not base assets
    if (!symbol.endsWith("USDT")) continue;

    const baseAsset = symbol.replace("USDT", "");

    // Check if base asset starts with or contains the input
    if (baseAsset.startsWith(inputUpper) || baseAsset.includes(inputUpper)) {
      similar.push(baseAsset);
      if (similar.length >= limit) break;
    }
  }

  return similar;
}

/**
 * Normalize symbol to Binance format
 */
export function normalizeSymbol(input: string): string {
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
export async function fetchOHLCV(
  symbol: string,
  interval: TimeInterval = "1h",
  limit: number = 100
): Promise<OHLCV[]> {
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
  return data.map((candle: any[]) => ({
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
export async function fetch24hTicker(symbol: string): Promise<{
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}> {
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
export async function fetchCryptoData(
  symbol: string,
  interval: TimeInterval = "1h",
  limit: number = 100
): Promise<CryptoData> {
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
export function getSupportedSymbols(): string[] {
  return [...new Set(Object.keys(SYMBOL_MAP))];
}

/**
 * Check if a symbol is valid/supported
 */
export async function isValidSymbol(symbol: string): Promise<boolean> {
  try {
    const normalizedSymbol = normalizeSymbol(symbol);

    // First check cache
    const symbols = await fetchAllSymbols();
    if (symbols.has(normalizedSymbol)) {
      return true;
    }

    // Fall back to direct API check
    const url = `${BINANCE_API_BASE}/ticker/price?symbol=${normalizedSymbol}`;
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Validate symbol and get suggestions if invalid
 */
export async function validateSymbol(symbol: string): Promise<{
  valid: boolean;
  normalized: string;
  suggestions: string[];
}> {
  const normalized = normalizeSymbol(symbol);

  try {
    const url = `${BINANCE_API_BASE}/ticker/price?symbol=${normalized}`;
    const response = await fetch(url);

    if (response.ok) {
      return { valid: true, normalized, suggestions: [] };
    }

    // If invalid, find similar symbols
    const suggestions = await findSimilarSymbols(symbol, 5);
    return { valid: false, normalized, suggestions };
  } catch {
    const suggestions = await findSimilarSymbols(symbol, 5);
    return { valid: false, normalized, suggestions };
  }
}
