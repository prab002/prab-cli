'use client';

import { motion } from 'framer-motion';
import { Activity, TrendingUp, Wallet, Newspaper, BarChart3 } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'signals', label: 'Signals', icon: TrendingUp },
  { id: 'ict', label: 'ICT Strategy', icon: Activity },
  { id: 'whale', label: 'Whale Watch', icon: Wallet },
  { id: 'news', label: 'News', icon: Newspaper },
];

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0a0a0f] animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                CryptoTrader Pro
              </h1>
              <p className="text-xs text-gray-500">Smart Money Analysis</p>
            </div>
          </motion.div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl">
            {tabs.map((tab, index) => (
              <motion.button
                key={tab.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onTabChange(tab.id)}
                className={`relative px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200
                  ${activeTab === tab.id
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-200'
                  }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-violet-600/30 to-cyan-600/30 rounded-lg"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <tab.icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </motion.button>
            ))}
          </nav>

          {/* Status */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-sm"
          >
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-400">Live</span>
          </motion.div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex items-center gap-1 mt-4 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm whitespace-nowrap
                ${activeTab === tab.id
                  ? 'bg-violet-600/30 text-white'
                  : 'text-gray-400'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
