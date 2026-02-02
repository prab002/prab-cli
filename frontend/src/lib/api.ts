import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Types
export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  midpoint?: number;
  strength: 'strong' | 'moderate' | 'weak';
  mitigated: boolean;
  index: number;
}

export interface FairValueGap {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  filled: boolean;
  index: number;
}

export interface TradingSignal {
  symbol?: string;
  price?: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  riskRewardRatio?: number;
  reasoning: string[];
  indicators?: Record<string, unknown>;
}

export interface ICTSignal {
  symbol: string;
  currentPrice: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  model: string;
  modelType?: string;
  killzone: {
    name: string;
    active: boolean;
    volatility: string;
    startHour?: number;
    endHour?: number;
  };
  inKillzone?: boolean;
  ote?: {
    active: boolean;
    quality: string;
    zone: { top: number; bottom: number };
    fibLevel?: number;
  };
  displacement?: {
    detected: boolean;
    direction: string;
    magnitude: number;
  };
  powerOf3?: {
    phase: string;
    phaseDescription: string;
    asianHigh: number;
    asianLow: number;
    manipulation?: string;
  };
  marketStructure: {
    trend: string;
    lastBOS?: { type: string; level: number };
    lastCHoCH?: { type: string; level: number };
  };
  premiumDiscount?: string;
  breakerBlocks?: unknown[];
  activeBreaker?: unknown;
  inducements?: unknown[];
  recentSweep?: unknown;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  riskRewardRatio: number;
  confluenceFactors?: string[];
  reasoning: string[];
  warnings?: string[];
}

export interface OrderBlockSignal {
  symbol: string;
  currentPrice: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  activeOB?: OrderBlock & { distancePercent: number; priceInZone: boolean };
  bullishOBs: OrderBlock[];
  bearishOBs: OrderBlock[];
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  trend: string;
  premiumDiscount: string;
  reasoning: string[];
  warnings?: string[];
}

export interface SMCAnalysis {
  symbol: string;
  currentPrice: number;
  marketStructure: string;
  orderBlocks: {
    bullish: OrderBlock[];
    bearish: OrderBlock[];
    nearest?: OrderBlock;
  };
  fairValueGaps: {
    bullish: FairValueGap[];
    bearish: FairValueGap[];
    unfilled: FairValueGap[];
  };
  liquidity?: unknown;
  premiumDiscount: string;
  bias: string;
}

export interface WhaleTransaction {
  hash: string;
  coin: string;
  amount: number;
  amountUSD: number;
  from: string;
  to: string;
  flowType: 'exchange_inflow' | 'exchange_outflow' | 'wallet_transfer';
  timestamp: number;
}

export interface WhaleActivity {
  coin: string;
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  largeTransactions: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  whaleActivity: 'high' | 'medium' | 'low';
  recentTransactions: WhaleTransaction[];
}

export interface CryptoNews {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  coins?: string[];
}

export interface PriceData {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  candles: OHLCV[];
}

export interface StrategyResult {
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  signal: 'BUY' | 'SELL' | 'HOLD';
  overallScore: number;
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number;
  recommendedLeverage: number;
  maxLeverage?: number;
  positionSize: number;
  scores: {
    technical: number;
    smc: number;
    volumeWhale: number;
    news: number;
    mtfAlignment: number;
  };
  mtfConfirmed?: boolean;
  trailingStops?: number[];
  alertStatus?: string;
  alertReasons?: string[];
  analysis?: string[];
  reasoning: string[];
  warnings?: string[];
}

// API Functions
export async function getSignal(symbol: string, interval: string = '1h'): Promise<TradingSignal> {
  const res = await api.get(`/api/signal/${symbol}`, { params: { interval } });
  const data = res.data.data;
  return {
    symbol: data.symbol,
    price: data.price,
    signal: data.signal,
    confidence: data.confidence,
    entry: data.price || 0,
    stopLoss: data.stopLoss,
    takeProfit: data.takeProfit,
    riskRewardRatio: data.takeProfit && data.stopLoss && data.price
      ? Math.abs((data.takeProfit - data.price) / (data.price - data.stopLoss))
      : 0,
    reasoning: data.reasoning || [],
    indicators: data.indicators,
  };
}

export async function getAnalysis(symbol: string): Promise<unknown> {
  const res = await api.get(`/api/analyze/${symbol}`);
  return res.data.data;
}

export async function getSMCAnalysis(symbol: string, interval: string = '4h'): Promise<SMCAnalysis> {
  const res = await api.get(`/api/smc/${symbol}`, { params: { interval } });
  return res.data.data;
}

export async function getOrderBlockSignal(symbol: string, interval: string = '4h'): Promise<OrderBlockSignal> {
  const res = await api.get(`/api/orderblock/${symbol}`, { params: { interval } });
  const data = res.data.data;
  return {
    symbol: data.symbol,
    currentPrice: data.currentPrice,
    signal: data.signal,
    confidence: data.confidence,
    activeOB: data.activeOrderBlock,
    bullishOBs: data.orderBlocks?.bullish || [],
    bearishOBs: data.orderBlocks?.bearish || [],
    entry: data.tradeSetup?.entry || data.currentPrice,
    stopLoss: data.tradeSetup?.stopLoss || 0,
    takeProfit1: data.tradeSetup?.takeProfit1 || 0,
    takeProfit2: data.tradeSetup?.takeProfit2 || 0,
    takeProfit3: data.tradeSetup?.takeProfit3 || 0,
    riskRewardRatio: data.tradeSetup?.riskRewardRatio || 0,
    trend: data.context?.trend || 'sideways',
    premiumDiscount: data.context?.premiumDiscount || 'equilibrium',
    reasoning: data.reasoning || [],
    warnings: data.warnings,
  };
}

