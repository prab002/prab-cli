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
  comprehensiveAnalysis,
  displayComprehensiveAnalysis,
  type SignalResult,
} from "./signal-generator";

export {
  analyzeMarket,
  type ComprehensiveAnalysis,
  type RecommendationType,
  type TimeframeAnalysis,
  type TimingRecommendation,
  type TradeSetup,
  type MarketCondition,
} from "./market-analyzer";

export {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  analyzeVolume,
  calculateSupportResistance,
  analyzeTrend,
  type RSIResult,
  type MACDResult,
  type BollingerResult,
  type ATRResult,
  type VolumeResult,
  type SupportResistance,
  type TrendResult,
} from "./indicators";

export {
  analyzeSMC,
  findSwingPoints,
  findOrderBlocks,
  findFairValueGaps,
  findLiquidityZones,
  calculatePremiumDiscount,
  type SMCAnalysis,
  type OrderBlock,
  type FairValueGap,
  type StructureBreak,
  type LiquidityZone,
  type SwingPoint,
} from "./smc-indicators";

export {
  runSMCAnalysis,
  displaySMCAnalysis,
  type FullSMCAnalysis,
  type SMCTradeSetup,
} from "./smc-analyzer";
