export type ReplayMode = 'LIVE' | 'PAUSED' | 'REPLAYING';

export interface ReplayState {
  mode: ReplayMode;
  currentIndex: number;
  totalRecords: number;
  currentTimestamp: number;
  speed: number;
}

export class ReplayEngine {
  private mode: ReplayMode = 'LIVE';
  private currentIndex = 0;
  private speed = 1.0;
  private interval: any = null;
  private onStateChange: (state: ReplayState) => void;
  private onTickReplay: (tick: any) => void;

  constructor(
    onStateChange: (state: ReplayState) => void,
    onTickReplay: (tick: any) => void
  ) {
    this.onStateChange = onStateChange;
    this.onTickReplay = onTickReplay;
  }

  public pause(totalCount: number, currentTs: number): void {
    this.mode = 'PAUSED';
    this.currentIndex = Math.max(0, totalCount - 1);
    this.stopPlayback();
    this.emitState(totalCount, currentTs);
  }

  public resumeLive(totalCount: number, currentTs: number): void {
    this.mode = 'LIVE';
    this.stopPlayback();
    this.emitState(totalCount, currentTs);
  }

  public startReplay(
    ticks: any[],
    startIndex?: number
  ): void {
    if (ticks.length === 0) return;
    this.mode = 'REPLAYING';
    this.currentIndex = startIndex ?? 0;
    this.stopPlayback();

    const delayMs = Math.max(20, 100 / this.speed);
    this.interval = setInterval(() => {
      if (this.currentIndex >= ticks.length - 1) {
        this.pause(ticks.length, ticks[ticks.length - 1].timestamp);
        return;
      }

      this.currentIndex++;
      const currentTick = ticks[this.currentIndex];
      this.onTickReplay(currentTick);
      this.emitState(ticks.length, currentTick.timestamp);
    }, delayMs);
  }

  public seek(index: number, ticks: any[]): void {
    if (index < 0 || index >= ticks.length) return;
    this.currentIndex = index;
    const currentTick = ticks[index];
    this.onTickReplay(currentTick);
    this.emitState(ticks.length, currentTick.timestamp);
  }

  public setSpeed(speed: number, ticks: any[]): void {
    this.speed = speed;
    if (this.mode === 'REPLAYING') {
      this.startReplay(ticks, this.currentIndex);
    }
  }

  private stopPlayback(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private emitState(total: number, ts: number): void {
    this.onStateChange({
      mode: this.mode,
      currentIndex: this.currentIndex,
      totalRecords: total,
      currentTimestamp: ts,
      speed: this.speed,
    });
  }

  public destroy(): void {
    this.stopPlayback();
  }
}
