import { BinanceStreamManager } from './binance_stream';
import { SyntheticL3Injector, L3SimulationState } from './synthetic_l3';
import { AetherWasmBridge } from '../wasm/wasm_bridge';
import { OrderBookL2, MarketTick } from '../types/market';

export interface MarketStateSnapshot {
  orderBook: OrderBookL2 | null;
  recentTrades: MarketTick[];
  l3State: L3SimulationState | null;
  wasmMetrics: ReturnType<AetherWasmBridge['getMetrics']>;
  connectionStatus: 'connected' | 'connecting' | 'reconnecting' | 'offline';
  latencyMs: number;
}

export type MarketListener = (snapshot: MarketStateSnapshot) => void;

export class FeedCoordinator {
  private streamManager: BinanceStreamManager;
  private l3Injector: SyntheticL3Injector;
  private wasmBridge: AetherWasmBridge;
  private listeners: Set<MarketListener> = new Set();

  private currentBook: OrderBookL2 | null = null;
  private trades: MarketTick[] = [];
  private l3State: L3SimulationState | null = null;
  private status: 'connected' | 'connecting' | 'reconnecting' | 'offline' = 'connecting';
  private latencyMs = 0;

  constructor(symbol = 'btcusdt') {
    this.wasmBridge = new AetherWasmBridge(4096);
    this.l3Injector = new SyntheticL3Injector();

    this.streamManager = new BinanceStreamManager(symbol, {
      onOrderBook: (book) => this.handleOrderBook(book),
      onTrade: (trade) => this.handleTrade(trade),
      onStatusChange: (status, latency) => {
        this.status = status;
        this.latencyMs = latency;
        this.notify();
      },
    });

    this.streamManager.connect();
  }

  public getWasmBridge(): AetherWasmBridge {
    return this.wasmBridge;
  }

  private handleOrderBook(book: OrderBookL2): void {
    this.currentBook = book;

    // 1. Ingest into WASM Ring Buffer & compute Micro-price / OFI
    if (book.bids.length > 0 && book.asks.length > 0) {
      this.wasmBridge.pushDepthEvent(
        book.bestBid,
        book.bids[0].quantity,
        book.bestAsk,
        book.asks[0].quantity,
        book.timestamp * 1_000_000
      );
    }

    // 2. Feed into Simulated L3 Injector
    this.l3State = this.l3Injector.updateFromL2(book);

    this.notify();
  }

  private handleTrade(trade: MarketTick): void {
    this.trades.unshift(trade);
    if (this.trades.length > 100) this.trades.pop();

    // Ingest into WASM Ring Buffer & compute Kyle's Lambda / Queue Priority
    this.wasmBridge.pushTradeEvent(
      trade.price,
      trade.quantity,
      trade.side,
      trade.timestamp * 1_000_000
    );

    this.notify();
  }

  public subscribe(listener: MarketListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  public setSymbol(symbol: string): void {
    this.trades = [];
    this.currentBook = null;
    this.streamManager.setSymbol(symbol);
  }

  public getSnapshot(): MarketStateSnapshot {
    return {
      orderBook: this.currentBook,
      recentTrades: this.trades,
      l3State: this.l3State,
      wasmMetrics: this.wasmBridge.getMetrics(),
      connectionStatus: this.status,
      latencyMs: this.latencyMs,
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  public destroy(): void {
    this.listeners.clear();
    this.streamManager.destroy();
  }
}
