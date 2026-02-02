'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickData, Time, IChartApi, ISeriesApi } from 'lightweight-charts';
import { motion } from 'framer-motion';
import { OHLCV } from '@/lib/api';

interface TradingChartProps {
  data: OHLCV[];
  symbol: string;
  orderBlocks?: Array<{
    type: 'bullish' | 'bearish';
    top: number;
    bottom: number;
  }>;
  fairValueGaps?: Array<{
    type: 'bullish' | 'bearish';
    top: number;
    bottom: number;
  }>;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export default function TradingChart({
  data,
  symbol,
  orderBlocks,
  entry,
  stopLoss,
  takeProfit,
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current || !data.length) return;

    setIsLoading(true);

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(100, 200, 255, 0.05)' },
        horzLines: { color: 'rgba(100, 200, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(124, 58, 237, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#7c3aed',
        },
        horzLine: {
          color: 'rgba(124, 58, 237, 0.5)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#7c3aed',
        },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: 'rgba(100, 200, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(100, 200, 255, 0.1)',
      },
    });

    chartRef.current = chart;

    // Add candlestick series - v4 API
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff4466',
      borderDownColor: '#ff4466',
      borderUpColor: '#00ff88',
      wickDownColor: '#ff4466',
      wickUpColor: '#00ff88',
    });

    seriesRef.current = candlestickSeries;

    // Format data for lightweight-charts
    const chartData: CandlestickData<Time>[] = data.map((candle) => ({
      time: (candle.timestamp / 1000) as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    candlestickSeries.setData(chartData);

    // Add price lines for entry, stop loss, take profit
    if (entry) {
      candlestickSeries.createPriceLine({
        price: entry,
        color: '#7c3aed',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Entry',
      });
    }

    if (stopLoss) {
      candlestickSeries.createPriceLine({
        price: stopLoss,
        color: '#ff4466',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'SL',
      });
    }

    if (takeProfit) {
      candlestickSeries.createPriceLine({
        price: takeProfit,
        color: '#00ff88',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'TP',
      });
    }

    // Fit content
    chart.timeScale().fitContent();
    setIsLoading(false);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, entry, stopLoss, takeProfit]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="glass-card p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">{symbol}/USDT Chart</h3>
        <div className="flex items-center gap-4 text-sm">
          {entry && (
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-violet-500 rounded" />
              <span className="text-gray-400">Entry</span>
            </span>
          )}
          {stopLoss && (
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-red-500 rounded" />
              <span className="text-gray-400">Stop Loss</span>
            </span>
          )}
          {takeProfit && (
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-green-500 rounded" />
              <span className="text-gray-400">Take Profit</span>
            </span>
          )}
        </div>
      </div>

      <div className="relative chart-container">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="spinner" />
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" />
      </div>

      {/* Order Blocks Legend */}
      {orderBlocks && orderBlocks.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {orderBlocks.slice(0, 4).map((ob, idx) => (
            <span
              key={idx}
              className={`text-xs px-2 py-1 rounded ${
                ob.type === 'bullish'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}
            >
              {ob.type === 'bullish' ? 'Bull' : 'Bear'} OB: ${ob.bottom.toFixed(2)} - ${ob.top.toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
