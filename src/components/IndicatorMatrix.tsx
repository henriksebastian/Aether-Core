import React, { useState } from 'react';
import { IndicatorSpec, IndicatorCategory } from '../types/market';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

interface IndicatorMatrixProps {
  indicators: IndicatorSpec[];
  onIndicatorClick?: (id: string) => void;
  activePersona: string;
}

const PLANES: (IndicatorCategory | 'ALL (22)')[] = [
  'ALL (22)',
  'Microstructure/Depth',
  'Point Processes/Regimes',
  'Spatial Probability/ML',
  'Auction Theory/Structure',
  'Trend/Momentum',
];

export const IndicatorMatrix: React.FC<IndicatorMatrixProps> = ({
  indicators,
  onIndicatorClick,
  activePersona,
}) => {
  const [selectedPlane, setSelectedPlane] = useState<IndicatorCategory | 'ALL (22)'>('ALL (22)');

  const filtered =
    selectedPlane === 'ALL (22)'
      ? indicators
      : indicators.filter((ind) => ind.plane === selectedPlane);

  return (
    <div className="h-64 border-t border-white/10 bg-[#06090e] flex flex-col select-none">
      {/* Plane Switcher Tabs */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-[#0b1018]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {PLANES.map((plane) => {
            const count =
              plane === 'ALL (22)'
                ? indicators.length
                : indicators.filter((i) => i.plane === plane).length;

            return (
              <button
                key={plane}
                onClick={() => setSelectedPlane(plane)}
                className={`px-2.5 py-1 text-[11px] font-mono rounded flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  selectedPlane === plane
                    ? 'bg-white/10 text-cyan font-bold border border-cyan/40 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{plane}</span>
                <span className="text-[9px] px-1 rounded bg-black/40 text-gray-400">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="text-[10px] font-mono text-gray-400">
          Target Engine: <strong className="text-white">{activePersona}</strong>
        </div>
      </div>

      {/* Indicator Card Grid */}
      <div className="flex-1 p-3 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {filtered.map((ind) => {
          const isWarning = ind.status === 'warning';

          return (
            <div
              key={ind.id}
              onClick={() => onIndicatorClick?.(ind.id)}
              className={`p-2 rounded bg-[#0b1018]/80 border transition-all cursor-pointer hover:border-white/30 flex flex-col justify-between ${
                isWarning
                  ? 'border-rose-500/50 bg-rose-500/5'
                  : 'border-white/5 hover:bg-[#111823]'
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className="text-[11px] font-display font-medium text-slate-200 line-clamp-1">
                  {ind.name}
                </span>
                {isWarning ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose flex-shrink-0 animate-pulse" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                )}
              </div>

              <div className="my-0.5">
                <div
                  className="font-mono text-sm font-bold tracking-wide"
                  style={{ color: ind.color }}
                >
                  {ind.currentValue}
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-gray-500 border-t border-white/5 pt-1 mt-1">
                <span className="truncate">{ind.plane.split('/')[0]}</span>
                <Info className="w-2.5 h-2.5 hover:text-white" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
