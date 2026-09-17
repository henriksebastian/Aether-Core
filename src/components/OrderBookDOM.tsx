import React, { useState } from 'react';
import { OrderBookL2, MarketTick } from '../types/market';
import { L3SimulationState } from '../ingestion/synthetic_l3';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { getInstrument } from '../data/market_directory';

interface OrderBookDOMProps {
  symbol?: string;
  orderBook: OrderBookL2 | null;
  recentTrades: MarketTick[];
  microPrice: number;
  queuePriority: number;
  l3State: L3SimulationState | null;
  activePersona: string;
}

export const OrderBookDOM: React.FC<OrderBookDOMProps> = ({
  symbol,
  orderBook,
  recentTrades,
  microPrice,
  queuePriority,
  l3State,
  activePersona,
}) => {
  const [tickSize, setTickSize] = useState<'0.5' | '1.0' | '5.0'>('0.5');

  const inst = getInstrument(symbol || orderBook?.symbol || 'BTCUSDT');

  if (!orderBook) {
    return (
      <div className="w-80 h-full border-l border-[#1b2232] bg-[#090e18] p-4 flex items-center justify-center text-[11px] font-mono text-[#64748b]">
        Syncing Market Depth for {inst.symbol}...
      </div>
    );
  }

  const { bids, asks, spread, midPrice } = orderBook;
  const maxAskQty = Math.max(...asks.slice(0, 8).map((a) => a.quantity), 1);
  const maxBidQty = Math.max(...bids.slice(0, 8).map((b) => b.quantity), 1);

  // Cumulative ask volume
  let cumAsk = 0;
  const asksWithCum = asks.slice(0, 8).map((a) => {
    cumAsk += a.quantity;
    return { ...a, cum: cumAsk };
  });

  // Cumulative bid volume
  let cumBid = 0;
  const bidsWithCum = bids.slice(0, 8).map((b) => {
    cumBid += b.quantity;
    return { ...b, cum: cumBid };
  });

  const totalBidVol = bidsWithCum.reduce((acc, b) => acc + b.quantity, 0);
  const totalAskVol = asksWithCum.reduce((acc, a) => acc + a.quantity, 0);
  const bidRatio = totalBidVol + totalAskVol > 0 ? (totalBidVol / (totalBidVol + totalAskVol)) * 100 : 50;

  const qtyDecimals = inst.lotSize < 1 ? 3 : 1;

  return (
    <div className="w-80 h-full border-l border-[#1b2232] bg-[#090e18] flex flex-col select-none font-mono text-[11px] shrink-0">
      {/* 1. Header Toolbar */}
      <div className="h-7 border-b border-[#1b2232] bg-[#0e131d] px-2.5 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[#dee2f1]">{inst.exchange} L2 DOM</span>
          <span className="text-[#64748b]">Prio: {(queuePriority * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1">
          {(['0.5', '1.0', '5.0'] as const).map((sz) => (
            <button
              key={sz}
              onClick={() => setTickSize(sz)}
              className={`px-1.5 py-0.2 border text-[9px] transition-colors ${
                tickSize === sz
                  ? 'bg-[#1b202a] text-[#dee2f1] border-[#06b6d4]'
                  : 'text-[#64748b] border-[#1b2232] hover:text-[#94a3b8]'
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Column Headers */}
      <div className="grid grid-cols-3 h-5 bg-[#0e131d] border-b border-[#1b2232] px-2 text-[9px] text-[#64748b] items-center">
        <div>PRICE ({inst.currency})</div>
        <div className="text-right">SIZE ({inst.baseAsset})</div>
        <div className="text-right">TOTAL (CUM)</div>
      </div>

      {/* 3. L2 DOM Asks Ladder (Red) */}
      <div className="flex-1 flex flex-col justify-end overflow-hidden divide-y divide-[#1b2232]/20">
        {asksWithCum.reverse().map((level, idx) => {
          const depthPct = (level.quantity / maxAskQty) * 100;
          return (
            <div
              key={`ask-${idx}`}
              className="relative grid grid-cols-3 px-2 py-0.5 items-center hover:bg-[#141a26] transition-colors"
            >
              <div
                className="absolute inset-y-0 right-0 bg-[#f23645]/15 pointer-events-none"
                style={{ width: `${depthPct}%` }}
              />
              <span className="relative z-10 text-[#f23645] font-medium">{level.price.toFixed(inst.decimals)}</span>
              <span className="relative z-10 text-right text-[#dee2f1]">{level.quantity.toFixed(qtyDecimals)}</span>
              <span className="relative z-10 text-right text-[#64748b]">{level.cum.toFixed(qtyDecimals)}</span>
            </div>
          );
        })}
      </div>

      {/* 4. Pinned Spread & Equilibrium Bar */}
      <div className="py-1 px-2.5 bg-[#0e131d] border-y border-[#1b2232] flex flex-col gap-1 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-[#64748b]">
            SPREAD: <strong className="text-[#089981]">{inst.currencySymbol}{spread.toFixed(inst.decimals)}</strong>
          </span>
          <span className="text-[#dee2f1] font-bold">{inst.currencySymbol}{midPrice.toFixed(inst.decimals)}</span>
          <span className="text-[#06b6d4]">µP: {microPrice.toFixed(inst.decimals)}</span>
        </div>
        <div className="flex items-center justify-between text-[9px] text-[#64748b]">
          <span>IMBALANCE: {bidRatio.toFixed(1)}% BID</span>
          <span>{(100 - bidRatio).toFixed(1)}% ASK</span>
        </div>
        <div className="h-1 bg-[#1b2232] overflow-hidden flex">
          <div
            className="bg-[#089981] transition-all duration-150"
            style={{ width: `${bidRatio}%` }}
          />
          <div
            className="bg-[#f23645] transition-all duration-150"
            style={{ width: `${100 - bidRatio}%` }}
          />
        </div>
      </div>

      {/* 5. L2 DOM Bids Ladder (Green) */}
      <div className="flex-1 flex flex-col overflow-hidden divide-y divide-[#1b2232]/20">
        {bidsWithCum.map((level, idx) => {
          const depthPct = (level.quantity / maxBidQty) * 100;
          return (
            <div
              key={`bid-${idx}`}
              className="relative grid grid-cols-3 px-2 py-0.5 items-center hover:bg-[#141a26] transition-colors"
            >
              <div
                className="absolute inset-y-0 right-0 bg-[#089981]/15 pointer-events-none"
                style={{ width: `${depthPct}%` }}
              />
              <span className="relative z-10 text-[#089981] font-medium">{level.price.toFixed(inst.decimals)}</span>
              <span className="relative z-10 text-right text-[#dee2f1]">{level.quantity.toFixed(qtyDecimals)}</span>
              <span className="relative z-10 text-right text-[#64748b]">{level.cum.toFixed(qtyDecimals)}</span>
            </div>
          );
        })}
      </div>

      {/* 6. Live Time & Sales Recent Trades Tape */}
      <div className="h-32 border-t border-[#1b2232] flex flex-col bg-[#070b12]">
        <div className="h-5 bg-[#0e131d] px-2 flex items-center justify-between text-[9px] text-[#64748b] border-b border-[#1b2232]">
          <span>RECENT TRADES TAPE</span>
          <span>{recentTrades.length} TICKS</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[#1b2232]/10 text-[10px]">
          {recentTrades.slice(0, 15).map((t, idx) => {
            const isBuy = t.side === 'buy';
            const timeStr = new Date(t.timestamp).toTimeString().split(' ')[0];
            const isWhale = t.quantity >= inst.lotSize * 3.0;

            return (
              <div
                key={`trade-${idx}-${t.timestamp}`}
                className={`grid grid-cols-4 px-2 py-0.5 items-center ${
                  isWhale ? 'bg-[#06b6d4]/10 font-bold' : 'hover:bg-[#141a26]'
                }`}
              >
                <span className="text-[#64748b] text-[9px]">{timeStr}</span>
                <span className={`text-right ${isBuy ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                  {t.price.toFixed(inst.decimals)}
                </span>
                <span className="text-right text-[#dee2f1]">{t.quantity.toFixed(qtyDecimals)}</span>
                <div className="text-right">
                  <span
                    className={`px-1 py-0.2 text-[8px] font-bold ${
                      isBuy ? 'bg-[#089981]/20 text-[#089981]' : 'bg-[#f23645]/20 text-[#f23645]'
                    }`}
                  >
                    {isBuy ? 'BUY' : 'SELL'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. Bottom Simulated L3 Queue & Spoofing Monitor Strip */}
      <div className="p-2 border-t border-[#1b2232] bg-[#090e18] flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5">
          {(l3State?.spoofingRiskIndex ?? 0.12) > 0.5 ? (
            <AlertTriangle className="w-3.5 h-3.5 text-[#f23645] animate-pulse" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-[#089981]" />
          )}
          <span className="text-[#64748b]">SPOOF RISK:</span>
          <span
            className={`font-bold ${
              (l3State?.spoofingRiskIndex ?? 0.12) > 0.5 ? 'text-[#f23645]' : 'text-[#089981]'
            }`}
          >
            {((l3State?.spoofingRiskIndex ?? 0.12) * 100).toFixed(0)}%
          </span>
        </div>
        <span className="text-[#64748b] text-[9px]">L3 QUEUE: {l3State?.simulatedQueueDepth ?? 24} ORDERS</span>
      </div>
    </div>
  );
};
