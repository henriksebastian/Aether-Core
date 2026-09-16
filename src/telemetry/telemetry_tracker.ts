import { TelemetryMetrics, TraderPersona } from '../types/market';

export class TelemetryTracker {
  private clickTimestamps: number[] = [];
  private lastCursorX = 0;
  private lastCursorY = 0;
  private lastCursorTime = Date.now();
  private cursorVelocity = 0;
  private zoomIntervalSec = 30;
  private indicatorUsageCount = 4;
  private timeInTradeSec = 90; // default scalper hold
  private forcedPersona: TraderPersona | null = null;
  private onTelemetryUpdate: (metrics: TelemetryMetrics) => void;

  constructor(onUpdate: (metrics: TelemetryMetrics) => void) {
    this.onTelemetryUpdate = onUpdate;
    this.bindEvents();
    this.startEvaluationLoop();
  }

  private bindEvents(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('click', () => {
      const now = Date.now();
      this.clickTimestamps.push(now);
      this.clickTimestamps = this.clickTimestamps.filter((t) => now - t < 60000);
    });

    window.addEventListener('mousemove', (e) => {
      const now = Date.now();
      const dt = Math.max(1, now - this.lastCursorTime);
      const dx = e.clientX - this.lastCursorX;
      const dy = e.clientY - this.lastCursorY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const instantVel = (dist / dt) * 1000;
      this.cursorVelocity = 0.85 * this.cursorVelocity + 0.15 * instantVel;

      this.lastCursorX = e.clientX;
      this.lastCursorY = e.clientY;
      this.lastCursorTime = now;
    });

    window.addEventListener('wheel', () => {
      this.zoomIntervalSec = Math.max(5, this.zoomIntervalSec * 0.9);
    });
  }

  public recordIndicatorToggle(): void {
    this.indicatorUsageCount++;
  }

  public setTimeInTrade(sec: number): void {
    this.timeInTradeSec = sec;
  }

  public forcePersona(persona: TraderPersona | null): void {
    this.forcedPersona = persona;
    this.evaluate();
  }

  private startEvaluationLoop(): void {
    setInterval(() => {
      this.evaluate();
    }, 1000);
  }

  private evaluate(): void {
    const now = Date.now();
    this.clickTimestamps = this.clickTimestamps.filter((t) => now - t < 60000);
    const clickFreq = this.clickTimestamps.length;

    let persona: TraderPersona = 'Micro-Scalper';
    let confidence = 0.85;

    if (this.forcedPersona) {
      persona = this.forcedPersona;
      confidence = 1.0;
    } else {
      // Automatic classification heuristics
      if (this.timeInTradeSec < 120 && clickFreq >= 12) {
        persona = 'Micro-Scalper';
        confidence = Math.min(0.99, 0.7 + clickFreq * 0.02);
      } else if (this.timeInTradeSec >= 120 && this.timeInTradeSec < 14400) {
        persona = 'Intraday Momentum';
        confidence = 0.88;
      } else {
        persona = 'Positional Quant';
        confidence = 0.92;
      }
    }

    // Allocate GPU compute threads based on persona
    let gpuAllocation = {
      bookRasterization: 0.90,
      monteCarloCompute: 0.05,
      sqlColumnarEngine: 0.05,
    };

    if (persona === 'Intraday Momentum') {
      gpuAllocation = {
        bookRasterization: 0.45,
        monteCarloCompute: 0.35,
        sqlColumnarEngine: 0.20,
      };
    } else if (persona === 'Positional Quant') {
      gpuAllocation = {
        bookRasterization: 0.10,
        monteCarloCompute: 0.50,
        sqlColumnarEngine: 0.40,
      };
    }

    this.onTelemetryUpdate({
      timeInTradeSec: Math.round(this.timeInTradeSec),
      clickFrequencyPerMin: clickFreq,
      zoomIntervalSec: Math.round(this.zoomIntervalSec),
      indicatorUsageCount: this.indicatorUsageCount,
      cursorHoverVelocity: Math.round(this.cursorVelocity),
      activePersona: persona,
      personaConfidence: Math.round(confidence * 100) / 100,
      gpuThreadAllocation: gpuAllocation,
    });
  }
}
