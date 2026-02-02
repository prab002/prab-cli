'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';

// Particles component that only renders on client
function FloatingParticles() {
  const [particles, setParticles] = useState<Array<{
    id: number;
    initialX: number;
    initialY: number;
    targetX: number;
    targetY: number;
    duration: number;
  }>>([]);

  useEffect(() => {
    // Generate particles only on client side
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      initialX: Math.random() * window.innerWidth,
      initialY: Math.random() * window.innerHeight,
      targetX: Math.random() * window.innerWidth,
      targetY: Math.random() * window.innerHeight,
      duration: Math.random() * 20 + 20,
    }));
    setParticles(newParticles);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ x: particle.initialX, y: particle.initialY }}
          animate={{ x: particle.targetX, y: particle.targetY }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'linear',
          }}
          className="absolute w-1 h-1 bg-violet-500/30 rounded-full"
          style={{
            filter: 'blur(1px)',
            boxShadow: '0 0 10px rgba(124, 58, 237, 0.5)',
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="min-h-screen">
      {/* Animated Gradient Background */}
      <div className="gradient-bg" />

      {/* Floating Particles Effect - Only render on client */}
      {mounted && <FloatingParticles />}

      {/* Content */}
      <div className="relative z-10">
        <Header activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="max-w-7xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Dashboard />
              </motion.div>
            )}

            {activeTab === 'signals' && (
              <motion.div
                key="signals"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <SignalsView />
              </motion.div>
            )}

            {activeTab === 'ict' && (
              <motion.div
                key="ict"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ICTView />
              </motion.div>
            )}

            {activeTab === 'whale' && (
              <motion.div
                key="whale"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <WhaleView />
              </motion.div>
            )}

            {activeTab === 'news' && (
              <motion.div
                key="news"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <NewsView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

// Signals View Component
function SignalsView() {
  return (
    <div className="glass-card p-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center"
      >
        <span className="text-4xl">📊</span>
      </motion.div>
      <h2 className="text-2xl font-bold text-white mb-2">Trading Signals</h2>
      <p className="text-gray-400">
        Multi-symbol signal scanner. All signals are available on the Dashboard with live data.
      </p>
    </div>
  );
}

// ICT View Component
function ICTView() {
  return (
    <div className="glass-card p-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center"
      >
        <span className="text-4xl">🎯</span>
      </motion.div>
      <h2 className="text-2xl font-bold text-white mb-2">ICT Strategy</h2>
      <p className="text-gray-400 mb-4">
        Inner Circle Trader methodology with Killzones, OTE, Breaker Blocks, and Power of 3.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {['Silver Bullet', 'OTE', 'Breaker Block', 'Displacement'].map((model, idx) => (
          <motion.div
            key={model}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-4 bg-white/5 rounded-xl"
          >
            <span className="text-2xl">
              {idx === 0 ? '🎯' : idx === 1 ? '📐' : idx === 2 ? '🧱' : '⚡'}
            </span>
            <p className="text-sm text-white font-medium mt-2">{model}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Whale View Component
function WhaleView() {
  return (
    <div className="glass-card p-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center"
      >
        <span className="text-4xl">🐋</span>
      </motion.div>
      <h2 className="text-2xl font-bold text-white mb-2">Whale Watch</h2>
      <p className="text-gray-400 mb-4">
        Track large cryptocurrency transactions and exchange flows.
      </p>
      <div className="grid grid-cols-3 gap-4 mt-6">
        {[
          { label: 'Exchange Inflows', icon: '📥', color: 'text-red-400' },
          { label: 'Exchange Outflows', icon: '📤', color: 'text-green-400' },
          { label: 'Large Transfers', icon: '💰', color: 'text-yellow-400' },
        ].map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-4 bg-white/5 rounded-xl"
          >
            <span className="text-2xl">{item.icon}</span>
            <p className={`text-sm font-medium mt-2 ${item.color}`}>{item.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// News View Component
function NewsView() {
  return (
    <div className="glass-card p-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-600 to-pink-600 flex items-center justify-center"
      >
        <span className="text-4xl">📰</span>
      </motion.div>
      <h2 className="text-2xl font-bold text-white mb-2">Crypto News</h2>
      <p className="text-gray-400 mb-4">
        Real-time cryptocurrency news with sentiment analysis.
      </p>
      <div className="flex justify-center gap-4 mt-6">
        {[
          { label: 'Positive', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
          { label: 'Neutral', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
          { label: 'Negative', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
        ].map((item, idx) => (
          <motion.span
            key={item.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className={`px-4 py-2 rounded-full border ${item.color}`}
          >
            {item.label}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
