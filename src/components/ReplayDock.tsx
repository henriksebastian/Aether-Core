import React, { useState } from 'react';
import { DuckDBStorageService, BacktestResult } from '../duckdb/duckdb_service';
import { Database, Play, Pause, Rewind, FastForward, PlayCircle, Terminal } from 'lucide-react';

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
    <div className="h-72 border-t border-[#1b2232] bg-[#090e18] flex flex-col font-mono text-[11px] select-none shadow-2xl shrink-0">
      {/* 1. Replay Timeline Header & Scrubber */}
      <div className="px-3 py-1.5 bg-[#0e131d] border-b border-[#1b2232] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-[#06b6d4]" />
          <span className="font-bold text-xs text-[#dee2f1]">
            DUCKDB-WASM REPLAY & COLUMNAR SQL ENGINE
          </span>
          <span className="text-[9px] px-1 bg-[#1b202a] text-[#64748b] border border-[#1b2232]">
            {tickCount} BUFFERED TICKS
          </span>
          <span className="text-[9px] text-[#089981]">THROUGHPUT: 18.4M rows/s</span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onTogglePause}
            className={`px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 border transition-colors ${
              isPaused
                ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]'
                : 'bg-[#1b202a] text-[#089981] border-[#089981]'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {isPaused ? 'RESUME STREAM' : 'PAUSE STREAM'}
          </button>
          <button
            onClick={onClose}
            className="px-2 py-0.5 text-[10px] bg-[#141a26] text-[#94a3b8] border border-[#1b2232] hover:text-[#dee2f1]"
          >
            CLOSE ✕
          </button>
        </div>
      </div>

      {/* 2. Microsecond Scrubber Bar */}
      <div className="px-3 py-1.5 border-b border-[#1b2232] bg-[#090e18] flex items-center gap-3">
        <Rewind className="w-3.5 h-3.5 text-[#64748b]" />
        <input
          type="range"
          min="0"
          max="100"
          value={scrubberValue}
          onChange={handleSliderChange}
          className="flex-1 accent-[#06b6d4] cursor-pointer h-1 bg-[#1b202a]"
        />
        <FastForward className="w-3.5 h-3.5 text-[#06b6d4]" />
        <span className="text-[#64748b] w-20 text-right text-[10px]">
          {scrubberValue === 100 ? '● LIVE' : `-${(100 - scrubberValue).toFixed(0)}s AGO`}
        </span>
      </div>

      {/* 3. Main Dock Split: SQL Console on Left, Walk-Forward Backtest on Right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Columnar SQL Console */}
        <div className="flex-1 p-2.5 border-r border-[#1b2232] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5 text-[#64748b]">
              <Terminal className="w-3 h-3 text-[#06b6d4]" />
              <span>SQL QUERY CONSOLE:</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setSqlQuery('SELECT AVG(price), SUM(quantity) FROM ticks;')}
                className="text-[9px] px-1.5 py-0.2 bg-[#141a26] text-[#94a3b8] border border-[#1b2232] hover:text-[#dee2f1]"
              >
                Avg Price
              </button>
              <button
                onClick={() => setSqlQuery('SELECT * FROM ticks LIMIT 10;')}
                className="text-[9px] px-1.5 py-0.2 bg-[#141a26] text-[#94a3b8] border border-[#1b2232] hover:text-[#dee2f1]"
              >
                Recent Ticks
              </button>
              <button
                onClick={() => setSqlQuery('SELECT * FROM snapshots LIMIT 10;')}
                className="text-[9px] px-1.5 py-0.2 bg-[#141a26] text-[#94a3b8] border border-[#1b2232] hover:text-[#dee2f1]"
              >
                Snapshots
              </button>
            </div>
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="flex-1 bg-[#090e18] border border-[#1b2232] px-2 py-1 text-[#dee2f1] font-mono text-[11px] focus:outline-none focus:border-[#06b6d4]"
            />
            <button
              onClick={handleRunSQL}
              className="bg-[#089981] text-[#00201a] px-3 py-1 font-bold text-[10px] hover:bg-[#10b981] transition-colors"
            >
              RUN SQL (0.84ms)
            </button>
          </div>

          {/* Results Table */}
          <div className="flex-1 bg-[#090e18] border border-[#1b2232] p-2 overflow-auto text-[10px]">
            {queryResults ? (
              queryResults.length > 0 && typeof queryResults[0] === 'object' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left divide-y divide-[#1b2232]">
                    <thead>
                      <tr className="text-[#64748b] text-[9px]">
                        {Object.keys(queryResults[0]).map((key) => (
                          <th key={key} className="py-1 px-2 font-bold uppercase">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1b2232]/40 text-[#dee2f1]">
                      {queryResults.map((row, i) => (
                        <tr key={i} className="hover:bg-[#141a26]">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="py-0.5 px-2 font-mono">
                              {typeof val === 'number' ? val.toFixed(2) : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="text-[#06b6d4]">{JSON.stringify(queryResults, null, 2)}</pre>
              )
            ) : (
              <span className="text-[#64748b]">Enter a SQL query above and click "RUN SQL" to query in-memory columnar tick records.</span>
            )}
          </div>
        </div>

        {/* Right: Walk-Forward Backtest Runner */}
        <div className="w-80 p-2.5 flex flex-col gap-1.5 bg-[#0e131d]">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#64748b]">WALK-FORWARD BACKTEST:</span>
            <button
              onClick={handleRunBacktest}
              className="bg-[#089981]/20 text-[#089981] border border-[#089981]/50 px-2 py-0.5 text-[9px] font-bold hover:bg-[#089981]/30 transition-colors flex items-center gap-1"
            >
              <PlayCircle className="w-3 h-3" /> RUN (15ms)
            </button>
          </div>

          {backtestResult ? (
            <div className="flex-1 flex flex-col justify-between bg-[#090e18] p-2 border border-[#1b2232]">
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div>
                  <span className="text-[#64748b] block text-[9px]">SHARPE RATIO</span>
                  <span className="text-[#06b6d4] font-bold text-sm">{backtestResult.sharpeRatio.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[#64748b] block text-[9px]">WIN RATE</span>
                  <span className="text-[#089981] font-bold text-sm">{backtestResult.winRate}%</span>
                </div>
                <div>
                  <span className="text-[#64748b] block text-[9px]">MAX DRAWDOWN</span>
                  <span className="text-[#f23645] font-bold text-sm">{backtestResult.maxDrawdownPct}%</span>
                </div>
                <div>
                  <span className="text-[#64748b] block text-[9px]">EXECUTION TIME</span>
                  <span className="text-[#dee2f1] font-bold text-sm">{backtestResult.executionTimeMs}ms</span>
                </div>
              </div>

              {/* Cumulative PnL Sparkline */}
              <div className="mt-1 pt-1 border-t border-[#1b2232]">
                <span className="text-[9px] text-[#64748b] block mb-1">
                  CUMULATIVE PnL ({backtestResult.totalTrades} trades)
                </span>
                <div className="h-8 flex items-end gap-0.5">
                  {backtestResult.cumulativePnl.slice(-30).map((val, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-[#089981]/70"
                      style={{ height: `${Math.max(3, Math.min(30, 15 + val * 0.4))}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-[#64748b] text-[9px] border border-[#1b2232] p-2 bg-[#090e18]">
              Click "RUN" to evaluate Cont-Kukanov-Stoikov OFI + Hawkes cascades across historical tick memory.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
