import React, { useState } from 'react';
import { IndicatorSpec, IndicatorCategory } from '../types/market';
import { AlertCircle, CheckCircle, Info, ChevronDown, ChevronUp, Layers } from 'lucide-react';

interface IndicatorMatrixProps {
  indicators: IndicatorSpec[];
  onIndicatorClick?: (id: string) => void;
  activePersona: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [selectedPlane, setSelectedPlane] = useState<IndicatorCategory | 'ALL (22)'>('ALL (22)');

  const filtered =
    selectedPlane === 'ALL (22)'
      ? indicators
      : indicators.filter((ind) => ind.plane === selectedPlane);

  if (isCollapsed) {
    return (
      <div className="h-7 border-t border-[#1b2232] bg-[#0e131d] px-3 flex items-center justify-between font-mono text-[10px] select-none shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-1 text-[#06b6d4] font-bold hover:text-[#dee2f1] transition-colors"
          >
            <ChevronUp size={12} />
            <span>22-INDICATOR QUANT MATRIX</span>
          </button>
          <span className="text-[#64748b]">| Active Persona: <strong className="text-[#dee2f1]">{activePersona}</strong></span>
        </div>

        <button
          onClick={onToggleCollapse}
          className="px-2 py-0.5 text-[9px] bg-[#1b202a] text-[#94a3b8] hover:text-[#dee2f1] border border-[#1b2232] rounded-sm transition-colors"
        >
          EXPAND MATRIX [▲]
        </button>
      </div>
    );
  }

  return (
    <div className="h-48 border-t border-[#1b2232] bg-[#090e18] flex flex-col select-none font-mono text-[11px] shrink-0 transition-all">
      {/* Plane Switcher Tabs Header */}
      <div className="flex items-center justify-between px-3 h-7 border-b border-[#1b2232] bg-[#0e131d]">
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
                className={`px-2 py-0.5 text-[10px] flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  selectedPlane === plane
                    ? 'bg-[#1b202a] text-[#089981] font-bold border-b-2 border-[#089981]'
                    : 'text-[#94a3b8] hover:text-[#dee2f1] hover:bg-[#141a26]'
                }`}
              >
                <span>{plane}</span>
                <span className="text-[9px] px-1 bg-[#090e18] text-[#64748b] border border-[#1b2232]">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          <div className="text-[#64748b]">
            PRIORITY: <strong className="text-[#06b6d4]">{activePersona.toUpperCase()}</strong>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-0.5 text-[#64748b] hover:text-[#dee2f1] border border-[#1b2232] rounded-sm"
              title="Collapse Indicator Matrix (Unclutter View)"
            >
              <ChevronDown size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Indicator Card Grid */}
      <div className="flex-1 p-2.5 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1.5">
        {filtered.map((ind) => {
          const isWarning = ind.status === 'warning';

          return (
            <div
              key={ind.id}
              onClick={() => onIndicatorClick?.(ind.id)}
              className={`p-2 bg-[#0e131d] border transition-colors cursor-pointer flex flex-col justify-between ${
                isWarning
                  ? 'border-[#f23645]/60 bg-[#f23645]/5'
                  : 'border-[#1b2232] hover:border-[#06b6d4]/50 hover:bg-[#141a26]'
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className="text-[10px] font-bold text-[#dee2f1] truncate">
                  {ind.name}
                </span>
                {isWarning ? (
                  <AlertCircle className="w-3 h-3 text-[#f23645] flex-shrink-0 animate-pulse" />
                ) : (
                  <CheckCircle className="w-3 h-3 text-[#64748b] flex-shrink-0" />
                )}
              </div>

              <div className="my-0.5">
                <div
                  className="font-mono text-sm font-bold tracking-tight"
                  style={{ color: ind.color }}
                >
                  {ind.currentValue}
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] text-[#64748b] border-t border-[#1b2232] pt-1 mt-1">
                <span className="truncate">{ind.plane.split('/')[0]}</span>
                <Info className="w-2.5 h-2.5 hover:text-[#dee2f1]" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
