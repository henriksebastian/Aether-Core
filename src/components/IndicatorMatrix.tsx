import React, { useState, useRef, useEffect } from 'react';
import { IndicatorSpec, IndicatorCategory } from '../types/market';
import { AlertCircle, CheckCircle, Info, ChevronDown, ChevronUp, Layers, ChevronsUpDown } from 'lucide-react';

interface IndicatorMatrixProps {
  indicators: IndicatorSpec[];
  onIndicatorClick?: (id: string) => void;
  activePersona: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const PLANES: (IndicatorCategory | 'ALL')[] = [
  'ALL',
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
  const [selectedPlane, setSelectedPlane] = useState<IndicatorCategory | 'ALL'>('ALL');

  // Resizable height state (persisted to localStorage)
  const [height, setHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aether_indicator_matrix_height');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 110 && parsed <= 750) {
          return parsed;
        }
      }
    }
    return 220;
  });

  const [isResizing, setIsResizing] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(220);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = height;
  };

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      const dy = dragStartYRef.current - e.clientY; // dragging up increases panel height
      const maxHeight = Math.round(window.innerHeight * 0.72);
      const newHeight = Math.max(110, Math.min(maxHeight, dragStartHeightRef.current + dy));
      setHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('aether_indicator_matrix_height', height.toString());
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing, height]);

  const filtered =
    selectedPlane === 'ALL'
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
            <span>{indicators.length}-INDICATOR QUANT MATRIX</span>
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
    <div
      className={`border-t border-[#1b2232] bg-[#090e18] flex flex-col select-none font-mono text-[11px] shrink-0 relative ${
        isResizing ? 'cursor-row-resize' : 'transition-[height] duration-75'
      }`}
      style={{ height: `${height}px` }}
    >
      {/* Resizable Top Drag Handle Bar */}
      <div
        onMouseDown={handleResizeMouseDown}
        onDoubleClick={() => {
          const def = 220;
          setHeight(def);
          localStorage.setItem('aether_indicator_matrix_height', def.toString());
        }}
        className="group h-2 w-full bg-[#0c1320] hover:bg-[#06b6d4]/30 active:bg-[#06b6d4] border-b border-[#1b2232] cursor-row-resize flex items-center justify-center transition-colors z-20 select-none"
        title="Drag up or down to resize bottom indicator matrix (Double-click to reset)"
      >
        <div className="flex gap-1 items-center opacity-40 group-hover:opacity-100 transition-opacity">
          <ChevronsUpDown size={9} className="text-[#64748b] group-hover:text-[#dee2f1]" />
          <div className="w-8 h-0.5 bg-[#64748b] group-hover:bg-[#dee2f1] rounded-full" />
        </div>
      </div>

      {/* Plane Switcher Tabs Header */}
      <div className="flex items-center justify-between px-3 h-7 border-b border-[#1b2232] bg-[#0e131d]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {PLANES.map((plane) => {
            const count =
              plane === 'ALL'
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
          {/* Quick Size Presets */}
          <div className="hidden sm:flex items-center gap-1 border border-[#1b2232] bg-[#090e18] rounded-sm px-1 py-0.2 text-[8.5px] text-[#64748b]">
            <span className="text-[8px] uppercase tracking-wider text-[#475569]">PANEL:</span>
            <button
              onClick={() => {
                setHeight(135);
                localStorage.setItem('aether_indicator_matrix_height', '135');
              }}
              className={`px-1 hover:text-[#dee2f1] transition-colors ${height <= 150 ? 'text-[#06b6d4] font-bold' : ''}`}
              title="Compact (1 Row)"
            >
              SM
            </button>
            <span className="text-[#1b2232]">|</span>
            <button
              onClick={() => {
                setHeight(220);
                localStorage.setItem('aether_indicator_matrix_height', '220');
              }}
              className={`px-1 hover:text-[#dee2f1] transition-colors ${height > 150 && height < 320 ? 'text-[#06b6d4] font-bold' : ''}`}
              title="Default (2 Rows)"
            >
              MD
            </button>
            <span className="text-[#1b2232]">|</span>
            <button
              onClick={() => {
                setHeight(380);
                localStorage.setItem('aether_indicator_matrix_height', '380');
              }}
              className={`px-1 hover:text-[#dee2f1] transition-colors ${height >= 320 ? 'text-[#06b6d4] font-bold' : ''}`}
              title="Expanded (Full View)"
            >
              LG
            </button>
          </div>

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
