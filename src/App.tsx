import React, { useEffect, useState, useRef } from 'react';
import { FeedCoordinator, MarketStateSnapshot } from './ingestion/feed_coordinator';
import { DuckDBStorageService } from './duckdb/duckdb_service';
import { TelemetryTracker } from './telemetry/telemetry_tracker';
import { IndicatorEngine, IndicatorEngineState } from './indicators/indicator_engine';
import { Header } from './components/Header';
import { MainViewport } from './components/MainViewport';
import { OrderBookDOM } from './components/OrderBookDOM';
import { IndicatorMatrix } from './components/IndicatorMatrix';
import { ReplayDock } from './components/ReplayDock';
import { StrategyNodeCompilerModal } from './strategy_compiler/NodeCanvas';
import { TelemetryMetrics, TraderPersona } from './types/market';

export const App: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [snapshot, setSnapshot] = useState<MarketStateSnapshot | null>(null);
  const [indicatorState, setIndicatorState] = useState<IndicatorEngineState | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [tickCount, setTickCount] = useState(0);

  const [telemetry, setTelemetry] = useState<TelemetryMetrics>({
    timeInTradeSec: 85,
    clickFrequencyPerMin: 14,
    zoomIntervalSec: 25,
    indicatorUsageCount: 6,
    cursorHoverVelocity: 420,
    activePersona: 'Micro-Scalper',
    personaConfidence: 0.91,
    gpuThreadAllocation: {
      bookRasterization: 0.9,
      monteCarloCompute: 0.05,
      sqlColumnarEngine: 0.05,
    },
  });

  const feedRef = useRef<FeedCoordinator | null>(null);
  const duckDbRef = useRef<DuckDBStorageService | null>(null);
  const telemetryTrackerRef = useRef<TelemetryTracker | null>(null);
  const indicatorEngineRef = useRef<IndicatorEngine | null>(null);

  useEffect(() => {
    duckDbRef.current = new DuckDBStorageService();
    indicatorEngineRef.current = new IndicatorEngine();
    telemetryTrackerRef.current = new TelemetryTracker((metrics) => {
      setTelemetry(metrics);
    });

    feedRef.current = new FeedCoordinator(symbol);
    const unsubscribe = feedRef.current.subscribe((snap) => {
      setSnapshot(snap);

      // Stream into DuckDB
      if (snap.recentTrades.length > 0 && duckDbRef.current) {
        duckDbRef.current.insertTick(snap.recentTrades[0]);
        setTickCount(duckDbRef.current.getTickCount());
      }
      if (snap.orderBook && duckDbRef.current) {
        duckDbRef.current.insertSnapshot(
          snap.orderBook,
          snap.wasmMetrics.microPrice,
          snap.wasmMetrics.ofi,
          snap.wasmMetrics.kylesLambda
        );
      }

      // Update 22-Indicator Matrix
      if (indicatorEngineRef.current) {
        const ind = indicatorEngineRef.current.update(
          snap.orderBook,
          snap.recentTrades,
          snap.wasmMetrics,
          snap.l3State
        );
        setIndicatorState(ind);
      }
    });

    return () => {
      unsubscribe();
      feedRef.current?.destroy();
    };
  }, []);

  const handleSymbolChange = (newSym: string) => {
    setSymbol(newSym);
    feedRef.current?.setSymbol(newSym);
  };

  const handlePersonaSelect = (persona: TraderPersona) => {
    telemetryTrackerRef.current?.forcePersona(persona);
  };

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const handleScrub = (pct: number) => {
    console.log('[DuckDB Scrubber] Replay scrubbed to:', pct);
  };

  const activePersona = telemetry.activePersona;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090e18] text-[#dee2f1] overflow-hidden font-mono">
      {/* Header with Telemetry, Connection & Persona Badge */}
      <Header
        telemetry={telemetry}
        connectionStatus={snapshot?.connectionStatus ?? 'connecting'}
        latencyMs={snapshot?.latencyMs ?? 0}
        symbol={symbol}
        onSymbolChange={handleSymbolChange}
        onPersonaSelect={handlePersonaSelect}
        onOpenStrategyCompiler={() => setIsStrategyOpen(true)}
        onOpenReplayDock={() => setIsReplayOpen((prev) => !prev)}
        isReplayOpen={isReplayOpen}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Candlestick & Multi-Plane WebGPU Canvas Viewport */}
        <MainViewport
          orderBook={snapshot?.orderBook ?? null}
          recentTrades={snapshot?.recentTrades ?? []}
          microPrice={snapshot?.wasmMetrics.microPrice ?? 0}
          activePersona={activePersona}
          hawkesIntensity={snapshot?.wasmMetrics.hawkesIntensity ?? 0.45}
          ofi={snapshot?.wasmMetrics.ofi ?? 0}
          gpuAllocation={telemetry.gpuThreadAllocation}
        />

        {/* Right Dock: Order Book DOM & Real-Time Trade Tape */}
        <OrderBookDOM
          orderBook={snapshot?.orderBook ?? null}
          recentTrades={snapshot?.recentTrades ?? []}
          microPrice={snapshot?.wasmMetrics.microPrice ?? 0}
          queuePriority={snapshot?.wasmMetrics.queuePriority ?? 0.5}
          l3State={snapshot?.l3State ?? null}
          activePersona={activePersona}
        />
      </div>

      {/* Bottom: 22-Indicator Matrix Across 5 Planes */}
      {indicatorState && (
        <IndicatorMatrix
          indicators={indicatorState.indicators}
          activePersona={activePersona}
          onIndicatorClick={() => telemetryTrackerRef.current?.recordIndicatorToggle()}
        />
      )}

      {/* Expandable DuckDB Time-Travel Replay & Columnar SQL Dock */}
      {duckDbRef.current && (
        <ReplayDock
          isOpen={isReplayOpen}
          onClose={() => setIsReplayOpen(false)}
          duckDb={duckDbRef.current}
          isPaused={isPaused}
          onTogglePause={handleTogglePause}
          onScrub={handleScrub}
          tickCount={tickCount}
        />
      )}

      {/* Strategy Node Compiler & zk-SNARK Verifier Modal */}
      <StrategyNodeCompilerModal
        isOpen={isStrategyOpen}
        onClose={() => setIsStrategyOpen(false)}
        personaDefaultTarget={activePersona}
      />
    </div>
  );
};