export async function getICTSignal(symbol: string, interval: string = '1h'): Promise<ICTSignal> {
  const res = await api.get(`/api/ict/${symbol}`, { params: { interval } });
  const data = res.data.data;
  return {
    symbol: data.symbol,
    currentPrice: data.currentPrice,
    signal: data.signal,
    confidence: data.confidence,
    model: data.modelType || 'Standard',
    modelType: data.modelType,
    killzone: data.killzone || { name: 'None', active: false, volatility: 'low' },
    inKillzone: data.inKillzone,
    ote: data.ote,
    displacement: data.displacement,
    powerOf3: data.powerOf3,
    marketStructure: data.marketStructure || { trend: 'sideways' },
    premiumDiscount: data.premiumDiscount,
    breakerBlocks: data.breakerBlocks,
    activeBreaker: data.activeBreaker,
    inducements: data.inducements,
    recentSweep: data.recentSweep,
    entry: data.tradeSetup?.entry || data.currentPrice,
    stopLoss: data.tradeSetup?.stopLoss || 0,
    takeProfit: data.tradeSetup?.takeProfit1 || 0,
    takeProfit1: data.tradeSetup?.takeProfit1,
    takeProfit2: data.tradeSetup?.takeProfit2,
    takeProfit3: data.tradeSetup?.takeProfit3,
    riskRewardRatio: data.tradeSetup?.riskRewardRatio || 0,
    confluenceFactors: data.confluenceFactors,
    reasoning: data.reasoning || [],
    warnings: data.warnings,
  };
}

export async function getStrategy(
  symbol: string,
  style: string = 'moderate',
  direction: string = 'both',
  leverage: number = 20
): Promise<StrategyResult> {
  const res = await api.get(`/api/strategy/${symbol}`, {
    params: { style, direction, leverage },
  });
  const data = res.data.data;

  // Determine signal from direction
  const signal: 'BUY' | 'SELL' | 'HOLD' =
    data.direction === 'LONG' ? 'BUY' :
    data.direction === 'SHORT' ? 'SELL' : 'HOLD';

  return {
    symbol: data.symbol,
    direction: data.direction,
    signal,
    overallScore: data.scores?.overall || 50,
    confidence: data.confidence,
    entry: data.entry?.price || 0,
    stopLoss: data.entry?.stopLoss || 0,
    takeProfit1: data.entry?.takeProfit1 || 0,
    takeProfit2: data.entry?.takeProfit2 || 0,
    takeProfit3: data.entry?.takeProfit3 || 0,
    riskReward: data.riskManagement?.riskRewardRatio || 0,
    recommendedLeverage: data.riskManagement?.recommendedLeverage || 1,
    maxLeverage: data.riskManagement?.maxLeverage,
    positionSize: data.riskManagement?.positionSizePercent || 0,
    scores: {
      technical: data.scores?.technical || 50,
      smc: data.scores?.smc || 50,
      volumeWhale: data.scores?.volumeWhale || 50,
      news: data.scores?.news || 50,
      mtfAlignment: data.multiTimeframe?.alignment || 50,
    },
    mtfConfirmed: data.multiTimeframe?.confirmed,
    trailingStops: data.trailingStops,
    alertStatus: data.alert?.status,
    alertReasons: data.alert?.reasons,
    analysis: data.analysis,
    reasoning: data.analysis || [],
    warnings: data.warnings,
  };
}

export async function getPriceData(symbol: string, interval: string = '1h', limit: number = 100): Promise<PriceData> {
  const res = await api.get(`/api/price/${symbol}`, { params: { interval, limit } });
  const data = res.data.data;
  return {
    symbol: data.symbol,
    currentPrice: data.currentPrice,
    priceChange24h: data.priceChange24h || 0,
    priceChangePercent24h: data.priceChange24h || 0,
    high24h: data.high24h,
    low24h: data.low24h,
    volume24h: data.volume24h,
    candles: data.candles || [],
  };
}

export async function getBatchSignals(symbols: string[], interval: string = '1h'): Promise<TradingSignal[]> {
  const res = await api.post('/api/batch/signal', { symbols, interval });
  const results = res.data.data;

  return results.map((item: Record<string, unknown>) => ({
    symbol: item.symbol,
    price: item.price,
    signal: item.signal || 'HOLD',
    confidence: item.confidence || 50,
    entry: (item.price as number) || 0,
    stopLoss: 0,
    takeProfit: 0,
    reasoning: [],
  }));
}

export async function getHealth(): Promise<{ status: string; timestamp: number }> {
  const res = await api.get('/health');
  return res.data;
}

// Popular symbols for the dashboard
export const POPULAR_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC',
  'LINK', 'UNI', 'ATOM', 'LTC', 'NEAR', 'ARB', 'OP', 'APT', 'SUI', 'PEPE'
];

export const INTERVALS = [
  { value: '1m', label: '1 Min' },
  { value: '5m', label: '5 Min' },
  { value: '15m', label: '15 Min' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' },
];
