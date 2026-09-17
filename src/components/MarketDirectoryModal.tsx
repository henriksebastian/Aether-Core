import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  TrendingUp,
  Globe,
  Building2,
  Coins,
  BarChart3,
  Flame,
  ArrowRight,
} from 'lucide-react';
import {
  MARKET_INSTRUMENTS,
  MarketInstrument,
  Exchange,
  AssetClass,
  EXCHANGES,
  formatInstrumentPrice,
} from '../data/market_directory';

interface MarketDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSymbol: string;
  onSelectInstrument: (symbol: string) => void;
}

const ASSET_CLASSES: { id: AssetClass | 'ALL'; label: string; icon: any }[] = [
  { id: 'ALL', label: 'ALL ASSETS', icon: Globe },
  { id: 'EQUITY', label: 'STOCKS (US & GLOBAL)', icon: Building2 },
  { id: 'INDEX', label: 'INDICES & ETFS', icon: BarChart3 },
  { id: 'COMMODITY', label: 'COMMODITIES & ENERGY', icon: Flame },
  { id: 'FOREX', label: 'CURRENCIES (FX)', icon: TrendingUp },
  { id: 'CRYPTO', label: 'CRYPTO ASSETS', icon: Coins },
];

export const MarketDirectoryModal: React.FC<MarketDirectoryModalProps> = ({
  isOpen,
  onClose,
  activeSymbol,
  onSelectInstrument,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetClass, setSelectedAssetClass] = useState<AssetClass | 'ALL'>('ALL');
  const [selectedExchange, setSelectedExchange] = useState<Exchange | 'ALL'>('ALL');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    } else {
      setSearchQuery('');
      setSelectedAssetClass('ALL');
      setSelectedExchange('ALL');
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // Filter instruments based on search and selected categories
  const filteredInstruments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return MARKET_INSTRUMENTS.filter((inst) => {
      // Asset class filter
      if (selectedAssetClass !== 'ALL' && inst.assetClass !== selectedAssetClass) {
        return false;
      }

      // Exchange filter
      if (selectedExchange !== 'ALL' && inst.exchange !== selectedExchange) {
        return false;
      }

      // Search query filter
      if (!q) return true;

      return (
        inst.symbol.toLowerCase().includes(q) ||
        inst.name.toLowerCase().includes(q) ||
        inst.sector.toLowerCase().includes(q) ||
        inst.exchange.toLowerCase().includes(q) ||
        inst.currency.toLowerCase().includes(q) ||
        inst.region.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, selectedAssetClass, selectedExchange]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(filteredInstruments.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredInstruments[highlightedIndex]) {
          onSelectInstrument(filteredInstruments[highlightedIndex].symbol);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredInstruments, highlightedIndex, onClose, onSelectInstrument]);

  // Ensure highlighted item stays in view
  useEffect(() => {
    if (listContainerRef.current) {
      const activeEl = listContainerRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="select-none font-mono text-[11px]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="flex flex-col bg-[#080d16] border border-[#1b2232] shadow-2xl rounded-none overflow-hidden"
        style={{
          width: '100%',
          maxWidth: '820px',
          height: 'auto',
          maxHeight: 'min(82vh, 650px)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#080d16',
          border: '1px solid #1b2232',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95), 0 0 25px rgba(6, 182, 212, 0.15)',
          overflow: 'hidden',
          zIndex: 100000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Modal Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e131d] border-b border-[#1b2232] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 bg-[#089981] animate-pulse" />
            <h2 className="text-xs font-bold tracking-wider text-[#dee2f1]">
              GLOBAL MARKET DIRECTORY & EXCHANGE ROUTER
            </h2>
            <span className="text-[9px] px-1.5 py-0.5 bg-[#1b202a] text-[#06b6d4] border border-[#1b2232]">
              {MARKET_INSTRUMENTS.length} INSTRUMENTS · 11 EXCHANGES
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#64748b] hidden sm:inline">
              [ESC] close · [↑/↓] navigate · [ENTER] select
            </span>
            <button
              onClick={onClose}
              className="p-1 text-[#64748b] hover:text-[#dee2f1] hover:bg-[#1b2232] transition-colors"
              title="Close (ESC)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 2. Search Input Bar */}
        <div className="p-3 bg-[#0c121e] border-b border-[#1b2232] flex items-center gap-3 shrink-0">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3 text-[#64748b]" size={15} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Search ticker, company, exchange, sector (e.g. NVDA, Apple, LSE, Gold, EURUSD)..."
              className="w-full bg-[#080d16] border border-[#1b2232] focus:border-[#06b6d4] pl-9 pr-8 py-2 text-xs text-[#dee2f1] placeholder-[#475569] outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 text-[#64748b] hover:text-[#dee2f1]"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* 3. Asset Class & Exchange Filter Strips */}
        <div className="flex flex-col border-b border-[#1b2232] bg-[#090e18] text-[10px] shrink-0">
          {/* Asset Class Pills */}
          <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto border-b border-[#1b2232]/50">
            <span className="text-[9px] uppercase tracking-wider text-[#475569] mr-1">ASSET:</span>
            {ASSET_CLASSES.map((ac) => {
              const Icon = ac.icon;
              const isSelected = selectedAssetClass === ac.id;
              return (
                <button
                  key={ac.id}
                  onClick={() => {
                    setSelectedAssetClass(ac.id);
                    setHighlightedIndex(0);
                  }}
                  className={`px-2 py-0.5 flex items-center gap-1.5 whitespace-nowrap transition-colors border ${
                    isSelected
                      ? 'bg-[#1b202a] text-[#089981] border-[#089981] font-bold'
                      : 'text-[#94a3b8] border-transparent hover:text-[#dee2f1] hover:bg-[#141a26]'
                  }`}
                >
                  <Icon size={11} />
                  <span>{ac.label}</span>
                </button>
              );
            })}
          </div>

          {/* Exchange Filter Chips */}
          <div className="flex items-center gap-1 px-3 py-1 overflow-x-auto bg-[#070b13]">
            <span className="text-[9px] uppercase tracking-wider text-[#475569] mr-1">VENUE:</span>
            <button
              onClick={() => {
                setSelectedExchange('ALL');
                setHighlightedIndex(0);
              }}
              className={`px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap border transition-colors ${
                selectedExchange === 'ALL'
                  ? 'bg-[#06b6d4]/20 text-[#06b6d4] border-[#06b6d4]'
                  : 'text-[#64748b] border-transparent hover:text-[#dee2f1]'
              }`}
            >
              ALL EXCHANGES
            </button>
            {EXCHANGES.map((ex) => {
              const isSelected = selectedExchange === ex.id;
              return (
                <button
                  key={ex.id}
                  onClick={() => {
                    setSelectedExchange(ex.id);
                    setHighlightedIndex(0);
                  }}
                  className={`px-1.5 py-0.5 text-[9px] whitespace-nowrap border transition-colors ${
                    isSelected
                      ? 'bg-[#06b6d4]/20 text-[#06b6d4] border-[#06b6d4] font-bold'
                      : 'text-[#64748b] border-transparent hover:text-[#94a3b8]'
                  }`}
                  title={`${ex.name} (${ex.country})`}
                >
                  {ex.id}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Results Counter */}
        <div className="px-4 py-1.5 bg-[#080d16] border-b border-[#1b2232] flex items-center justify-between text-[9.5px] text-[#64748b] shrink-0">
          <span>
            SHOWING <strong className="text-[#dee2f1]">{filteredInstruments.length}</strong> MATCHING INSTRUMENTS
          </span>
          <span>CLICK OR PRESS ENTER TO ROUTE TERMINAL FEED</span>
        </div>

        {/* 5. Instruments List (Contained Scroll Area) */}
        <div
          ref={listContainerRef}
          className="overflow-y-auto divide-y divide-[#1b2232]/30 bg-[#080d16]"
          style={{
            flex: '1 1 auto',
            maxHeight: '380px',
            minHeight: '140px',
            overflowY: 'auto',
            backgroundColor: '#080d16',
          }}
        >
          {filteredInstruments.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#64748b] gap-2">
              <Search size={22} className="opacity-40" />
              <p className="text-xs">No matching instruments found for "{searchQuery}"</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedAssetClass('ALL');
                  setSelectedExchange('ALL');
                }}
                className="mt-2 px-3 py-1 bg-[#1b202a] text-[#06b6d4] hover:text-[#dee2f1] border border-[#1b2232] text-xs transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredInstruments.map((inst, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isActive = inst.symbol.toUpperCase() === activeSymbol.toUpperCase();

              // Exchange color badges
              const badgeColors: Record<Exchange, string> = {
                NASDAQ: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60',
                NYSE: 'bg-blue-950/60 text-blue-400 border-blue-800/60',
                LSE: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
                EURONEXT: 'bg-purple-950/60 text-purple-400 border-purple-800/60',
                XETRA: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
                TSE: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
                HKEX: 'bg-orange-950/60 text-orange-400 border-orange-800/60',
                NSE: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60',
                CME: 'bg-teal-950/60 text-teal-400 border-teal-800/60',
                FOREX: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
                BINANCE: 'bg-yellow-950/60 text-yellow-400 border-yellow-800/60',
              };

              return (
                <div
                  key={inst.symbol}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => {
                    onSelectInstrument(inst.symbol);
                    onClose();
                  }}
                  className={`px-4 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                    isHighlighted
                      ? 'bg-[#141d2e] border-l-2 border-[#06b6d4]'
                      : 'hover:bg-[#0d1424] border-l-2 border-transparent'
                  }`}
                >
                  {/* Left: Ticker & Name */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#dee2f1]">{inst.symbol}</span>
                        <span
                          className={`text-[8.5px] font-bold px-1.5 py-0.2 border ${
                            badgeColors[inst.exchange] || 'bg-[#1b202a] text-[#94a3b8] border-[#1b2232]'
                          }`}
                        >
                          {inst.exchange}
                        </span>
                        {isActive && (
                          <span className="text-[8px] bg-[#089981]/20 text-[#089981] border border-[#089981]/40 px-1 font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#94a3b8]">{inst.name}</span>
                    </div>
                  </div>

                  {/* Center: Sector & Asset Class */}
                  <div className="hidden md:flex flex-col text-right">
                    <span className="text-[10px] text-[#64748b]">{inst.sector}</span>
                    <span className="text-[9px] text-[#475569]">
                      {inst.region} · {inst.assetClass} · MktCap: {inst.marketCap}
                    </span>
                  </div>

                  {/* Right: Price & Currency */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col text-right">
                      <span className="font-bold text-xs text-[#dee2f1]">
                        {formatInstrumentPrice(inst.referencePrice, inst)}
                      </span>
                      <span className="text-[9px] text-[#64748b]">{inst.currency}</span>
                    </div>

                    <ArrowRight
                      size={14}
                      className={`text-[#64748b] transition-transform ${
                        isHighlighted ? 'translate-x-1 text-[#06b6d4]' : 'opacity-30'
                      }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 6. Modal Footer Bar */}
        <div className="px-4 py-2 bg-[#0c121e] border-t border-[#1b2232] flex items-center justify-between text-[10px] text-[#64748b] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[#089981] font-bold">AETHER-CORE</span>
            <span>· Institutional Global Venue Router</span>
          </div>
          <div className="flex items-center gap-3">
            <span>
              Direct WebSocket: <strong className="text-[#089981]">Binance</strong>
            </span>
            <span>
              DMA Feeds: <strong className="text-[#06b6d4]">NASDAQ / NYSE / LSE / CME / TSE / FX</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
