import React, { useEffect, useRef, useState } from 'react';
import { HeatmapRenderer2D } from '../webgpu/gpu_renderer';
import { WebGPUComputeContext, MCQuantiles } from '../webgpu/gpu_context';
import { OrderBookL2, MarketTick } from '../types/market';
import { CandlestickChart } from './CandlestickChart';
import {
  Crosshair,
  Minus,
  GitFork,
  BarChart2,
  Layers,
  Camera,
  Settings,
  SplitSquareVertical,
  Maximize2,
} from 'lucide-react';

interface MainViewportProps {
  symbol?: string;
  orderBook: OrderBookL2 | null;
  recentTrades: MarketTick[];
  microPrice: number;
  activePersona: string;
  hawkesIntensity: number;
  ofi: number;
  gpuAllocation: { bookRasterization: number; monteCarloCompute: number; sqlColumnarEngine: number };
}

type ViewMode = 'candlestick' | 'heatmap' | 'split';

export const MainViewport: React.FC<MainViewportProps> = ({
  symbol = 'BTCUSDT',
  orderBook,
  recentTrades,
  microPrice,
  activePersona,
  hawkesIntensity,
  ofi,
  gpuAllocation,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('candlestick');
  const [activeTool, setActiveTool] = useState<string>('crosshair');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<HeatmapRenderer2D | null>(null);
  const gpuContextRef = useRef<WebGPUComputeContext | null>(null);
  const mcCacheRef = useRef<MCQuantiles | null>(null);
  const lastMCTimeRef = useRef(0);

  useEffect(() => {
    gpuContextRef.current = new WebGPUComputeContext();
  }, []);

  useEffect(() => {
    if (!canvasRef.current || (viewMode !== 'heatmap' && viewMode !== 'split')) return;
    try {
      rendererRef.current = new HeatmapRenderer2D(canvasRef.current);
    } catch (err) {
      console.error('[MainViewport] Renderer setup error:', err);
    }

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = canvasRef.current.clientWidth * window.devicePixelRatio;
        canvasRef.current.height = canvasRef.current.clientHeight * window.devicePixelRatio;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

  // Animation loop for Heatmap
  useEffect(() => {
    if (viewMode !== 'heatmap' && viewMode !== 'split') return;
    let animId: number;

    const loop = () => {
      if (canvasRef.current && rendererRef.current && orderBook) {
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;

        const now = Date.now();
        if (now - lastMCTimeRef.current > 1500 && gpuContextRef.current) {
          mcCacheRef.current = gpuContextRef.current.computeMonteCarlo(orderBook.midPrice);
          lastMCTimeRef.current = now;
        }

        let psiField: any = null;
        if (gpuContextRef.current) {
          const liquidityWalls = [
            { price: orderBook.bestAsk + 2.0, volume: 8.5 },
            { price: orderBook.bestBid - 2.0, volume: 9.0 },
          ];
          psiField = gpuContextRef.current.computeQuantumWave(orderBook.midPrice, liquidityWalls);
        }

        rendererRef.current.render({
          width,
          height,
          bids: orderBook.bids,
          asks: orderBook.asks,
          midPrice: orderBook.midPrice,
          microPrice,
          mcQuantiles: mcCacheRef.current,
          psiField,
          liquidityGravity: { price: orderBook.midPrice * 1.002, force: 1.45 },
          activePersona,
          vwapBands: {
            vwap: orderBook.midPrice * 0.999,
            upper1: orderBook.midPrice * 1.002,
            lower1: orderBook.midPrice * 0.996,
            upper2: orderBook.midPrice * 1.004,
            lower2: orderBook.midPrice * 0.994,
          },
        });
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [orderBook, microPrice, activePersona, viewMode]);

  return (
    <div className="relative flex-1 h-full w-full bg-[#090e18] overflow-hidden flex flex-row">
      {/* 1. Left Mini Tool Rail (40px) */}
      <div className="w-10 border-r border-[#1b2232] bg-[#0e131d] flex flex-col items-center py-2.5 gap-2 text-[#94a3b8] shrink-0 z-20 select-none">
        <button
          onClick={() => setActiveTool('crosshair')}
          title="Crosshair Tool"
          className={`w-7 h-7 flex items-center justify-center transition-colors ${
            activeTool === 'crosshair'
              ? 'bg-[#1b202a] text-[#089981] border border-[#089981]/50'
              : 'hover:text-[#e2e8f0] hover:bg-[#141a26]'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setActiveTool('trendline')}
          title="Trendline Tool"
          className={`w-7 h-7 flex items-center justify-center transition-colors ${
            activeTool === 'trendline'
              ? 'bg-[#1b202a] text-[#089981] border border-[#089981]/50'
              : 'hover:text-[#e2e8f0] hover:bg-[#141a26]'
          }`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setActiveTool('pitchfork')}
          title="Pitchfork"
          className={`w-7 h-7 flex items-center justify-center transition-colors ${
            activeTool === 'pitchfork'
              ? 'bg-[#1b202a] text-[#089981] border border-[#089981]/50'
              : 'hover:text-[#e2e8f0] hover:bg-[#141a26]'
          }`}
        >
          <GitFork className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setActiveTool('vpvr')}
          title="Anchored Volume Profile (VPVR)"
          className={`w-7 h-7 flex items-center justify-center transition-colors ${
            activeTool === 'vpvr'
              ? 'bg-[#1b202a] text-[#089981] border border-[#089981]/50'
              : 'hover:text-[#e2e8f0] hover:bg-[#141a26]'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setActiveTool('fib')}
          title="Fibonacci Retracement"
          className={`w-7 h-7 flex items-center justify-center transition-colors ${
            activeTool === 'fib'
              ? 'bg-[#1b202a] text-[#089981] border border-[#089981]/50'
              : 'hover:text-[#e2e8f0] hover:bg-[#141a26]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        <div className="w-5 h-px bg-[#1b2232] my-1" />

        <button
          title="Snapshot Workspace"
          className="w-7 h-7 flex items-center justify-center hover:text-[#e2e8f0] hover:bg-[#141a26] transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>
        <button
          title="Chart Settings"
          className="w-7 h-7 flex items-center justify-center hover:text-[#e2e8f0] hover:bg-[#141a26] transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Main Center Chart Viewport Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Viewport Content Rendering */}
        {viewMode === 'candlestick' && (
          <CandlestickChart
            symbol={symbol}
            orderBook={orderBook}
            recentTrades={recentTrades}
            microPrice={microPrice}
            activePersona={activePersona}
            ofi={ofi}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        )}

        {viewMode === 'heatmap' && (
          <div className="relative flex-1 h-full w-full bg-[#090e18] overflow-hidden flex flex-col">
            {/* Top Heatmap Bar */}
            <div className="h-8 border-b border-[#1b2232] bg-[#0e131d] px-3 flex items-center justify-between text-[11px] shrink-0 z-20">
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="text-[#64748b]">GPU RASTER:</span>
                <span className="text-[#06b6d4] font-bold">
                  {Math.round(gpuAllocation.bookRasterization * 100)}%
                </span>
                <span className="text-[#1b2232]">|</span>
                <span className="text-[#64748b]">MC COMPUTE:</span>
                <span className="text-[#8b5cf6] font-bold">
                  {Math.round(gpuAllocation.monteCarloCompute * 100)}%
                </span>
                <span className="text-[#1b2232]">|</span>
                <span className="text-[#64748b]">HAWKES λ:</span>
                <span className={hawkesIntensity >= 1.0 ? 'text-[#f23645] font-bold' : 'text-[#089981] font-bold'}>
                  {hawkesIntensity.toFixed(2)} {hawkesIntensity >= 1.0 ? 'CASCADE' : 'STABLE'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#090e18] border border-[#1b2232] p-0.5 text-[10px]">
                  <button
                    onClick={() => setViewMode('candlestick')}
                    className="px-1.5 py-0.2 text-[9px] text-[#64748b] hover:text-[#dee2f1]"
                  >
                    CANDLE
                  </button>
                  <button
                    onClick={() => setViewMode('heatmap')}
                    className="px-1.5 py-0.2 text-[9px] font-bold bg-[#1b202a] text-[#06b6d4] border-b border-[#06b6d4]"
                  >
                    HEATMAP
                  </button>
                  <button
                    onClick={() => setViewMode('split')}
                    className="px-1.5 py-0.2 text-[9px] text-[#64748b] hover:text-[#dee2f1]"
                  >
                    SPLIT
                  </button>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 bg-[#141a26] text-[#64748b] border border-[#1b2232]">
                  2D LUMINANCE · ZERO OCCLUSION
                </span>
              </div>
            </div>

            <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
          </div>
        )}

        {viewMode === 'split' && (
          <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
            <div className="h-7 border-b border-[#1b2232] bg-[#0e131d] px-3 flex items-center justify-between text-[10px]">
              <span className="text-[#94a3b8] font-bold">DUAL DISPLAY: CANDLESTICK & WEBGPU DEPTH HEATMAP</span>
              <div className="flex items-center bg-[#090e18] border border-[#1b2232] p-0.5">
                <button
                  onClick={() => setViewMode('candlestick')}
                  className="px-1.5 py-0.2 text-[9px] text-[#64748b] hover:text-[#dee2f1]"
                >
                  CANDLE
                </button>
                <button
                  onClick={() => setViewMode('heatmap')}
                  className="px-1.5 py-0.2 text-[9px] text-[#64748b] hover:text-[#dee2f1]"
                >
                  HEATMAP
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className="px-1.5 py-0.2 text-[9px] font-bold bg-[#1b202a] text-[#8b5cf6] border-b border-[#8b5cf6]"
                >
                  SPLIT
                </button>
              </div>
            </div>
            <div className="flex-1 flex h-full w-full overflow-hidden">
              <div className="w-1/2 h-full border-r border-[#1b2232]">
                <CandlestickChart
                  symbol={symbol}
                  orderBook={orderBook}
                  recentTrades={recentTrades}
                  microPrice={microPrice}
                  activePersona={activePersona}
                  ofi={ofi}
                />
              </div>
              <div className="w-1/2 h-full relative bg-[#090e18]">
                <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
