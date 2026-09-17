export type OrderSide = 'buy' | 'sell';

export interface PriceLevel {
  price: number;
  quantity: number;
  count?: number;
}

export interface OrderBookL2 {
  symbol: string;
  timestamp: number;
  bids: PriceLevel[]; // sorted descending by price
  asks: PriceLevel[]; // sorted ascending by price
  bestBid: number;
  bestAsk: number;
  spread: number;
  midPrice: number;
}

export type L3EventType = 'ADD' | 'MODIFY' | 'CANCEL' | 'EXECUTE';

export interface L3Order {
  orderId: string;
  price: number;
  size: number;
  side: OrderSide;
  timestamp: number; // microsecond unix timestamp
  priorityRank: number; // position in queue at this price level
  isSimulated: true;
  isSpoofCandidate?: boolean;
}

export interface MarketTick {
  tradeId: number | string;
  symbol: string;
  price: number;
  quantity: number;
  side: OrderSide;
  timestamp: number;
  isBuyerMaker: boolean;
}

export interface MicrostructureMetrics {
  microPrice: number;
  ofi: number; // Order Flow Imbalance
  kylesLambda: number; // Price impact parameter
  shannonEntropy: number; // Order flow randomness
  spoofingRiskIndex: number; // 0.0 to 1.0 (Simulated L3)
  cvd: number; // Cumulative Volume Delta
  cvdDivergence: number; // Divergence score
  queuePriorityEstimate: number; // FIFO estimated queue position
  hawkesIntensity: number; // Cascade intensity
  hawkesIsCascade: boolean; // >= 1.0
  hurstExponent: number; // < 0.5 mean-revert, > 0.5 trending
  isingPhaseIndex: number; // Magnetization/order parameter (-1 to +1)
  markovState: 'Trending' | 'Mean-Reverting' | 'Volatile-Breakout';
  liquidityGravityVector: { price: number; force: number };
  vpin?: number; // Volume-Synchronized Probability of Toxicity
  rollSpread?: number; // Roll (1984) serial covariance spread
  avellanedaReservation?: number; // Avellaneda-Stoikov indifference price
  kalmanPrice?: number; // Kalman recursive price estimate
  garchVariance?: number; // GARCH(1,1) conditional variance
}

export type TraderPersona = 'Micro-Scalper' | 'Intraday Momentum' | 'Positional Quant';

export interface TelemetryMetrics {
  timeInTradeSec: number;
  clickFrequencyPerMin: number;
  zoomIntervalSec: number;
  indicatorUsageCount: number;
  cursorHoverVelocity: number;
  activePersona: TraderPersona;
  personaConfidence: number; // 0.0 to 1.0
  gpuThreadAllocation: {
    bookRasterization: number; // 0.0 to 1.0
    monteCarloCompute: number;
    sqlColumnarEngine: number;
  };
}

export type IndicatorCategory =
  | 'Microstructure/Depth'
  | 'Point Processes/Regimes'
  | 'Spatial Probability/ML'
  | 'Auction Theory/Structure'
  | 'Trend/Momentum';

export interface IndicatorSpec {
  id: string;
  name: string;
  plane: IndicatorCategory;
  description: string;
  currentValue: string | number;
  status: 'active' | 'warning' | 'neutral';
  color: string;
  unit?: string;
}
