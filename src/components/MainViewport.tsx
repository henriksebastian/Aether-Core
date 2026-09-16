import React, { useEffect, useRef } from 'react';
import { HeatmapRenderer2D } from '../webgpu/gpu_renderer';
import { WebGPUComputeContext, MCQuantiles } from '../webgpu/gpu_context';
import { OrderBookL2 } from '../types/market';

interface MainViewportProps {
  orderBook: OrderBookL2 | null;
  microPrice: number;
  activePersona: string;
  hawkesIntensity: number;
  gpuAllocation: { bookRasterization: number; monteCarloCompute: number; sqlColumnarEngine: number };
}

export const MainViewport: React.FC<MainViewportProps> = ({
  orderBook,
  microPrice,
  activePersona,
  hawkesIntensity,
  gpuAllocation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<HeatmapRenderer2D | null>(null);
  const gpuContextRef = useRef<WebGPUComputeContext | null>(null);
  const mcCacheRef = useRef<MCQuantiles | null>(null);
  const lastMCTimeRef = useRef(0);

  useEffect(() => {
    gpuContextRef.current = new WebGPUComputeContext();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
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
  }, []);

  // Animation & Rendering loop
  useEffect(() => {
    let animId: number;

    const loop = () => {
      if (canvasRef.current && rendererRef.current && orderBook) {
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;

        // Recompute Monte Carlo every 1.5s
        const now = Date.now();
        if (now - lastMCTimeRef.current > 1500 && gpuContextRef.current) {
          mcCacheRef.current = gpuContextRef.current.computeMonteCarlo(orderBook.midPrice);
          lastMCTimeRef.current = now;
        }

        // Compute Quantum Psi field
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
  }, [orderBook, microPrice, activePersona]);

  return (
    <div className="relative flex-1 h-full w-full bg-[#06090e] overflow-hidden flex flex-col">
      {/* Top Telemetry overlay inside viewport */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-3 text-[10px] font-mono bg-black/60 backdrop-blur px-2.5 py-1 rounded border border-white/5">
        <span className="text-gray-400">GPU RASTER:</span>
        <span className="text-cyan font-bold">{Math.round(gpuAllocation.bookRasterization * 100)}%</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">MC COMPUTE:</span>
        <span className="text-purple font-bold">{Math.round(gpuAllocation.monteCarloCompute * 100)}%</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">HAWKES λ:</span>
        <span className={hawkesIntensity >= 1.0 ? 'text-rose font-bold' : 'text-green font-bold'}>
          {hawkesIntensity.toFixed(2)} {hawkesIntensity >= 1.0 ? 'CASCADE' : 'STABLE'}
        </span>
      </div>

      <div className="absolute top-2 right-3 z-10 flex items-center gap-2 text-[10px] font-mono bg-black/60 backdrop-blur px-2.5 py-1 rounded border border-white/5">
        <span className="text-gray-400">2D LUMINANCE DEPTH HEATMAP</span>
        <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300">NO 3D OCCLUSION</span>
      </div>

      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
    </div>
  );
};
