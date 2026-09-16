import React, { useState } from 'react';
import { DuckDBStorageService, BacktestResult } from '../duckdb/duckdb_service';
import { Database, Play, Pause, Rewind, FastForward, PlayCircle } from 'lucide-react';

interface ReplayDockProps {
  isOpen: boolean;
  onClose: () => void;
  duckDb: DuckDBStorageService;
  isPaused: boolean;
  onTogglePause: () => void;
  onScrub: (pct: number) => void;
  tickCount: number;
}

export const ReplayDock: React.FC<ReplayDockProps> = ({
  isOpen,
  onClose,
  duckDb,
  isPaused,
  onTogglePause,
  onScrub,
  tickCount,
}) => {
  const [sqlQuery, setSqlQuery] = useState('SELECT COUNT(*) FROM ticks;');
  const [queryResults, setQueryResults] = useState<any[] | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [scrubberValue, setScrubberValue] = useState(100);

  if (!isOpen) return null;

  const handleRunSQL = async () => {
    const res = await duckDb.executeQuery(sqlQuery);
    setQueryResults(res);
  };

  const handleRunBacktest = () => {
    const res = duckDb.runWalkForwardBacktest({
      ofiThreshold: 1.5,
      hawkesThreshold: 1.05,
      holdingPeriodSec: 30,
    });
    setBacktestResult(res);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setScrubberValue(val);
    onScrub(val / 100);
  };

  return (
    <div className="h-80 border-t border-white/10 bg-[#080d14] flex flex-col font-mono text-[11px] select-none shadow-2xl">
      {/* Replay Timeline Header & Scrubber */}
      <div className="px-4 py-2 bg-[#0b1018] border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-4 h-4 text-cyan" />
          <span className="font-display font-bold text-xs text-white">
            DUCKDB-WASM REPLAY SCRUBBER & COLUMNAR ENGINE
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
            {tickCount} Columnar Rows Buffered
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePause}
            className={`btn-terminal ${isPaused ? 'bg-amber-dim text-amber border-amber-500/30' : 'active'}`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Resume Live Stream' : 'Pause Live Feed'}
          </button>
          <button onClick={onClose} className="btn-terminal">
            Close ✕
          </button>
        </div>
      </div>

      {/* Microsecond Scrubber Bar */}
      <div className="px-4 py-2 border-b border-white/10 bg-[#06090e] flex items-center gap-3">
        <Rewind className="w-3.5 h-3.5 text-gray-500" />
        <input
          type="range"
          min="0"
          max="100"
          value={scrubberValue}
          onChange={handleSliderChange}
          className="flex-1 accent-cyan cursor-pointer h-1.5 bg-white/10 rounded-lg"
        />
        <FastForward className="w-3.5 h-3.5 text-cyan" />
        <span className="text-gray-400 w-16 text-right">
          {scrubberValue === 100 ? 'LIVE NOW' : `-${(100 - scrubberValue).toFixed(0)}s`}
        </span>
      </div>

      {/* Main Dock Split: SQL Console on Left, Walk-Forward Backtest on Right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Columnar SQL Console */}
        <div className="flex-1 p-3 border-r border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px]">Client-Side In-Browser SQL:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setSqlQuery('SELECT AVG(price), SUM(quantity) FROM ticks;')}
                className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 hover:text-white"
              >
                Avg Price
              </button>
              <button
                onClick={() => setSqlQuery('SELECT * FROM ticks LIMIT 10;')}
                className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 hover:text-white"
              >
                Recent Ticks
              </button>
              <button
                onClick={() => setSqlQuery('SELECT * FROM snapshots LIMIT 10;')}
                className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 hover:text-white"
              >
                Snapshots
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan"
            />
            <button onClick={handleRunSQL} className="btn-terminal">
              Execute SQL
            </button>
          </div>

          {/* Results Table */}
          <div className="flex-1 bg-black/40 rounded border border-white/5 p-2 overflow-auto text-[10px]">
            {queryResults ? (
              <pre className="text-cyan">{JSON.stringify(queryResults, null, 2)}</pre>
            ) : (
              <span className="text-gray-600">Enter SQL query and press Execute...</span>
            )}
          </div>
        </div>

        {/* Right: Walk-Forward Backtest Runner */}
        <div className="w-96 p-3 flex flex-col gap-2 bg-[#06090e]/40">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-[10px]">Walk-Forward In-Memory Backtest:</span>
            <button
              onClick={handleRunBacktest}
              className="btn-terminal bg-green-dim text-green border-green-500/30 hover:border-green-400"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Run Backtest
            </button>
          </div>

          {backtestResult ? (
            <div className="flex-1 flex flex-col justify-between bg-black/40 p-2.5 rounded border border-white/5">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500 block text-[9px]">SHARPE RATIO</span>
                  <span className="text-cyan font-bold text-sm">{backtestResult.sharpeRatio.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">WIN RATE</span>
                  <span className="text-green font-bold text-sm">{backtestResult.winRate}%</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">MAX DRAWDOWN</span>
                  <span className="text-rose font-bold text-sm">{backtestResult.maxDrawdownPct}%</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[9px]">EXECUTION TIME</span>
                  <span className="text-white font-bold text-sm">{backtestResult.executionTimeMs}ms</span>
                </div>
              </div>

              {/* Mini Cumulative PnL Sparkline */}
              <div className="mt-2 pt-2 border-t border-white/5">
                <span className="text-[9px] text-gray-500 block mb-1">
                  CUMULATIVE PnL CURVE ({backtestResult.totalTrades} trades)
                </span>
                <div className="h-10 flex items-end gap-1">
                  {backtestResult.cumulativePnl.slice(-30).map((val, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-green/60 rounded-t"
                      style={{ height: `${Math.max(4, Math.min(36, 18 + val * 0.4))}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-gray-600 text-[10px]">
              Click "Run Backtest" to test Hawkes + OFI rule across buffered ticks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
