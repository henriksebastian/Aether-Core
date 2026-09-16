import React from 'react';
import { TelemetryMetrics, TraderPersona } from '../types/market';
import { ShieldAlert, Layers, PlayCircle, Radio } from 'lucide-react';

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
}) => {
  return (
    <header className="h-9 border-b border-[#1b2232] bg-[#0e131d] px-3 flex items-center justify-between z-30 select-none font-mono text-[11px]">
      {/* 1. Brand & Instrument Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs tracking-wider text-[#089981]">
            AETHER<span className="text-[#dee2f1]">//QUANT</span>
          </span>
          <span className="text-[9px] px-1 bg-[#1b202a] text-[#64748b] border border-[#1b2232]">
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
        <div className="hidden xl:flex items-center gap-3 text-[10px] border-l border-[#1b2232] pl-3">
          <div>
            <span className="text-[#64748b]">24H H:</span> <span className="text-[#dee2f1]">$65,490.00</span>
          </div>
          <div>
            <span className="text-[#64748b]">24H L:</span> <span className="text-[#dee2f1]">$62,910.20</span>
          </div>
          <div>
            <span className="text-[#64748b]">24H VOL:</span> <span className="text-[#06b6d4]">$4.82B</span>
          </div>
          <div>
            <span className="text-[#64748b]">FUNDING:</span> <span className="text-[#089981]">+0.0082% (1h 14m)</span>
          </div>
        </div>
      </div>

      {/* 2. Behavioral Persona & Telemetry Strip */}
      <div className="hidden lg:flex items-center gap-3 text-[10px] text-[#94a3b8] bg-[#090e18] px-2.5 py-0.5 border border-[#1b2232]">
        <div className="flex items-center gap-1.5">
          <span className="text-[#64748b] uppercase">PERSONA:</span>
          <span className="text-[#06b6d4] font-bold">{telemetry.activePersona}</span>
          <span className="text-[#64748b]">({Math.round(telemetry.personaConfidence * 100)}%)</span>
        </div>

        <div className="h-3 w-px bg-[#1b2232]" />

        {/* Persona Switchers */}
        <div className="flex items-center gap-1">
          {(['Micro-Scalper', 'Intraday Momentum', 'Positional Quant'] as TraderPersona[]).map((p, idx) => (
            <button
              key={p}
              onClick={() => onPersonaSelect(p)}
              title={`Switch to ${p}`}
              className={`px-1.5 py-0.2 text-[9px] border transition-colors ${
                telemetry.activePersona === p
                  ? 'bg-[#1b202a] text-[#089981] border-[#089981]'
                  : 'text-[#64748b] border-[#1b2232] hover:text-[#dee2f1]'
              }`}
            >
              {idx + 1}:{p.split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="h-3 w-px bg-[#1b2232]" />

        {/* Explicit L2 + L3 Tag */}
        <div className="flex items-center gap-1 text-[#f59e0b]">
          <ShieldAlert className="w-3 h-3" />
          <span className="text-[9px]">L2 REAL + L3 SIM</span>
        </div>
      </div>

      {/* 3. Action Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenReplayDock}
          className={`px-2 py-1 text-[10px] font-bold flex items-center gap-1 border transition-colors ${
            isReplayOpen
              ? 'bg-[#1b202a] text-[#06b6d4] border-[#06b6d4]'
              : 'bg-[#090e18] text-[#94a3b8] border-[#1b2232] hover:text-[#dee2f1] hover:border-[#242c40]'
          }`}
        >
          <PlayCircle className="w-3 h-3" />
          <span>DUCKDB SQL</span>
        </button>

        <button
          onClick={onOpenStrategyCompiler}
          className="px-2 py-1 text-[10px] font-bold flex items-center gap-1 bg-[#089981]/15 text-[#089981] border border-[#089981]/50 hover:bg-[#089981]/30 transition-colors"
        >
          <Layers className="w-3 h-3" />
          <span>STRATEGY COMPILER</span>
        </button>

        <button
          onClick={() => alert('[KILL SWITCH ENGAGED] All simulated active positions liquidating immediately.')}
          className="px-2 py-1 text-[10px] font-bold bg-[#f23645]/15 text-[#f23645] border border-[#f23645]/50 hover:bg-[#f23645]/30 transition-colors"
        >
          KILL SWITCH
        </button>

        {/* Connection & Latency */}
        <div className="flex items-center gap-1.5 pl-2 text-[10px] border-l border-[#1b2232]">
          <Radio className={`w-3 h-3 ${connectionStatus === 'connected' ? 'text-[#089981] animate-pulse' : 'text-[#f59e0b]'}`} />
          <span className="text-[#64748b]">{latencyMs > 0 ? `${latencyMs}ms LD4` : connectionStatus}</span>
        </div>
      </div>
    </header>
  );
};
