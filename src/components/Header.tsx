import React, { useEffect, useState } from 'react';
import { TelemetryMetrics, TraderPersona } from '../types/market';
import { ShieldAlert, Layers, PlayCircle, Radio, Zap, Sparkles, Eye, Search, ChevronDown } from 'lucide-react';
import {
  fetchBinance24hTicker,
  fetchBinanceFundingRate,
  formatVolumeUSD,
  Binance24hTicker,
  BinanceFundingRate,
} from '../ingestion/binance_rest';
import { LiveStrategyEvaluationState } from '../strategy_compiler/strategy_evaluator';
import { getInstrument, formatInstrumentPrice, Exchange } from '../data/market_directory';
import { MarketDirectoryModal } from './MarketDirectoryModal';

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

const QUICK_FAVORITES = ['NVDA', 'AAPL', 'SPY', 'GOLD', 'EURUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

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
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);

  const inst = getInstrument(symbol);

  // Global hotkey: Ctrl+K or / opens market search modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsMarketModalOpen((prev) => !prev);
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsMarketModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

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

  // Exchange badge styling
  const badgeColors: Record<Exchange, string> = {
    NASDAQ: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60',
    NYSE: 'bg-blue-950/60 text-blue-400 border-blue-800/60',
    LSE: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
    EURONEXT: 'bg-purple-950/60 text-purple-400 border-purple-800/60',
    XETRA: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    TSE: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
    HKEX: 'bg-orange-950/60 text-orange-400 border-orange-800/60',
    NSE: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60',
    CME: 'bg-teal-950/60 text-teal-400 border-teal-800/60',
    FOREX: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    BINANCE: 'bg-yellow-950/60 text-yellow-400 border-yellow-800/60',
  };

  return (
    <>
      <header className="h-9 border-b border-[#1b2232] bg-[#0e131d] px-3 flex items-center justify-between z-30 select-none font-mono text-[11px]">
        {/* 1. Brand & Instrument Selector */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs tracking-wider text-[#089981]">
              AETHER<span className="text-[#dee2f1]">//QUANT</span>
            </span>
            <span className="text-[8px] px-1 bg-[#1b202a] text-[#64748b] border border-[#1b2232] font-semibold">
              v4.5
            </span>
          </div>

          <div className="h-3.5 w-px bg-[#1b2232]" />

          {/* Active Instrument Trigger */}
          <button
            onClick={() => setIsMarketModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-0.5 bg-[#090e18] hover:bg-[#141a26] border border-[#1b2232] hover:border-[#06b6d4] transition-colors group cursor-pointer"
            title="Search all stock markets & exchanges (Press Ctrl+K or /)"
          >
            <span className={`text-[8.5px] font-bold px-1 py-0.1 border ${badgeColors[inst.exchange] || 'text-[#06b6d4]'}`}>
              {inst.exchange}
            </span>
            <span className="font-bold text-[11px] text-[#dee2f1] group-hover:text-[#06b6d4] transition-colors">
              {inst.symbol}
            </span>
            <span className="text-[9.5px] text-[#64748b] hidden 2xl:inline truncate max-w-[100px]">
              {inst.name}
            </span>
            <div className="flex items-center gap-1 text-[#64748b] group-hover:text-[#06b6d4] pl-1 border-l border-[#1b2232]">
              <Search size={11} />
              <span className="text-[8.5px] hidden sm:inline text-[#475569] group-hover:text-[#94a3b8]">Ctrl+K</span>
            </div>
          </button>

          {/* Quick Instrument Preset Chips */}
          <div className="hidden lg:flex items-center bg-[#090e18] border border-[#1b2232]">
            {QUICK_FAVORITES.map((fav) => {
              const favInst = getInstrument(fav);
              const isSelected = symbol.toUpperCase() === fav.toUpperCase();
              return (
                <button
                  key={fav}
                  onClick={() => onSymbolChange(fav)}
                  className={`px-2 py-0.5 text-[9.5px] font-bold transition-colors ${
                    isSelected
                      ? 'bg-[#1b202a] text-[#089981] border-b border-[#089981]'
                      : 'text-[#94a3b8] hover:text-[#dee2f1] hover:bg-[#121824]'
                  }`}
                  title={`${favInst.name} (${favInst.exchange})`}
                >
                  {favInst.baseAsset || fav}
                </button>
              );
            })}
          </div>

          {/* Live Ticker Stats */}
          {!isCleanMode && (
            <div className="hidden xl:flex items-center gap-3 text-[10px] border-l border-[#1b2232] pl-2.5">
              <div>
                <span className="text-[#64748b]">24H H:</span>{' '}
                <span className="text-[#dee2f1]">
                  {ticker
                    ? formatInstrumentPrice(ticker.highPrice, inst)
                    : '...'}
                </span>
              </div>
              <div>
                <span className="text-[#64748b]">24H L:</span>{' '}
                <span className="text-[#dee2f1]">
                  {ticker
                    ? formatInstrumentPrice(ticker.lowPrice, inst)
                    : '...'}
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
                <span className="text-[#64748b]">{inst.isCrypto ? 'FUNDING:' : 'SETTLE:'}</span>{' '}
                <span className={funding && funding.fundingRate >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}>
                  {inst.isCrypto
                    ? (funding ? `${funding.fundingRate >= 0 ? '+' : ''}${(funding.fundingRate * 100).toFixed(4)}%` : '+0.0100%')
                    : (funding?.countdownFormatted || 'OPEN')}
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
            className={`flex items-center gap-1.5 px-2 py-0.5 border text-[9.5px] transition-colors ${
              liveStrategyState?.isAllConditionsMet
                ? 'bg-[#089981]/20 text-[#089981] border-[#089981] animate-pulse font-bold'
                : 'bg-[#1b202a] text-[#06b6d4] border-[#1b2232] hover:border-[#06b6d4]'
            }`}
            title="Live Strategy Compiler Active (Sub-microsecond HFT C++20 Pipeline)"
          >
            <Zap size={10} className={liveStrategyState?.isAllConditionsMet ? 'text-[#089981]' : 'text-[#06b6d4]'} />
            <span>
              {liveStrategyState?.isAllConditionsMet
                ? `⚡ STRAT: FIRING (${liveStrategyState.rule.action})`
                : '⚡ STRAT: LIVE [C++20 HFT]'}
            </span>
            {liveStrategyState && liveStrategyState.executionCount > 0 && (
              <span className="text-[8px] px-1 bg-[#090e18] text-[#dee2f1] border border-[#1b2232] font-semibold">
                x{liveStrategyState.executionCount}
              </span>
            )}
          </button>

          {/* Active Persona Badge */}
          <div className="flex items-center gap-1 text-[#64748b]">
            <span>PERSONA:</span>
            <select
              value={telemetry.activePersona}
              onChange={(e) => onPersonaSelect(e.target.value as TraderPersona)}
              aria-label="Trader Persona"
              className="bg-[#1b202a] text-[#dee2f1] border border-[#1b2232] px-1.5 py-0.5 rounded-none outline-none cursor-pointer hover:border-[#64748b] text-[10px]"
            >
              <option value="Micro-Scalper">Micro-Scalper</option>
              <option value="Orderflow-Trader">Orderflow-Trader</option>
              <option value="Execution-Algo">Execution-Algo</option>
              <option value="Arbitrageur">Arbitrageur</option>
            </select>
          </div>
        </div>

        {/* 3. System Status & Utilities */}
        <div className="flex items-center gap-3 text-[10px]">
          {/* Zen / Unclutter Mode Toggle */}
          {onToggleCleanMode && (
            <button
              onClick={onToggleCleanMode}
              className={`flex items-center gap-1 px-1.5 py-0.5 border text-[9.5px] transition-colors ${
                isCleanMode
                  ? 'bg-[#089981]/20 text-[#089981] border-[#089981] font-bold'
                  : 'bg-[#1b202a] text-[#64748b] hover:text-[#dee2f1] border-[#1b2232]'
              }`}
              title="Toggle Uncluttered Focus Trading View"
            >
              <Eye size={10} />
              <span>{isCleanMode ? 'CLEAN: ON' : 'UNCLUTTER'}</span>
            </button>
          )}

          {/* Strategy Canvas Modal Trigger */}
          <button
            onClick={onOpenStrategyCompiler}
            className="flex items-center gap-1 text-[#94a3b8] hover:text-[#dee2f1] px-1.5 py-0.5 bg-[#1b202a] border border-[#1b2232] hover:border-[#64748b] transition-colors"
            title="Open Visual Strategy Compiler (zk-SNARK Prover & C++20 AST)"
          >
            <Sparkles size={11} className="text-[#06b6d4]" />
            <span className="hidden sm:inline">COMPILER</span>
          </button>

          {/* Replay Dock Trigger */}
          <button
            onClick={onOpenReplayDock}
            className={`flex items-center gap-1 px-1.5 py-0.5 border transition-colors ${
              isReplayOpen
                ? 'bg-[#089981]/20 text-[#089981] border-[#089981]'
                : 'text-[#94a3b8] hover:text-[#dee2f1] bg-[#1b202a] border-[#1b2232]'
            }`}
            title="Open Historical L3 / Tick Replay Engine"
          >
            <PlayCircle size={11} />
            <span className="hidden sm:inline">REPLAY</span>
          </button>

          <div className="h-3.5 w-px bg-[#1b2232]" />

          {/* DMA / WebSocket Status Indicator */}
          <div className="flex items-center gap-1.5">
            <Radio
              size={11}
              className={
                connectionStatus === 'connected'
                  ? 'text-[#089981] animate-pulse'
                  : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                  ? 'text-[#f59e0b] animate-spin'
                  : 'text-[#f23645]'
              }
            />
            <span
              className={
                connectionStatus === 'connected'
                  ? 'text-[#089981] font-semibold uppercase'
                  : 'text-[#94a3b8] uppercase'
              }
            >
              {inst.isCrypto ? connectionStatus : 'DMA LIVE'}
            </span>
          </div>

          {/* Microsecond / Millisecond Latency */}
          <span className="text-[#64748b] hidden sm:inline">
            <strong className="text-[#dee2f1]">
              {inst.isCrypto ? latencyMs : (latencyMs || 4)}
            </strong>
            ms
          </span>
        </div>
      </header>

      {/* Global Market Directory Modal */}
      <MarketDirectoryModal
        isOpen={isMarketModalOpen}
        onClose={() => setIsMarketModalOpen(false)}
        activeSymbol={symbol}
        onSelectInstrument={onSymbolChange}
      />
    </>
  );
};
