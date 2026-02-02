'use client';

import { motion } from 'framer-motion';
import {
  Clock, Target, TrendingUp, TrendingDown, Activity,
  Zap, BarChart2, CheckCircle, XCircle
} from 'lucide-react';
import { ICTSignal } from '@/lib/api';

interface ICTPanelProps {
  data: ICTSignal;
  symbol: string;
}

// Helper function to safely format numbers
const formatPrice = (value: number | undefined | null, decimals: number = 2): string => {
  if (value === undefined || value === null || isNaN(value)) return '0.00';
  return value.toFixed(decimals);
};

export default function ICTPanel({ data, symbol }: ICTPanelProps) {
  if (!data) return null;

  const isValidSignal = data.signal !== 'HOLD';

  const getModelIcon = (model: string | undefined) => {
    switch (model) {
      case 'Silver Bullet': return '🎯';
      case 'OTE': return '📐';
      case 'Breaker Block': return '🧱';
      case 'Displacement': return '⚡';
      default: return '📊';
    }
  };

  const getKillzoneColor = (name: string | undefined) => {
    switch (name) {
      case 'London': return 'from-blue-500 to-blue-600';
      case 'New York AM': return 'from-orange-500 to-red-500';
      case 'New York PM': return 'from-purple-500 to-pink-500';
      case 'Asian': return 'from-teal-500 to-green-500';
      case 'Silver Bullet AM':
      case 'Silver Bullet PM': return 'from-yellow-400 to-orange-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const killzone = data.killzone || { name: 'None', active: false, volatility: 'low' };
  const marketStructure = data.marketStructure || { trend: 'sideways' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-violet-400" />
            ICT Strategy
          </h2>
          <p className="text-gray-400 text-sm mt-1">{symbol}/USDT Analysis</p>
        </div>

        {/* Model Badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600/30 to-cyan-600/30 border border-violet-500/30"
        >
          <span className="text-2xl mr-2">{getModelIcon(data.model)}</span>
          <span className="text-white font-bold">{data.model || 'Standard'}</span>
        </motion.div>
      </div>

      {/* Killzone Status */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Current Killzone</span>
        </div>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`p-4 rounded-xl bg-gradient-to-r ${getKillzoneColor(killzone.name)} bg-opacity-20 border border-white/10`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">{killzone.name || 'None'}</h3>
              <p className="text-sm text-white/70">
                {killzone.active ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Active Session
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-gray-400" />
                    Inactive
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                killzone.volatility === 'high' ? 'bg-red-500/30 text-red-300' :
                killzone.volatility === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                'bg-green-500/30 text-green-300'
              }`}>
                {killzone.volatility || 'low'} volatility
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Market Structure */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Trend */}
        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            {marketStructure.trend === 'bullish' ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : marketStructure.trend === 'bearish' ? (
              <TrendingDown className="w-5 h-5 text-red-400" />
            ) : (
              <BarChart2 className="w-5 h-5 text-yellow-400" />
            )}
            <span className="text-sm text-gray-400">Market Trend</span>
          </div>
          <p className={`text-xl font-bold capitalize ${
            marketStructure.trend === 'bullish' ? 'text-green-400' :
            marketStructure.trend === 'bearish' ? 'text-red-400' :
            'text-yellow-400'
          }`}>
            {marketStructure.trend || 'sideways'}
          </p>
        </div>

        {/* Signal */}
        <div className={`rounded-xl p-4 ${
          data.signal === 'BUY' ? 'bg-green-500/10 border border-green-500/30' :
          data.signal === 'SELL' ? 'bg-red-500/10 border border-red-500/30' :
          'bg-yellow-500/10 border border-yellow-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-violet-400" />
            <span className="text-sm text-gray-400">Signal</span>
          </div>
          <p className={`text-2xl font-bold ${
            data.signal === 'BUY' ? 'text-green-400 glow-success' :
            data.signal === 'SELL' ? 'text-red-400 glow-danger' :
            'text-yellow-400'
          }`}>
            {data.signal || 'HOLD'}
          </p>
        </div>
      </div>

      {/* OTE Section */}
      {data.ote && data.ote.zone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-6 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📐</span>
            <span className="font-bold text-white">Optimal Trade Entry (OTE)</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400">Status</p>
              <p className={`font-bold ${data.ote.active ? 'text-green-400' : 'text-gray-500'}`}>
                {data.ote.active ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Quality</p>
              <p className={`font-bold capitalize ${
                data.ote.quality === 'premium' ? 'text-green-400' :
                data.ote.quality === 'standard' ? 'text-yellow-400' :
                'text-gray-400'
              }`}>
                {data.ote.quality || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Zone</p>
              <p className="font-mono text-sm text-white">
                ${formatPrice(data.ote.zone.bottom)} - ${formatPrice(data.ote.zone.top)}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Displacement */}
      {data.displacement && data.displacement.detected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-6 p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20"
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="font-bold text-white">Displacement Detected</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Direction</p>
              <p className={`font-bold capitalize ${
                data.displacement.direction === 'bullish' ? 'text-green-400' : 'text-red-400'
              }`}>
                {data.displacement.direction || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Magnitude</p>
              <p className="font-mono text-white">{formatPrice(data.displacement.magnitude)}x ATR</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Power of 3 */}
      {data.powerOf3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-6 p-4 rounded-xl bg-white/5"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔮</span>
            <span className="font-bold text-white">Power of 3 (AMD)</span>
          </div>
          <div className="flex items-center gap-4">
            {['Accumulation', 'Manipulation', 'Distribution'].map((phase) => (
              <div
                key={phase}
                className={`flex-1 p-2 rounded-lg text-center ${
                  data.powerOf3?.phase === phase.toLowerCase()
                    ? 'bg-violet-500/30 border border-violet-500/50'
                    : 'bg-white/5'
                }`}
              >
                <p className="text-xs text-gray-400">{phase}</p>
                {data.powerOf3?.phase === phase.toLowerCase() && (
                  <p className="text-sm text-violet-300 mt-1">Active</p>
                )}
              </div>
            ))}
          </div>
          {(data.powerOf3.asianLow !== undefined || data.powerOf3.asianHigh !== undefined) && (
            <div className="mt-3 text-sm text-gray-400">
              <p>Asian Range: ${formatPrice(data.powerOf3.asianLow)} - ${formatPrice(data.powerOf3.asianHigh)}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Trade Levels */}
      {isValidSignal && (data.entry || data.stopLoss || data.takeProfit) && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-violet-500/10 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Entry</p>
            <p className="font-mono text-white">${formatPrice(data.entry)}</p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Stop Loss</p>
            <p className="font-mono text-red-400">${formatPrice(data.stopLoss)}</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">TP1</p>
            <p className="font-mono text-green-400">${formatPrice(data.takeProfit1 || data.takeProfit)}</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">R:R</p>
            <p className="font-mono text-green-400">{formatPrice(data.riskRewardRatio, 1)}:1</p>
          </div>
        </div>
      )}

      {/* Confidence */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Strategy Confidence</span>
          <span className="text-sm font-bold text-white">{data.confidence || 0}%</span>
        </div>
        <div className="h-3 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${data.confidence || 0}%` }}
            transition={{ duration: 1, delay: 0.6 }}
            className={`h-full rounded-full ${
              (data.confidence || 0) >= 70 ? 'bg-gradient-to-r from-green-500 to-green-400' :
              (data.confidence || 0) >= 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
              'bg-gradient-to-r from-red-500 to-red-400'
            }`}
          />
        </div>
      </div>

      {/* Reasoning */}
      {data.reasoning && data.reasoning.length > 0 && (
        <div className="mt-6 p-4 bg-white/5 rounded-xl">
          <h4 className="text-sm font-bold text-gray-300 mb-2">Analysis Notes</h4>
          <ul className="space-y-2">
            {data.reasoning.map((reason, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + idx * 0.1 }}
                className="text-sm text-gray-400 flex items-start gap-2"
              >
                <span className="text-violet-400 mt-1">•</span>
                {reason}
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
