'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw, TrendingUp, TrendingDown, Activity,
  Clock, AlertCircle, Zap
} from 'lucide-react';
import SignalCard from './SignalCard';
import SymbolSelector from './SymbolSelector';
import TradingChart from './TradingChart';
import ICTPanel from './ICTPanel';
import StrategyPanel from './StrategyPanel';
import {
  getSignal, getPriceData, getICTSignal, getStrategy, getBatchSignals,
  POPULAR_SYMBOLS, INTERVALS,
  TradingSignal, PriceData, ICTSignal, StrategyResult
} from '@/lib/api';

export default function Dashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [signal, setSignal] = useState<TradingSignal | null>(null);
  const [ictSignal, setIctSignal] = useState<ICTSignal | null>(null);
  const [strategyResult, setStrategyResult] = useState<StrategyResult | null>(null);
  const [batchSignals, setBatchSignals] = useState<Map<string, TradingSignal>>(new Map());

  // Favorites
  const [favorites, setFavorites] = useState<string[]>(['BTC', 'ETH', 'SOL']);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [priceRes, signalRes, ictRes, strategyRes] = await Promise.all([
        getPriceData(selectedSymbol, selectedInterval, 100),
        getSignal(selectedSymbol, selectedInterval),
        getICTSignal(selectedSymbol, selectedInterval),
        getStrategy(selectedSymbol, 'swing', 'any', 1),
      ]);

      setPriceData(priceRes);
      setSignal(signalRes);
      setIctSignal(ictRes);
      setStrategyResult(strategyRes);

      // Fetch batch signals for popular coins
      const topCoins = POPULAR_SYMBOLS.slice(0, 8).filter(s => s !== selectedSymbol);
      try {
        const batchRes = await getBatchSignals(topCoins, selectedInterval);
        const signalMap = new Map<string, TradingSignal>();
        topCoins.forEach((symbol, idx) => {
          if (batchRes[idx]) {
            signalMap.set(symbol, batchRes[idx]);
          }
        });
        setBatchSignals(signalMap);
      } catch {
        console.log('Batch signals not available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [selectedSymbol, selectedInterval]);

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card p-8 text-center"
      >
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
        <p className="text-gray-400 mb-4">{error}</p>
        <p className="text-sm text-gray-500 mb-4">
          Make sure the API server is running on port 3000
        </p>
        <button
          onClick={fetchData}
          className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-white font-medium transition-colors"
        >
          Retry Connection
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SymbolSelector
          selectedSymbol={selectedSymbol}
          onSelect={setSelectedSymbol}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />

        <div className="flex items-center gap-3">
          {/* Interval Selector */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
            {INTERVALS.map((int) => (
              <button
                key={int.value}
                onClick={() => setSelectedInterval(int.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedInterval === int.value
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {int.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* Quick Stats */}
      {priceData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <div className="glass-card p-4">
            <p className="text-sm text-gray-400 mb-1">Current Price</p>
            <p className="text-2xl font-bold font-mono text-white">
              ${priceData.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-gray-400 mb-1">24h Change</p>
            <p className={`text-2xl font-bold font-mono ${
              priceData.priceChangePercent24h >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {priceData.priceChangePercent24h >= 0 ? '+' : ''}
              {priceData.priceChangePercent24h.toFixed(2)}%
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-gray-400 mb-1">Signal</p>
            <div className="flex items-center gap-2">
              {signal?.signal === 'BUY' ? (
                <TrendingUp className="w-6 h-6 text-green-400" />
              ) : signal?.signal === 'SELL' ? (
                <TrendingDown className="w-6 h-6 text-red-400" />
              ) : (
                <Activity className="w-6 h-6 text-yellow-400" />
              )}
              <span className={`text-2xl font-bold ${
                signal?.signal === 'BUY' ? 'text-green-400' :
                signal?.signal === 'SELL' ? 'text-red-400' :
                'text-yellow-400'
              }`}>
                {signal?.signal || 'HOLD'}
              </span>
            </div>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-gray-400 mb-1">Confidence</p>
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-violet-400" />
              <span className="text-2xl font-bold text-white">
                {signal?.confidence || 0}%
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart - Takes 2 columns */}
        <div className="lg:col-span-2">
          {priceData && priceData.candles.length > 0 && (
            <TradingChart
              data={priceData.candles}
              symbol={selectedSymbol}
              entry={signal?.entry}
              stopLoss={signal?.stopLoss}
              takeProfit={signal?.takeProfit}
            />
          )}
        </div>

        {/* Quick Signal Card */}
        <div>
          {signal && (
            <SignalCard
              symbol={selectedSymbol}
              signal={signal.signal}
              confidence={signal.confidence}
              entry={signal.entry}
              stopLoss={signal.stopLoss}
              takeProfit={signal.takeProfit}
              price={priceData?.currentPrice}
              priceChange={priceData?.priceChangePercent24h}
              reasoning={signal.reasoning}
            />
          )}
        </div>
      </div>

      {/* ICT Panel */}
      {ictSignal && (
        <ICTPanel data={ictSignal} symbol={selectedSymbol} />
      )}

      {/* Strategy Panel */}
      {strategyResult && (
        <StrategyPanel data={strategyResult} />
      )}

      {/* Other Signals Grid */}
      {batchSignals.size > 0 && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-400" />
            Market Signals
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from(batchSignals.entries()).map(([symbol, sig], idx) => (
              <SignalCard
                key={symbol}
                symbol={symbol}
                signal={sig.signal}
                confidence={sig.confidence}
                entry={sig.entry}
                stopLoss={sig.stopLoss}
                takeProfit={sig.takeProfit}
                onClick={() => setSelectedSymbol(symbol)}
                delay={idx * 0.05}
              />
            ))}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && !priceData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-8 text-center">
            <div className="spinner mx-auto mb-4" />
            <p className="text-white font-medium">Loading market data...</p>
            <p className="text-sm text-gray-400">Fetching {selectedSymbol} analysis</p>
          </div>
        </div>
      )}
    </div>
  );
}
