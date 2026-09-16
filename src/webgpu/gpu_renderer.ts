import { MCQuantiles } from './gpu_context';
import { PriceLevel } from '../types/market';

export interface RenderParams {
  width: number;
  height: number;
  bids: PriceLevel[];
  asks: PriceLevel[];
  midPrice: number;
  microPrice: number;
  mcQuantiles: MCQuantiles | null;
  psiField: { prices: number[]; probDensity: number[] } | null;
  liquidityGravity: { price: number; force: number } | null;
  activePersona: string;
  vwapBands: { vwap: number; upper1: number; lower1: number; upper2: number; lower2: number } | null;
}

export class HeatmapRenderer2D {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Failed to obtain Canvas2D context');
    this.ctx = context;
  }

  public render(params: RenderParams): void {
    const { width, height, bids, asks, midPrice, microPrice, mcQuantiles, psiField, liquidityGravity, activePersona, vwapBands } = params;
    const ctx = this.ctx;

    // 1. Clear background
    ctx.fillStyle = '#06090e';
    ctx.fillRect(0, 0, width, height);

    if (midPrice <= 0) return;

    // Price scaling: +/- 1.5% around midPrice
    const priceRange = midPrice * 0.025;
    const minP = midPrice - priceRange;
    const maxP = midPrice + priceRange;

    const priceToY = (p: number): number => {
      return height - ((p - minP) / (maxP - minP)) * height;
    };

    // 2. Render Gridlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridStep = priceRange / 5;
    for (let p = minP; p <= maxP; p += gridStep) {
      const y = priceToY(p);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // Label price
      ctx.fillStyle = '#526071';
      ctx.font = '10px "JetBrains Mono"';
      ctx.fillText(p.toFixed(2), width - 70, y - 4);
    }

    // 3. Render 2D Volumetric Liquidity Heatmap Rasterization (No 3D / No occlusion)
    // Asks (Red/Rose luminous depth)
    const maxDepthVol = 15.0;
    for (let i = 0; i < asks.length; i++) {
      const y = priceToY(asks[i].price);
      const intensity = Math.min(1.0, asks[i].quantity / maxDepthVol);
      const barW = width * 0.45 * intensity;

      const grad = ctx.createLinearGradient(0, y, barW, y);
      grad.addColorStop(0, `rgba(255, 0, 85, ${0.45 * intensity})`);
      grad.addColorStop(0.5, `rgba(255, 50, 120, ${0.2 * intensity})`);
      grad.addColorStop(1, 'rgba(255, 0, 85, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 3, barW, 6);
    }

    // Bids (Emerald/Green luminous depth)
    for (let i = 0; i < bids.length; i++) {
      const y = priceToY(bids[i].price);
      const intensity = Math.min(1.0, bids[i].quantity / maxDepthVol);
      const barW = width * 0.45 * intensity;

      const grad = ctx.createLinearGradient(0, y, barW, y);
      grad.addColorStop(0, `rgba(0, 255, 136, ${0.45 * intensity})`);
      grad.addColorStop(0.5, `rgba(0, 200, 180, ${0.2 * intensity})`);
      grad.addColorStop(1, 'rgba(0, 255, 136, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 3, barW, 6);
    }

    // 4. Render Quantum Probability Density Wave Psi(x,t) Field
    if (psiField && (activePersona === 'Positional Quant' || activePersona === 'Micro-Scalper')) {
      ctx.beginPath();
      const waveStartX = width * 0.45;
      const waveMaxW = width * 0.35;

      for (let i = 0; i < psiField.prices.length; i++) {
        const y = priceToY(psiField.prices[i]);
        const amp = psiField.probDensity[i];
        const x = waveStartX + amp * waveMaxW;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.strokeStyle = 'rgba(157, 78, 221, 0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glow fill for Quantum Wave
      ctx.lineTo(waveStartX, priceToY(psiField.prices[psiField.prices.length - 1]));
      ctx.lineTo(waveStartX, priceToY(psiField.prices[0]));
      ctx.closePath();
      ctx.fillStyle = 'rgba(157, 78, 221, 0.08)';
      ctx.fill();
    }

    // 5. Render 10,000-Path Monte Carlo Quantile Envelope
    if (mcQuantiles && (activePersona === 'Intraday Momentum' || activePersona === 'Positional Quant')) {
      const mcStartX = width * 0.55;
      const mcWidth = width * 0.4;
      const steps = mcQuantiles.p50.length;
      const dx = mcWidth / (steps - 1);

      // p05 to p95 outer cone (5% - 95%)
      ctx.beginPath();
      for (let t = 0; t < steps; t++) {
        const x = mcStartX + t * dx;
        const y95 = priceToY(mcQuantiles.p95[t]);
        if (t === 0) ctx.moveTo(x, y95);
        else ctx.lineTo(x, y95);
      }
      for (let t = steps - 1; t >= 0; t--) {
        const x = mcStartX + t * dx;
        const y05 = priceToY(mcQuantiles.p05[t]);
        ctx.lineTo(x, y05);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 243, 255, 0.06)';
      ctx.fill();

      // p25 to p75 inner cone
      ctx.beginPath();
      for (let t = 0; t < steps; t++) {
        const x = mcStartX + t * dx;
        const y75 = priceToY(mcQuantiles.p75[t]);
        if (t === 0) ctx.moveTo(x, y75);
        else ctx.lineTo(x, y75);
      }
      for (let t = steps - 1; t >= 0; t--) {
        const x = mcStartX + t * dx;
        const y25 = priceToY(mcQuantiles.p25[t]);
        ctx.lineTo(x, y25);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 243, 255, 0.12)';
      ctx.fill();

      // Median trajectory (p50)
      ctx.beginPath();
      for (let t = 0; t < steps; t++) {
        const x = mcStartX + t * dx;
        const y50 = priceToY(mcQuantiles.p50[t]);
        if (t === 0) ctx.moveTo(x, y50);
        else ctx.lineTo(x, y50);
      }
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 6. Anchored VWAP + Bands
    if (vwapBands) {
      const vwapY = priceToY(vwapBands.vwap);
      ctx.strokeStyle = '#ffb700';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, vwapY);
      ctx.lineTo(width, vwapY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffb700';
      ctx.font = '9px "JetBrains Mono"';
      ctx.fillText('AVWAP', width - 110, vwapY - 3);
    }

    // 7. Liquidity Gravity Vector
    if (liquidityGravity) {
      const gravY = priceToY(liquidityGravity.price);
      ctx.strokeStyle = '#9d4edd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(width * 0.1, gravY);
      ctx.lineTo(width * 0.4, gravY);
      ctx.stroke();

      // Gravity Arrow
      ctx.fillStyle = '#9d4edd';
      ctx.beginPath();
      ctx.arc(width * 0.4, gravY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(`GRAVITY G(x) force: ${liquidityGravity.force.toFixed(2)}`, width * 0.4 + 8, gravY + 3);
    }

    // 8. Micro-Price Tracer Line (WASM Computed)
    const microY = priceToY(microPrice || midPrice);
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 243, 255, 0.7)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, microY);
    ctx.lineTo(width, microY);
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // Tracer Tag
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(width - 90, microY - 9, 85, 18);
    ctx.fillStyle = '#06090e';
    ctx.font = 'bold 10px "JetBrains Mono"';
    ctx.fillText(`µP: ${(microPrice || midPrice).toFixed(2)}`, width - 85, microY + 4);

    // Current Mid Price line
    const midY = priceToY(midPrice);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();
  }
}
