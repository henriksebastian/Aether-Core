import React from 'react';
import { OrderBookL2, PriceLevel } from '../types/market';
import { L3SimulationState } from '../ingestion/synthetic_l3';
import { AlertTriangle, Clock, ShieldCheck } from 'lucide-react';

interface OrderBookDOMProps {
  orderBook: OrderBookL2 | null;
  microPrice: number;
  queuePriority: number;
  l3State: L3SimulationState | null;
  activePersona: string;
}

export const OrderBookDOM: React.FC<OrderBookDOMProps> = ({
  orderBook,
  microPrice,
  queuePriority,
  l3State,
  activePersona,
}) => {
  if (!orderBook) {
    return (
      <div className="w-80 h-full border-l border-white/10 bg-[#06090e] p-4 flex items-center justify-center text-xs font-mono text-gray-500">
        Syncing Market Depth...
      </div>
    );
  }

  const { bids, asks, bestBid, bestAsk, spread, midPrice } = orderBook;
  const maxBidQty = Math.max(...bids.slice(0, 10).map((b) => b.quantity), 1);
  const maxAskQty = Math.max(...asks.slice(0, 10).map((a) => a.quantity), 1);

  // If Micro-Scalper, show maximum depth and simulated L3 queue details
  const isScalper = activePersona === 'Micro-Scalper';

  return (
    <div className="w-80 h-full border-l border-white/10 bg-[#06090e] flex flex-col font-mono text-[11px] select-none">
      {/* Ladder Header */}
      <div className="p-2.5 border-b border-white/10 bg-[#0b1018] flex items-center justify-between">
        <span className="font-display font-bold text-xs text-white">L2 DEPTH / L3 QUEUE</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">Prio:</span>
          <span className="text-cyan font-bold">{(queuePriority * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Queue Priority Progress Bar */}
      <div className="h-1 bg-black/50 w-full overflow-hidden">
        <div
          className="h-full bg-cyan transition-all duration-300"
          style={{ width: `${Math.round(queuePriority * 100)}%` }}
        />
      </div>

      {/* Asks (Red) */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end p-1">
        {asks
          .slice(0, isScalper ? 10 : 7)
          .reverse()
          .map((level, idx) => {
            const depthPct = (level.quantity / maxAskQty) * 100;
            return (
              <div
                key={`ask-${idx}`}
                className="relative flex items-center justify-between px-2 py-0.5 my-0.5 rounded overflow-hidden"
              >
                <div
                  className="absolute right-0 top-0 bottom-0 depth-bar-ask"
                  style={{ width: `${depthPct}%` }}
                />
                <span className="relative z-10 text-rose font-medium">{level.price.toFixed(2)}</span>
                <span className="relative z-10 text-gray-400">{level.quantity.toFixed(3)}</span>
              </div>
            );
          })}
      </div>

      {/* Spread & Micro-Price Equilibrium Bar */}
      <div className="px-3 py-2 bg-[#0b1018] border-y border-white/10 flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">SPREAD:</span>
          <span className="text-white font-bold">{spread.toFixed(2)}</span>
          <span className="text-[10px] text-cyan">µP: {microPrice.toFixed(2)}</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden flex">
          <div
            className="bg-green transition-all"
            style={{ width: `${Math.min(90, Math.max(10, ((microPrice - bestBid) / spread) * 100))}%` }}
          />
          <div className="flex-1 bg-rose" />
        </div>
      </div>

      {/* Bids (Green) */}
      <div className="flex-1 overflow-hidden p-1">
        {bids.slice(0, isScalper ? 10 : 7).map((level, idx) => {
          const depthPct = (level.quantity / maxBidQty) * 100;
          return (
            <div
              key={`bid-${idx}`}
              className="relative flex items-center justify-between px-2 py-0.5 my-0.5 rounded overflow-hidden"
            >
              <div
                className="absolute right-0 top-0 bottom-0 depth-bar-bid"
                style={{ width: `${depthPct}%` }}
              />
              <span className="relative z-10 text-green font-medium">{level.price.toFixed(2)}</span>
              <span className="relative z-10 text-gray-400">{level.quantity.toFixed(3)}</span>
            </div>
          );
        })}
      </div>

      {/* Simulated L3 Order Queue & Spoofing Monitor */}
      <div className="p-2.5 border-t border-white/10 bg-[#080d14] flex flex-col gap-1.5 text-[10px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-amber">
            <Clock className="w-3 h-3" />
            <span className="font-bold">Simulated L3 Queue</span>
          </div>
          <span className="text-gray-400">{l3State?.simulatedQueueDepth ?? 24} orders</span>
        </div>

        <div className="flex items-center justify-between bg-black/40 p-1.5 rounded border border-white/5">
          <span className="text-gray-400">Spoofing Risk:</span>
          <div className="flex items-center gap-1">
            {(l3State?.spoofingRiskIndex ?? 0.12) > 0.5 ? (
              <AlertTriangle className="w-3 h-3 text-rose animate-pulse" />
            ) : (
              <ShieldCheck className="w-3 h-3 text-green" />
            )}
            <span
              className={`font-bold ${
                (l3State?.spoofingRiskIndex ?? 0.12) > 0.5 ? 'text-rose' : 'text-green'
              }`}
            >
              {((l3State?.spoofingRiskIndex ?? 0.12) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
