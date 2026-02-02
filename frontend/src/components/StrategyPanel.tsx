'use client';

import { motion } from 'framer-motion';
import { StrategyResult } from '@/lib/api';
import {
  TrendingUp, TrendingDown, Target, Shield, Award, BarChart2,
  DollarSign, Activity, Newspaper, Layers
} from 'lucide-react';

interface StrategyPanelProps {
  data: StrategyResult;
}

// Helper functions for safe number formatting
const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return value.toLocaleString();
};

const formatFixed = (value: number | undefined | null, decimals: number = 0): string => {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return value.toFixed(decimals);
};

export default function StrategyPanel({ data }: StrategyPanelProps) {
  if (!data) return null;

  const scores = data.scores || { technical: 50, smc: 50, volumeWhale: 50, news: 50, mtfAlignment: 50 };
  const overallScore = data.overallScore || 50;

  const ScoreBar = ({ label, score, icon: Icon, color }: {
    label: string;
    score: number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }) => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400 flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {label}
        </span>
        <span className="text-sm font-bold text-white">{formatFixed(score)}/100</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score || 0}%` }}
          transition={{ duration: 0.8 }}
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
        />
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">{data.symbol || 'Unknown'}/USDT</h2>
          <p className="text-gray-400">{data.direction || 'NEUTRAL'} Strategy Analysis</p>
        </div>

        {/* Signal Badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring' }}
          className={`px-6 py-3 rounded-2xl flex flex-col items-center ${
            data.signal === 'BUY'
              ? 'bg-gradient-to-br from-green-500/30 to-green-600/10 border border-green-500/40'
              : data.signal === 'SELL'
              ? 'bg-gradient-to-br from-red-500/30 to-red-600/10 border border-red-500/40'
              : 'bg-gradient-to-br from-yellow-500/30 to-yellow-600/10 border border-yellow-500/40'
          }`}
        >
          {data.signal === 'BUY' ? (
            <TrendingUp className="w-8 h-8 text-green-400 mb-1" />
          ) : data.signal === 'SELL' ? (
            <TrendingDown className="w-8 h-8 text-red-400 mb-1" />
          ) : (
            <Activity className="w-8 h-8 text-yellow-400 mb-1" />
          )}
          <span className={`text-2xl font-bold ${
            data.signal === 'BUY' ? 'text-green-400' :
            data.signal === 'SELL' ? 'text-red-400' :
            'text-yellow-400'
          }`}>
            {data.signal || 'HOLD'}
          </span>
        </motion.div>
      </div>

      {/* Overall Score */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-violet-400" />
            Overall Score
          </span>
          <span className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            {formatFixed(overallScore)}/100
          </span>
        </div>
        <div className="h-4 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallScore}%` }}
            transition={{ duration: 1 }}
            className={`h-full rounded-full ${
              overallScore >= 70
                ? 'bg-gradient-to-r from-green-500 via-green-400 to-emerald-400'
                : overallScore >= 50
                ? 'bg-gradient-to-r from-yellow-500 via-yellow-400 to-orange-400'
                : 'bg-gradient-to-r from-red-500 via-red-400 to-pink-400'
            }`}
            style={{
              boxShadow: overallScore >= 70
                ? '0 0 20px rgba(34, 197, 94, 0.5)'
                : overallScore >= 50
                ? '0 0 20px rgba(234, 179, 8, 0.5)'
                : '0 0 20px rgba(239, 68, 68, 0.5)',
            }}
          />
        </div>
      </div>

      {/* Individual Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <ScoreBar
          label="Technical Analysis"
          score={scores.technical || 0}
          icon={BarChart2}
          color="from-blue-500 to-cyan-400"
        />
        <ScoreBar
          label="Smart Money (SMC)"
          score={scores.smc || 0}
          icon={Activity}
          color="from-violet-500 to-purple-400"
        />
        <ScoreBar
          label="Volume & Whale"
          score={scores.volumeWhale || 0}
          icon={DollarSign}
          color="from-green-500 to-emerald-400"
        />
        <ScoreBar
          label="News Sentiment"
          score={scores.news || 0}
          icon={Newspaper}
          color="from-orange-500 to-yellow-400"
        />
        <ScoreBar
          label="Multi-Timeframe"
          score={scores.mtfAlignment || 0}
          icon={Layers}
          color="from-pink-500 to-rose-400"
        />
      </div>

      {/* Trade Setup */}
      <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-violet-400" />
          Trade Setup
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Entry Price</p>
            <p className="text-lg font-mono font-bold text-white">${formatNumber(data.entry)}</p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3">
            <p className="text-xs text-red-400/70 mb-1 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Stop Loss
            </p>
            <p className="text-lg font-mono font-bold text-red-400">${formatNumber(data.stopLoss)}</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3">
            <p className="text-xs text-green-400/70 mb-1">Take Profit 1</p>
            <p className="text-lg font-mono font-bold text-green-400">${formatNumber(data.takeProfit1)}</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3">
            <p className="text-xs text-green-400/70 mb-1">Take Profit 2</p>
            <p className="text-lg font-mono font-bold text-green-400">${formatNumber(data.takeProfit2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Risk/Reward</p>
            <p className="text-xl font-bold text-white">{formatFixed(data.riskReward, 1)}:1</p>
          </div>
          <div className="text-center p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Leverage</p>
            <p className="text-xl font-bold text-violet-400">{data.recommendedLeverage || 1}x</p>
          </div>
          <div className="text-center p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Position Size</p>
            <p className="text-xl font-bold text-cyan-400">{data.positionSize || 0}%</p>
          </div>
        </div>
      </div>

      {/* Reasoning */}
      {data.reasoning && data.reasoning.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-bold text-gray-300 mb-3">Analysis Breakdown</h4>
          <ul className="space-y-2">
            {data.reasoning.map((reason, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="text-sm text-gray-400 flex items-start gap-2 p-2 bg-white/5 rounded-lg"
              >
                <span className="text-violet-400 mt-0.5">
                  {idx < 3 ? '✓' : '•'}
                </span>
                {reason}
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
