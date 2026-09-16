import { L3Order, OrderBookL2 } from '../types/market';

export interface L3SimulationState {
  orders: L3Order[];
  spoofingRiskIndex: number;
  recentCancelsCount: number;
  simulatedQueueDepth: number;
  activeSpoofCandidates: number;
}

export class SyntheticL3Injector {
  private orders: Map<string, L3Order> = new Map();
  private spoofRiskScore = 0.12;
  private cancelTimestamps: number[] = [];
  private orderCounter = 1000;

  /**
   * Sync synthetic L3 order queues with live L2 price levels
   */
  public updateFromL2(book: OrderBookL2): L3SimulationState {
    const now = Date.now();
    const activeOrders: L3Order[] = [];

    // Clean old cancelled events older than 3 seconds
    this.cancelTimestamps = this.cancelTimestamps.filter((t) => now - t < 3000);

    // 1. Maintain realistic synthetic queue at top 5 Bid levels
    for (let level = 0; level < Math.min(5, book.bids.length); level++) {
      const p = book.bids[level].price;
      const totalVol = book.bids[level].quantity;
      const orderCount = Math.max(1, Math.min(6, Math.floor(totalVol / 0.8)));

      for (let rank = 0; rank < orderCount; rank++) {
        const id = `sim-b-${p.toFixed(2)}-${rank}`;
        const size = Math.round((totalVol / orderCount) * 1000) / 1000;
        const order: L3Order = {
          orderId: id,
          price: p,
          size,
          side: 'buy',
          timestamp: now * 1000 - (orderCount - rank) * 150_000,
          priorityRank: rank + 1,
          isSimulated: true,
        };
        this.orders.set(id, order);
        activeOrders.push(order);
      }
    }

    // 2. Maintain realistic synthetic queue at top 5 Ask levels
    for (let level = 0; level < Math.min(5, book.asks.length); level++) {
      const p = book.asks[level].price;
      const totalVol = book.asks[level].quantity;
      const orderCount = Math.max(1, Math.min(6, Math.floor(totalVol / 0.8)));

      for (let rank = 0; rank < orderCount; rank++) {
        const id = `sim-a-${p.toFixed(2)}-${rank}`;
        const size = Math.round((totalVol / orderCount) * 1000) / 1000;
        const order: L3Order = {
          orderId: id,
          price: p,
          size,
          side: 'sell',
          timestamp: now * 1000 - (orderCount - rank) * 150_000,
          priorityRank: rank + 1,
          isSimulated: true,
        };
        this.orders.set(id, order);
        activeOrders.push(order);
      }
    }

    // 3. Inject Spoofing Pattern (Flash large mock order and rapid cancel)
    let activeSpoofs = 0;
    if (Math.random() < 0.15) {
      this.orderCounter++;
      const isBidSpoof = Math.random() > 0.5;
      const spoofPrice = isBidSpoof ? book.bestBid - 0.5 : book.bestAsk + 0.5;
      const spoofSize = Math.round((8.0 + Math.random() * 15.0) * 10) / 10;
      const spoofId = `sim-spoof-${this.orderCounter}`;

      const spoofOrder: L3Order = {
        orderId: spoofId,
        price: spoofPrice,
        size: spoofSize,
        side: isBidSpoof ? 'buy' : 'sell',
        timestamp: now * 1000,
        priorityRank: 1,
        isSimulated: true,
        isSpoofCandidate: true,
      };

      activeOrders.push(spoofOrder);
      this.cancelTimestamps.push(now);
      activeSpoofs++;

      // Elevate spoof risk
      this.spoofRiskScore = Math.min(0.98, this.spoofRiskScore + 0.18);
    } else {
      // Natural decay of spoofing risk index
      this.spoofRiskScore = Math.max(0.04, this.spoofRiskScore * 0.94);
    }

    return {
      orders: activeOrders.slice(0, 40),
      spoofingRiskIndex: Math.round(this.spoofRiskScore * 100) / 100,
      recentCancelsCount: this.cancelTimestamps.length,
      simulatedQueueDepth: activeOrders.length,
      activeSpoofCandidates: activeSpoofs,
    };
  }
}
