'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Target, Shield, Award } from 'lucide-react';

interface SignalCardProps {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  price?: number;
  priceChange?: number;
  reasoning?: string[];
  onClick?: () => void;
  delay?: number;
}

// Helper function to safely format numbers
const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return value.toLocaleString();
};

export default function SignalCard({
  symbol,
  signal = 'HOLD',
  confidence = 0,
  entry = 0,
  stopLoss = 0,
  takeProfit = 0,
  price,
  priceChange,
  reasoning,
  onClick,
  delay = 0,
}: SignalCardProps) {
  const signalColors = {
    BUY: {
      bg: 'from-green-500/20 to-green-600/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      glow: 'shadow-green-500/20',
    },
    SELL: {
      bg: 'from-red-500/20 to-red-600/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      glow: 'shadow-red-500/20',
    },
    HOLD: {
      bg: 'from-yellow-500/20 to-yellow-600/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      glow: 'shadow-yellow-500/20',
    },
  };

  const colors = signalColors[signal] || signalColors.HOLD;

  const SignalIcon = signal === 'BUY' ? TrendingUp : signal === 'SELL' ? TrendingDown : Minus;

  const getConfidenceColor = (conf: number) => {
    if (conf >= 70) return 'from-green-500 to-green-400';
    if (conf >= 50) return 'from-yellow-500 to-yellow-400';
    return 'from-red-500 to-red-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.02, y: -4 }}
      onClick={onClick}
      className={`glass-card p-5 cursor-pointer transition-all duration-300 hover:shadow-lg ${colors.glow}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{symbol}/USDT</h3>
          {price !== undefined && price !== null && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-mono text-gray-300">
                ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {priceChange !== undefined && priceChange !== null && (
                <span className={`text-sm ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Signal Badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: delay + 0.2 }}
          className={`px-4 py-2 rounded-xl bg-gradient-to-r ${colors.bg} ${colors.border} border flex items-center gap-2`}
        >
          <SignalIcon className={`w-5 h-5 ${colors.text}`} />
          <span className={`font-bold ${colors.text}`}>{signal}</span>
        </motion.div>
      </div>

      {/* Confidence Meter */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400 flex items-center gap-1">
            <Award className="w-4 h-4" />
            Confidence
          </span>
          <span className={`text-sm font-bold ${colors.text}`}>{confidence || 0}%</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confidence || 0}%` }}
            transition={{ duration: 0.8, delay: delay + 0.3 }}
            className={`h-full bg-gradient-to-r ${getConfidenceColor(confidence || 0)} rounded-full`}
          />
        </div>
      </div>

      {/* Trading Levels */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <Target className="w-3 h-3" />
            Entry
          </div>
          <span className="text-sm font-mono text-white">${formatNumber(entry)}</span>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center gap-1 text-xs text-red-400/70 mb-1">
            <Shield className="w-3 h-3" />
            Stop Loss
          </div>
          <span className="text-sm font-mono text-red-400">${formatNumber(stopLoss)}</span>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center gap-1 text-xs text-green-400/70 mb-1">
            <Target className="w-3 h-3" />
            Take Profit
          </div>
          <span className="text-sm font-mono text-green-400">${formatNumber(takeProfit)}</span>
        </div>
      </div>

      {/* Reasoning */}
      {reasoning && reasoning.length > 0 && (
        <div className="border-t border-white/5 pt-3">
          <ul className="space-y-1">
            {reasoning.slice(0, 2).map((reason, index) => (
              <li key={index} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-violet-400 mt-0.5">•</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
