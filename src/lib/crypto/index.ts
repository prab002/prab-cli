/**
 * Crypto Trading Signal Module
 * Exports all crypto-related functionality
 */

export {
  fetchCryptoData,
  fetchOHLCV,
  fetch24hTicker,
  normalizeSymbol,
  getSupportedSymbols,
  isValidSymbol,
  type OHLCV,
  type CryptoData,
  type TimeInterval,
} from "./data-fetcher";

export {
  calculateEMA,
  calculateAllEMAs,
  calculateIndicators,
  generateSignal,
  formatSignalSummary,
  type SignalType,
  type EMAValues,
  type TechnicalIndicators,
  type TradingSignal,
} from "./analyzer";

export {
  generateTradingSignal,
  displaySignal,
  quickSignal,
  fullSignal,
  type SignalResult,
} from "./signal-generator";
