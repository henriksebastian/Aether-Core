import React, { useState } from 'react';
import { MonteCarloForecast } from '../indicators/monte_carlo';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  Target,
  Maximize2,
  Minimize2,
  Sliders,
  DollarSign,
  Activity,
  AlertCircle,
  Lock,
  Percent,
} from 'lucide-react';

export type RiskTier = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM';
export type SizingModel = 'KELLY' | 'VOL_ADJUSTED' | 'FIXED';

export interface ActiveSimPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  notionalUSD: number;
  targetTP: number;
  targetSL: number;
  leverage: number;
  timestamp: number;
  isBreakevenLocked?: boolean;
}

interface SignalPositionHUDProps {
  symbol: string;
  spotPrice: number;
  microPrice: number;
  ofi: number;
  mcForecast: MonteCarloForecast | null;
  activePosition: ActiveSimPosition | null;
  onExecuteTrade: (
    side: 'LONG' | 'SHORT',
    quantity: number,
    notionalUSD: number,
    tp: number,
    sl: number,
    leverage: number
  ) => void;
  onClosePosition: () => void;
  onLockBreakeven?: () => void;
  onUpdateTPSL?: (tp: number, sl: number) => void;
}

export const SignalPositionHUD: React.FC<SignalPositionHUDProps> = ({
  symbol,
  spotPrice,
  microPrice,
  ofi,
  mcForecast,
  activePosition,
  onExecuteTrade,
  onClosePosition,
  onLockBreakeven,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'EXECUTE' | 'TARGETS' | 'KELLY'>('EXECUTE');
  const [riskTier, setRiskTier] = useState<RiskTier>('BALANCED');
  const [sizingModel, setSizingModel] = useState<SizingModel>('KELLY');
  const [customLeverage, setCustomLeverage] = useState(3);
  const [customTP, setCustomTP] = useState<number | null>(null);
  const [customSL, setCustomSL] = useState<number | null>(null);

  const unit = symbol.replace('USDT', '');

  // Dynamic Multiplier based on Risk Tier
  const tierMultiplier =
    riskTier === 'CONSERVATIVE' ? 0.5 : riskTier === 'BALANCED' ? 1.0 : riskTier === 'AGGRESSIVE' ? 2.0 : customLeverage / 2.5;

  // Base Notional calculation depending on chosen Sizing Model
  const baseNotional = mcForecast?.recommendedSize.notionalUSD || 25000;
  let computedNotional = baseNotional * tierMultiplier;
  if (sizingModel === 'VOL_ADJUSTED' && mcForecast) {
    const volDampener = Math.max(0.4, Math.min(2.0, 35 / (mcForecast.realizedVolatility || 35)));
    computedNotional = computedNotional * volDampener;
  } else if (sizingModel === 'FIXED') {
    computedNotional = symbol.startsWith('BTC') ? 25000 : symbol.startsWith('ETH') ? 12000 : 8000;
  }

  computedNotional = Math.round(computedNotional);
  const computedQuantity = spotPrice > 0 ? Math.round((computedNotional / spotPrice) * 1000) / 1000 : 0;

  const currentTP = customTP ?? mcForecast?.targetTP ?? spotPrice * 1.015;
  const currentSL = customSL ?? mcForecast?.targetSL ?? spotPrice * 0.985;

  // Calculate Unrealized PnL if a position is open
  const activePnL = React.useMemo(() => {
    if (!activePosition || !spotPrice) return null;
    const isLong = activePosition.side === 'LONG';
    const priceDelta = isLong ? spotPrice - activePosition.entryPrice : activePosition.entryPrice - spotPrice;
    const pnlUSD = priceDelta * activePosition.quantity;
    const pnlPct = (priceDelta / activePosition.entryPrice) * 100 * activePosition.leverage;
    return {
      pnlUSD,
      pnlPct,
      isProfit: pnlUSD >= 0,
    };
  }, [activePosition, spotPrice]);

  const signal = mcForecast?.signal || 'NEUTRAL';
  const confidence = mcForecast?.confidence || 60;
  const isBuy = signal.includes('BUY');
  const isSell = signal.includes('SELL');

  const signalColor = isBuy ? 'text-[#089981]' : isSell ? 'text-[#f23645]' : 'text-[#f59e0b]';
  const signalBg = isBuy ? 'bg-[#089981]' : isSell ? 'bg-[#f23645]' : 'bg-[#f59e0b]';

  return (
    <div className="absolute left-3 top-3 bg-[#0a0f19]/95 border border-[#1b253b] shadow-2xl rounded font-mono text-[10px] w-80 select-none backdrop-blur-md pointer-events-auto z-20 transition-all">
      {/* 1. Header Bar: Live Signal Beacon & Quick Minimizer */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1b253b] bg-[#0f172a]/90 rounded-t">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${signalBg} ${activePosition ? 'animate-ping' : 'animate-pulse'}`} />
          <span className="text-[#64748b] text-[9px] font-bold tracking-wider">
            {activePosition ? 'LIVE POSITION' : 'ALPHA SIGNAL'}
          </span>
          <span className={`font-bold tracking-wide text-[11px] ${activePosition ? (activePosition.side === 'LONG' ? 'text-[#089981]' : 'text-[#f23645]') : signalColor}`}>
            {activePosition
              ? `${activePosition.side} ${activePosition.quantity} ${unit} (${activePosition.leverage}x)`
              : signal}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!activePosition && mcForecast && (
            <span className="text-[9px] px-1.5 py-0.5 bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/30 rounded font-bold">
              {confidence}% CONF
            </span>
          )}
          <button
            onClick={() => setIsMinimized((v) => !v)}
            className="p-1 text-[#64748b] hover:text-[#dee2f1] hover:bg-[#1b253b] rounded transition-colors"
            title={isMinimized ? 'Expand HUD' : 'Minimize HUD'}
          >
            {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-2.5 space-y-2">
          {/* Active Position Live Dashboard */}
          {activePosition && activePnL ? (
            <div className="p-2 bg-[#0d1424] border border-[#1b253b] rounded space-y-2">
              {/* Unrealized PnL Counter */}
              <div className="flex justify-between items-center bg-[#090d16] p-2 rounded border border-[#182238]">
                <span className="text-[#64748b] text-[9px] font-bold tracking-wider">UNREALIZED PnL:</span>
                <span className={`text-[13px] font-extrabold font-mono flex items-center gap-1 ${activePnL.isProfit ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                  {activePnL.pnlUSD >= 0 ? '+' : ''}${activePnL.pnlUSD.toFixed(2)}
                  <span className="text-[10px] font-normal">
                    ({activePnL.pnlPct >= 0 ? '+' : ''}{activePnL.pnlPct.toFixed(2)}%)
                  </span>
                </span>
              </div>

              {/* Position Telemetry Matrix */}
              <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                <div className="bg-[#090d16] p-1.5 rounded border border-[#182238]">
                  <span className="text-[#64748b] block">ENTRY PRICE:</span>
                  <span className="text-[#dee2f1] font-bold">${activePosition.entryPrice.toFixed(2)}</span>
                </div>
                <div className="bg-[#090d16] p-1.5 rounded border border-[#182238]">
                  <span className="text-[#64748b] block">CURRENT MARK:</span>
                  <span className="text-[#dee2f1] font-bold">${spotPrice.toFixed(2)}</span>
                </div>
                <div className="bg-[#090d16] p-1.5 rounded border border-[#182238]">
                  <span className="text-[#64748b] block">TARGET TP:</span>
                  <span className="text-[#089981] font-bold">${activePosition.targetTP.toFixed(2)}</span>
                </div>
                <div className="bg-[#090d16] p-1.5 rounded border border-[#182238]">
                  <span className="text-[#64748b] block">STOP LOSS:</span>
                  <span className="text-[#f23645] font-bold">${activePosition.targetSL.toFixed(2)}</span>
                </div>
              </div>

              {/* Breakeven Lock & Market Close Buttons */}
              <div className="flex gap-1.5 pt-1">
                {onLockBreakeven && (
                  <button
                    onClick={onLockBreakeven}
                    className={`flex-1 py-1 px-1.5 text-[9px] font-bold border rounded transition-colors flex items-center justify-center gap-1 ${activePosition.isBreakevenLocked
                        ? 'bg-[#089981]/20 border-[#089981] text-[#089981]'
                        : 'bg-[#1b253b] border-[#2a3854] text-[#94a3b8] hover:text-[#dee2f1]'
                      }`}
                  >
                    <Lock size={10} />
                    {activePosition.isBreakevenLocked ? 'BE LOCKED' : 'LOCK BREAKEVEN'}
                  </button>
                )}
                <button
                  onClick={onClosePosition}
                  className="flex-1 py-1 px-1.5 text-[9px] font-bold bg-[#f23645]/20 text-[#f23645] border border-[#f23645]/60 hover:bg-[#f23645]/30 rounded transition-colors uppercase tracking-wider"
                >
                  MARKET CLOSE
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Navigation Tabs for HUD */}
              <div className="flex border-b border-[#1b253b] text-[9px]">
                <button
                  onClick={() => setActiveTab('EXECUTE')}
                  className={`flex-1 py-1 font-bold border-b-2 transition-colors ${activeTab === 'EXECUTE' ? 'border-[#06b6d4] text-[#06b6d4] bg-[#06b6d4]/10' : 'border-transparent text-[#64748b] hover:text-[#dee2f1]'
                    }`}
                >
                  SIZING & ORDER
                </button>
                <button
                  onClick={() => setActiveTab('TARGETS')}
                  className={`flex-1 py-1 font-bold border-b-2 transition-colors ${activeTab === 'TARGETS' ? 'border-[#06b6d4] text-[#06b6d4] bg-[#06b6d4]/10' : 'border-transparent text-[#64748b] hover:text-[#dee2f1]'
                    }`}
                >
                  QUANT TP/SL
                </button>
                <button
                  onClick={() => setActiveTab('KELLY')}
                  className={`flex-1 py-1 font-bold border-b-2 transition-colors ${activeTab === 'KELLY' ? 'border-[#06b6d4] text-[#06b6d4] bg-[#06b6d4]/10' : 'border-transparent text-[#64748b] hover:text-[#dee2f1]'
                    }`}
                >
                  KELLY MATRIX
                </button>
              </div>

              {/* TAB 1: SIZING & EXECUTE */}
              {activeTab === 'EXECUTE' && (
                <div className="space-y-2">
                  {/* Risk Profile & Leverage Selector */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-[#64748b] flex items-center gap-1">
                        <Shield size={10} /> RISK PROFILE:
                      </span>
                      <div className="flex gap-1">
                        {(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE', 'CUSTOM'] as RiskTier[]).map((tier) => (
                          <button
                            key={tier}
                            onClick={() => setRiskTier(tier)}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-colors ${riskTier === tier
                                ? 'bg-[#06b6d4]/20 text-[#06b6d4] border-[#06b6d4]'
                                : 'text-[#64748b] border-[#1b253b] hover:text-[#94a3b8]'
                              }`}
                          >
                            {tier === 'CONSERVATIVE' ? '1x' : tier === 'BALANCED' ? '2.5x' : tier === 'AGGRESSIVE' ? '5x' : `${customLeverage}x`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {riskTier === 'CUSTOM' && (
                      <div className="flex items-center gap-2 bg-[#090d16] p-1.5 rounded border border-[#182238]">
                        <span className="text-[#64748b] text-[8px]">LEVERAGE: {customLeverage}x</span>
                        <input
                          type="range"
                          min="1"
                          max="20"
                          step="1"
                          value={customLeverage}
                          onChange={(e) => setCustomLeverage(parseInt(e.target.value, 10))}
                          className="flex-1 accent-[#06b6d4] h-1 bg-[#1b253b] rounded cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Sizing Algorithm Selector */}
                  <div className="flex justify-between items-center text-[9px] bg-[#090d16] p-1.5 rounded border border-[#182238]">
                    <span className="text-[#64748b] flex items-center gap-1">
                      <Sliders size={10} /> SIZING ALGO:
                    </span>
                    <div className="flex gap-1">
                      {(['KELLY', 'VOL_ADJUSTED', 'FIXED'] as SizingModel[]).map((model) => (
                        <button
                          key={model}
                          onClick={() => setSizingModel(model)}
                          className={`px-1 py-0.5 text-[8px] rounded border transition-colors ${sizingModel === model
                              ? 'bg-[#1b253b] text-[#dee2f1] border-[#06b6d4]'
                              : 'text-[#64748b] border-[#182238] hover:text-[#94a3b8]'
                            }`}
                        >
                          {model === 'KELLY' ? 'Kelly' : model === 'VOL_ADJUSTED' ? 'Vol-Parity' : 'Fixed'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calculated Recommendation Box */}
                  <div className="bg-[#090d16] p-2 rounded border border-[#182238] space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#64748b]">REC. QUANTITY:</span>
                      <span className="text-[#dee2f1] font-bold font-mono">
                        {computedQuantity} {unit}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#64748b]">TARGET NOTIONAL:</span>
                      <span className="text-[#06b6d4] font-bold font-mono">
                        ${computedNotional.toLocaleString()} USD
                      </span>
                    </div>
                    <div className="flex justify-between text-[9px] text-[#64748b]">
                      <span>MAX RISK AT SL:</span>
                      <span className="text-[#f23645] font-mono">
                        -${mcForecast ? Math.round(computedQuantity * (spotPrice - mcForecast.targetSL)).toLocaleString() : '0'} USD
                      </span>
                    </div>
                  </div>

                  {/* One-Click Simulated Execution Buttons */}
                  <div className="flex gap-1.5 pt-1">
                    <button
                      onClick={() =>
                        onExecuteTrade(
                          'LONG',
                          computedQuantity,
                          computedNotional,
                          currentTP,
                          currentSL,
                          riskTier === 'CONSERVATIVE' ? 1 : riskTier === 'BALANCED' ? 2.5 : riskTier === 'AGGRESSIVE' ? 5 : customLeverage
                        )
                      }
                      className="flex-1 py-1.5 text-[10px] font-extrabold bg-[#089981]/25 text-[#089981] border border-[#089981]/70 hover:bg-[#089981]/40 rounded transition-all shadow-lg flex items-center justify-center gap-1 uppercase"
                    >
                      <Zap size={11} /> LONG {computedQuantity} {unit}
                    </button>
                    <button
                      onClick={() =>
                        onExecuteTrade(
                          'SHORT',
                          computedQuantity,
                          computedNotional,
                          currentTP,
                          currentSL,
                          riskTier === 'CONSERVATIVE' ? 1 : riskTier === 'BALANCED' ? 2.5 : riskTier === 'AGGRESSIVE' ? 5 : customLeverage
                        )
                      }
                      className="flex-1 py-1.5 text-[10px] font-extrabold bg-[#f23645]/25 text-[#f23645] border border-[#f23645]/70 hover:bg-[#f23645]/40 rounded transition-all shadow-lg flex items-center justify-center gap-1 uppercase"
                    >
                      <Zap size={11} /> SHORT {computedQuantity} {unit}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: QUANT TARGETS & PROBABILITY */}
              {activeTab === 'TARGETS' && mcForecast && (
                <div className="space-y-1.5">
                  <div className="bg-[#090d16] p-2 rounded border border-[#182238] space-y-1 text-[10px]">
                    {/* 1. ENTRY */}
                    <div className="flex justify-between items-center pb-1 border-b border-[#182238]">
                      <span className="text-[#06b6d4] font-bold flex items-center gap-1">
                        🎯 1. WHERE TO ENTER (SPOT):
                      </span>
                      <span className="text-[#dee2f1] font-mono font-bold">${spotPrice.toFixed(2)}</span>
                    </div>

                    {/* 2. STOP LOSS */}
                    <div className="flex justify-between items-center text-[#f23645]">
                      <span className="flex items-center gap-1 font-bold">
                        🛑 2. STOP LOSS (-1R RISK):
                      </span>
                      <span className="font-bold font-mono">
                        ${mcForecast.targetSL.toFixed(2)}{' '}
                        <span className="text-[9px] font-normal">(-${mcForecast.riskLossUSD.toFixed(2)} / -{mcForecast.riskLossPct.toFixed(2)}%)</span>
                      </span>
                    </div>

                    {/* 3. TAKE PROFIT EXIT */}
                    <div className="flex justify-between items-center text-[#089981]">
                      <span className="flex items-center gap-1 font-bold">
                        💰 3. WHERE TO EXIT (+3R TARGET):
                      </span>
                      <span className="font-bold font-mono">
                        ${mcForecast.targetTP.toFixed(2)}{' '}
                        <span className="text-[9px] font-normal">(+${mcForecast.expectedGainUSD.toFixed(2)} / +{mcForecast.expectedGainPct.toFixed(2)}%)</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                    <div className="bg-[#090d16] p-1.5 rounded border border-[#182238] flex justify-between items-center">
                      <span className="text-[#64748b]">R:R RATIO:</span>
                      <span className="text-[#089981] font-extrabold font-mono">{mcForecast.riskRewardRatio.toFixed(2)} : 1 (MIN 3R)</span>
                    </div>
                    <div className="bg-[#090d16] p-1.5 rounded border border-[#182238] flex justify-between items-center">
                      <span className="text-[#64748b]">WIN PROB:</span>
                      <span className="text-[#089981] font-bold font-mono">{(mcForecast.winProbability * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Microstructure Drift & OFI telemetry */}
                  <div className="bg-[#090d16] p-1.5 rounded border border-[#182238] text-[9px] space-y-0.5">
                    <div className="flex justify-between text-[#64748b]">
                      <span>MICRO-PRICE DELTA:</span>
                      <span className={microPrice >= spotPrice ? 'text-[#089981]' : 'text-[#f23645]'}>
                        {(microPrice - spotPrice >= 0 ? '+' : '')}${(microPrice - spotPrice).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#64748b]">
                      <span>OFI DRIFT COEFFICIENT:</span>
                      <span className="text-[#06b6d4]">{mcForecast.microDrift > 0 ? '+' : ''}{mcForecast.microDrift}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: KELLY CRITERION & VOLATILITY */}
              {activeTab === 'KELLY' && mcForecast && (
                <div className="space-y-1.5 text-[9px]">
                  <div className="bg-[#090d16] p-2 rounded border border-[#182238] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">OPTIMAL KELLY f*:</span>
                      <span className="text-[#06b6d4] font-bold font-mono">{mcForecast.kellyFraction}% of Equity</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">REALIZED VOLATILITY (σ):</span>
                      <span className="text-[#dee2f1] font-mono">{mcForecast.realizedVolatility}% Ann.</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">PROJECTED SHARPE:</span>
                      <span className="text-[#089981] font-bold font-mono">{mcForecast.projectedSharpe}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">SIMULATION PATHS:</span>
                      <span className="text-[#94a3b8] font-mono">3,000 paths (Polar-Marsaglia)</span>
                    </div>
                  </div>

                  <div className="p-1.5 bg-[#06b6d4]/10 border border-[#06b6d4]/30 rounded text-[8px] text-[#94a3b8] leading-tight">
                    <span className="text-[#06b6d4] font-bold block mb-0.5">ℹ️ QUANTITATIVE SIZING NOTE:</span>
                    Sizes are calibrated using a half-Kelly safety boundary f* = (b·p - q) / (2b) combined with live order book OFI pressure and jump-diffusion variance.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
