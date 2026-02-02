'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Star, TrendingUp } from 'lucide-react';
import { POPULAR_SYMBOLS } from '@/lib/api';

interface SymbolSelectorProps {
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  favorites?: string[];
  onToggleFavorite?: (symbol: string) => void;
}

export default function SymbolSelector({
  selectedSymbol,
  onSelect,
  favorites = [],
  onToggleFavorite,
}: SymbolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredSymbols = POPULAR_SYMBOLS.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (symbol: string) => {
    onSelect(symbol);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative">
      {/* Selected Symbol Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/50 transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <div className="text-left">
          <p className="text-lg font-bold text-white">{selectedSymbol}/USDT</p>
          <p className="text-xs text-gray-500">Click to change</p>
        </div>
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40"
            />

            {/* Dropdown Menu */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-full left-0 mt-2 w-72 z-50 glass-card p-4"
            >
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search symbols..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50"
                  autoFocus
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Favorites */}
              {favorites.length > 0 && !search && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Favorites</p>
                  <div className="flex flex-wrap gap-2">
                    {favorites.map((symbol) => (
                      <button
                        key={symbol}
                        onClick={() => handleSelect(symbol)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          selectedSymbol === symbol
                            ? 'bg-violet-500 text-white'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All Symbols */}
              <div className="max-h-60 overflow-y-auto">
                <p className="text-xs text-gray-500 mb-2">
                  {search ? `Results (${filteredSymbols.length})` : 'Popular Coins'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {filteredSymbols.map((symbol) => (
                    <motion.button
                      key={symbol}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSelect(symbol)}
                      className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedSymbol === symbol
                          ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {symbol}
                      {onToggleFavorite && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(symbol);
                          }}
                          className="absolute -top-1 -right-1 p-0.5"
                        >
                          <Star
                            className={`w-3 h-3 ${
                              favorites.includes(symbol)
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-500'
                            }`}
                          />
                        </button>
                      )}
                    </motion.button>
                  ))}
                </div>

                {filteredSymbols.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No symbols found</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
