import React, { useEffect, useState } from 'react';
import { TelemetryMetrics, TraderPersona } from '../types/market';
import { ShieldAlert, Layers, PlayCircle, Radio, Zap, Sparkles, Eye } from 'lucide-react';
import {
  fetchBinance24hTicker,
  fetchBinanceFundingRate,
  formatVolumeUSD,
  Binance24hTicker,
  BinanceFundingRate,
} from '../ingestion/binance_rest';
import { LiveStrategyEvaluationState } from '../strategy_compiler/strategy_evaluator';

interface HeaderProps {
  telemetry: TelemetryMetrics;
  connectionStatus: string;
  latencyMs: number;
  symbol: string;
  onSymbolChange: (s: string) => void;
  onPersonaSelect: (p: TraderPersona) => void;
  onOpenStrategyCompiler: () => void;
  onOpenReplayDock: () => void;
  isReplayOpen: boolean;
  liveStrategyState?: LiveStrategyEvaluationState | null;
  isCleanMode?: boolean;
  onToggleCleanMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  connectionStatus,
  latencyMs,
  symbol,
  onSymbolChange,
  onPersonaSelect,
  onOpenStrategyCompiler,
  onOpenReplayDock,
  isReplayOpen,
  liveStrategyState,
  isCleanMode = false,
  onToggleCleanMode,
}) => {
  const [ticker, setTicker] = useState<Binance24hTicker | null>(null);
  const [funding, setFunding] = useState<BinanceFundingRate | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const [tData, fData] = await Promise.all([
        fetchBinance24hTicker(symbol),
        fetchBinanceFundingRate(symbol),
      ]);
      if (isMounted) {
        if (tData) setTicker(tData);
        if (fData) setFunding(fData);
      }
    };

    loadData();
    const interval = setInterval(loadData, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  return (
    <header className="h-9 border-b border-[#1b2232] bg-[#0e131d] px-3 flex items-center justify-between z-30 select-none font-mono text-[11px]">
      {/* 1. Brand & Instrument Selector */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs tracking-wider text-[#089981]">
            AETHER<span className="text-[#dee2f1]">//QUANT</span>
          </span>
          <span className="text-[8px] px-1 bg-[#1b202a] text-[#64748b] border border-[#1b2232] font-semibold">
            v4.2
          </span>
        </div>

        <div className="h-3.5 w-px bg-[#1b2232]" />

        {/* Pair selector */}
        <div className="flex items-center bg-[#090e18] border border-[#1b2232]">
          {['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map((pair) => (
            <button
              key={pair}
              onClick={() => onSymbolChange(pair)}
              className={`px-2 py-0.5 text-[10px] font-bold transition-colors ${
                symbol === pair
                  ? 'bg-[#1b202a] text-[#089981] border-b border-[#089981]'
                  : 'text-[#94a3b8] hover:text-[#dee2f1]'
              }`}
            >
              {pair.replace('USDT', '/USDT')}
            </button>
          ))}
        </div>

        {/* Live Ticker Stats */}
        {!isCleanMode && (
          <div className="hidden xl:flex items-center gap-3 text-[10px] border-l border-[#1b2232] pl-2.5">
            <div>
              <span className="text-[#64748b]">24H H:</span>{' '}
              <span className="text-[#dee2f1]">
                {ticker ? `$${ticker.highPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...'}
              </span>
            </div>
            <div>
              <span className="text-[#64748b]">24H L:</span>{' '}
              <span className="text-[#dee2f1]">
                {ticker ? `$${ticker.lowPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...'}
              </span>
            </div>
            <div>
              <span className="text-[#64748b]">24H CHG:</span>{' '}
              <span className={ticker && ticker.priceChangePercent >= 0 ? 'text-[#089981] font-bold' : 'text-[#f23645] font-bold'}>
                {ticker ? `${ticker.priceChangePercent >= 0 ? '+' : ''}${ticker.priceChangePercent.toFixed(2)}%` : '...'}
              </span>
            </div>
            <div>
              <span className="text-[#64748b]">24H VOL:</span>{' '}
              <span className="text-[#06b6d4] font-bold">
                {ticker ? formatVolumeUSD(ticker.quoteVolume) : '...'}
              </span>
            </div>
            <div>
              <span className="text-[#64748b]">FUNDING:</span>{' '}
              <span className={funding && funding.fundingRate >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}>
                {funding ? `${funding.fundingRate >= 0 ? '+' : ''}${(funding.fundingRate * 100).toFixed(4)}%` : '+0.0100%'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Live Compiled Strategy Pill & Behavioral Persona */}
      <div className="hidden md:flex items-center gap-2 text-[10px]">
        {/* Live Strategy Compiler Active Badge */}
        <button
          onClick={onOpenStrategyCompiler}
          className={`flex items-center gap-1.5 px-2 py-0.5 border rounded-sm transition-all ${
            liveStrategyState?.isAllConditionsMet
              ? 'bg-[#089981]/25 border-[#089981] text-[#089981] shadow-md shadow-[#089981]/20'
              : 'bg-[#090e18] border-[#1b2232] text-[#06b6d4] hover:border-[#06b6d4]/50'
          }`}
          title="Click to inspect Live C++20 / zk-SNARK Strategy Graph"
        >
          <span className={`w-2 h-2 rounded-full ${liveStrategyState?.isAllConditionsMet ? 'bg-[#089981] animate-ping' : 'bg-[#06b6d4] animate-pulse'}`} />
          <span className="font-extrabold tracking-wide text-[9px]">
            {liveStrategyState?.isAllConditionsMet ? '⚡ STRAT: FIRING (IOC BUY)' : '⚡ STRAT: LIVE [C++20 HFT]'}
          </span>
          {liveStrategyState && (
            <span className="text-[8px] bg-[#141a26] px-1 text-[#dee2f1] border border-[#1b2232]">
              {liveStrategyState.executionCount} execs
            </span>
          )}
        </button>

        {!isCleanMode && (
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-[#94a3b8] bg-[#090e18] px-2 py-0.5 border border-[#1b2232]">
            <div className="flex items-center gap-1">
              <span className="text-[#64748b] uppercase">PERSONA:</span>
              <span className="text-[#06b6d4] font-bold">{telemetry.activePersona}</span>
            </div>

            <div className="h-3 w-px bg-[#1b2232]" />

            {/* Persona Switchers */}
            <div className="flex items-center gap-1">
              {(['Micro-Scalper', 'Intraday Momentum', 'Positional Quant'] as TraderPersona[]).map((p, idx) => (
                <button
                  key={p}
                  onClick={() => onPersonaSelect(p)}
                  title={`Switch to ${p}`}
                  className={`px-1 py-0.2 text-[8px] border transition-colors ${
                    telemetry.activePersona === p
                      ? 'bg-[#1b202a] text-[#089981] border-[#089981]'
                      : 'text-[#64748b] border-[#1b2232] hover:text-[#dee2f1]'
                  }`}
                >
                  {idx + 1}:{p.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Action Controls */}
      <div className="flex items-center gap-1.5">
        {/* Unclutter / Zen Mode Toggle */}
        {onToggleCleanMode && (
          <button
            onClick={onToggleCleanMode}
            className={`px-2 py-1 text-[10px] font-bold flex items-center gap-1 border transition-colors ${
              isCleanMode
                ? 'bg-[#06b6d4]/20 text-[#06b6d4] border-[#06b6d4]'
                : 'bg-[#090e18] text-[#94a3b8] border-[#1b2232] hover:text-[#dee2f1]'
            }`}
            title={isCleanMode ? 'Exit Clean Mode' : 'Unclutter Website (Zen Focus Mode)'}
          >
            <Sparkles className="w-3 h-3" />
            <span>{isCleanMode ? 'CLEAN: ON' : 'UNCLUTTER'}</span>
          </button>
        )}

        <button
          onClick={onOpenReplayDock}
          className={`px-2 py-1 text-[10px] font-bold flex items-center gap-1 border transition-colors ${
            isReplayOpen
              ? 'bg-[#1b202a] text-[#06b6d4] border-[#06b6d4]'
              : 'bg-[#090e18] text-[#94a3b8] border-[#1b2232] hover:text-[#dee2f1] hover:border-[#242c40]'
          }`}
        >
          <PlayCircle className="w-3 h-3" />
          <span>DUCKDB</span>
        </button>

        <button
          onClick={onOpenStrategyCompiler}
          className="px-2 py-1 text-[10px] font-bold flex items-center gap-1 bg-[#089981]/15 text-[#089981] border border-[#089981]/50 hover:bg-[#089981]/30 transition-colors"
        >
          <Layers className="w-3 h-3" />
          <span>STRATEGY GRAPH</span>
        </button>

        <button
          onClick={() => alert('[KILL SWITCH ENGAGED] All simulated active positions liquidating immediately.')}
          className="px-2 py-1 text-[10px] font-bold bg-[#f23645]/15 text-[#f23645] border border-[#f23645]/50 hover:bg-[#f23645]/30 transition-colors"
        >
          KILL
        </button>

        {/* Connection & Latency */}
        <div className="flex items-center gap-1 pl-1.5 text-[10px] border-l border-[#1b2232]">
          <Radio className={`w-3 h-3 ${connectionStatus === 'connected' ? 'text-[#089981] animate-pulse' : 'text-[#f59e0b]'}`} />
          <span className="text-[#64748b]">{latencyMs > 0 ? `${latencyMs}ms` : connectionStatus}</span>
        </div>
      </div>
    </header>
  );
};
