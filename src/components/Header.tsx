import React from 'react';
import { TelemetryMetrics, TraderPersona } from '../types/market';
import { Activity, Cpu, Layers, PlayCircle, ShieldAlert, Sparkles, Zap } from 'lucide-react';

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
    <header className="h-14 border-b border-white/10 bg-[#06090e]/95 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Brand & Market Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan animate-pulse-live" />
          <span className="font-display font-extrabold text-base tracking-wider text-white">
            AETHER<span className="text-cyan">//CORE</span>
          </span>
        </div>

        <div className="h-4 w-[1px] bg-white/10 mx-1" />

        {/* Pair selector */}
        <div className="flex items-center bg-[#0b1018] rounded border border-white/10 p-0.5">
          {['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map((pair) => (
            <button
              key={pair}
              onClick={() => onSymbolChange(pair)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded ${
                symbol === pair ? 'bg-cyan text-black font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              {pair}
            </button>
          ))}
        </div>

        {/* Mandatory Explicit Simulated L3 Tag */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-dim border border-amber-500/30 text-amber text-[10px] font-mono">
          <ShieldAlert className="w-3 h-3" />
          <span>Real L2 + Simulated L3</span>
        </div>
      </div>

      {/* Behavioral Telemetry Strip */}
      <div className="hidden lg:flex items-center gap-4 text-[11px] font-mono text-gray-400 bg-[#0b1018]/80 px-3 py-1 rounded border border-white/5">
        <div className="flex items-center gap-1">
          <Activity className="w-3.5 h-3.5 text-cyan" />
          <span>Hold: <strong className="text-white">{telemetry.timeInTradeSec}s</strong></span>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber" />
          <span>Clicks: <strong className="text-white">{telemetry.clickFrequencyPerMin}/m</strong></span>
        </div>
        <div className="flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5 text-green" />
          <span>Hover: <strong className="text-white">{telemetry.cursorHoverVelocity}px/s</strong></span>
        </div>

        <div className="h-3 w-[1px] bg-white/10" />

        {/* Dynamic Persona State Machine Badge */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500 uppercase">Persona:</span>
          <div className="flex items-center gap-1 bg-[#111823] px-2 py-0.5 rounded border border-white/10">
            <Sparkles className="w-3 h-3 text-cyan" />
            <span className="font-bold text-cyan">{telemetry.activePersona}</span>
            <span className="text-[9px] text-gray-400">({Math.round(telemetry.personaConfidence * 100)}%)</span>
          </div>

          {/* Quick Persona Switcher for Pitch Demo */}
          <div className="flex items-center gap-0.5 ml-1">
            <button
              onClick={() => onPersonaSelect('Micro-Scalper')}
              title="Force Micro-Scalper Persona"
              className="text-[9px] px-1 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300"
            >
              1
            </button>
            <button
              onClick={() => onPersonaSelect('Intraday Momentum')}
              title="Force Intraday Momentum Persona"
              className="text-[9px] px-1 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300"
            >
              2
            </button>
            <button
              onClick={() => onPersonaSelect('Positional Quant')}
              title="Force Positional Quant Persona"
              className="text-[9px] px-1 py-0.5 rounded bg-white/5 hover:bg-white/15 text-gray-300"
            >
              3
            </button>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenReplayDock}
          className={`btn-terminal ${isReplayOpen ? 'active' : ''}`}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          <span>DuckDB Replay & SQL</span>
        </button>

        <button
          onClick={onOpenStrategyCompiler}
          className="btn-terminal bg-cyan-dim text-cyan border-cyan-500/40 hover:border-cyan-400"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Strategy Node Compiler</span>
        </button>

        {/* Live Network & Latency */}
        <div className="flex items-center gap-1.5 pl-2 text-[11px] font-mono">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green' : 'bg-amber animate-ping'
            }`}
          />
          <span className="text-gray-400">{latencyMs > 0 ? `${latencyMs}ms` : connectionStatus}</span>
        </div>
      </div>
    </header>
  );
};
