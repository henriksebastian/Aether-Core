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
  ChevronRight,
  Zap,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  MARKET_INSTRUMENTS,
  MarketInstrument,
  Exchange,
  AssetClass,
  EXCHANGES,
  formatInstrumentPrice,
} from '../data/market_directory';
import { useLivePrices } from '../hooks/useLivePrices';

interface MarketDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSymbol: string;
  onSelectInstrument: (symbol: string) => void;
}

const ASSET_CLASSES: { id: AssetClass | 'ALL'; label: string; icon: any; color: string }[] = [
  { id: 'ALL',       label: 'All',         icon: Globe,      color: '#06b6d4' },
  { id: 'EQUITY',    label: 'Stocks',      icon: Building2,  color: '#3b82f6' },
  { id: 'INDEX',     label: 'Indices',     icon: BarChart3,  color: '#8b5cf6' },
  { id: 'COMMODITY', label: 'Commodities', icon: Flame,      color: '#f59e0b' },
  { id: 'FOREX',     label: 'FX',          icon: TrendingUp, color: '#10b981' },
  { id: 'CRYPTO',    label: 'Crypto',      icon: Coins,      color: '#f97316' },
];

const EXCHANGE_BADGE_STYLES: Record<Exchange, { bg: string; text: string; border: string }> = {
  NASDAQ:   { bg: 'rgba(6,182,212,0.12)',   text: '#22d3ee', border: 'rgba(6,182,212,0.3)'   },
  NYSE:     { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa', border: 'rgba(59,130,246,0.3)'  },
  LSE:      { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', border: 'rgba(245,158,11,0.3)'  },
  EURONEXT: { bg: 'rgba(139,92,246,0.12)',  text: '#a78bfa', border: 'rgba(139,92,246,0.3)'  },
  XETRA:    { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', border: 'rgba(16,185,129,0.3)'  },
  TSE:      { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', border: 'rgba(239,68,68,0.3)'   },
  HKEX:     { bg: 'rgba(249,115,22,0.12)',  text: '#fb923c', border: 'rgba(249,115,22,0.3)'  },
  NSE:      { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', border: 'rgba(99,102,241,0.3)'  },
  CME:      { bg: 'rgba(20,184,166,0.12)',  text: '#2dd4bf', border: 'rgba(20,184,166,0.3)'  },
  FOREX:    { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', border: 'rgba(16,185,129,0.3)'  },
  BINANCE:  { bg: 'rgba(234,179,8,0.12)',   text: '#facc15', border: 'rgba(234,179,8,0.3)'   },
};

const ASSET_CLASS_COLOR: Record<AssetClass, string> = {
  EQUITY:    '#60a5fa',
  INDEX:     '#a78bfa',
  COMMODITY: '#fbbf24',
  FOREX:     '#34d399',
  CRYPTO:    '#fb923c',
};

export const MarketDirectoryModal: React.FC<MarketDirectoryModalProps> = ({
  isOpen,
  onClose,
  activeSymbol,
  onSelectInstrument,
}) => {
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedAssetClass, setSelectedAssetClass] = useState<AssetClass | 'ALL'>('ALL');
  const [selectedExchange, setSelectedExchange] = useState<Exchange | 'ALL'>('ALL');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const { prices: livePrices, isLoading: pricesLoading, lastUpdated, hasError, refresh } = useLivePrices();

  const searchInputRef   = useRef<HTMLInputElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

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

  const filteredInstruments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return MARKET_INSTRUMENTS.filter((inst) => {
      if (selectedAssetClass !== 'ALL' && inst.assetClass !== selectedAssetClass) return false;
      if (selectedExchange !== 'ALL' && inst.exchange !== selectedExchange) return false;
      if (!q) return true;
      return (
        inst.symbol.toLowerCase().includes(q)   ||
        inst.name.toLowerCase().includes(q)      ||
        inst.sector.toLowerCase().includes(q)    ||
        inst.exchange.toLowerCase().includes(q)  ||
        inst.currency.toLowerCase().includes(q)  ||
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

  useEffect(() => {
    if (listContainerRef.current) {
      const activeEl = listContainerRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  if (!isOpen) return null;

  const activeClass = ASSET_CLASSES.find((ac) => ac.id === selectedAssetClass);

  const modalContent = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        backgroundColor: 'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: '860px',
          maxHeight: 'min(85vh, 680px)',
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#080d16',
          border: '1px solid #1e2a3d',
          boxShadow: '0 32px 64px -12px rgba(0,0,0,0.96), 0 0 0 1px rgba(6,182,212,0.08), 0 0 40px rgba(6,182,212,0.06)',
          overflow: 'hidden',
          fontFamily: '"JetBrains Mono", monospace',
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'linear-gradient(135deg, #0c1422 0%, #0e1826 100%)',
          borderBottom: '1px solid #1e2a3d',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: hasError ? '#f23645' : '#089981',
              boxShadow: `0 0 8px ${hasError ? '#f23645' : '#089981'}`,
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#dee2f1' }}>
              GLOBAL MARKET DIRECTORY
            </span>
            <span style={{
              fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
              padding: '2px 8px',
              background: 'rgba(6,182,212,0.1)',
              color: '#06b6d4',
              border: '1px solid rgba(6,182,212,0.25)',
            }}>
              {MARKET_INSTRUMENTS.length} INSTRUMENTS · {EXCHANGES.length} EXCHANGES
            </span>
            {/* Live feed status badge */}
            {pricesLoading ? (
              <span style={{ fontSize: 9, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RefreshCw size={9} style={{ animation: 'spin 1s linear infinite' }} />
                FETCHING
              </span>
            ) : hasError ? (
              <span style={{ fontSize: 9, color: '#f23645', display: 'flex', alignItems: 'center', gap: 4 }}>
                <WifiOff size={9} /> OFFLINE · STATIC PRICES
              </span>
            ) : lastUpdated ? (
              <span style={{ fontSize: 9, color: '#089981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Wifi size={9} /> LIVE · {lastUpdated.toLocaleTimeString()}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: 9, color: '#475569', letterSpacing: '0.06em' }}>
              ESC · ↑↓ · ENTER
            </span>
            <button
              onClick={refresh}
              title="Refresh live prices"
              style={{
                background: 'none', border: '1px solid #1e2a3d', cursor: 'pointer',
                color: '#475569', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 9, fontFamily: '"JetBrains Mono", monospace',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#06b6d4')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
            >
              <RefreshCw size={10} style={{ animation: pricesLoading ? 'spin 1s linear infinite' : 'none' }} />
              REFRESH
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#475569', padding: '4px', display: 'flex',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#dee2f1')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Search Bar ── */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid #1e2a3d',
          backgroundColor: '#090e18',
          flexShrink: 0,
        }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: 14, color: '#475569', pointerEvents: 'none' }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setHighlightedIndex(0); }}
              placeholder="Search ticker, company, exchange or sector…"
              style={{
                width: '100%',
                background: '#080d16',
                border: '1px solid #1e2a3d',
                outline: 'none',
                padding: '10px 36px',
                fontSize: 12,
                color: '#dee2f1',
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: '0.02em',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#06b6d4')}
              onBlur={(e)  => (e.target.style.borderColor = '#1e2a3d')}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                style={{
                  position: 'absolute', right: 12, background: 'none', border: 'none',
                  cursor: 'pointer', color: '#475569', display: 'flex', padding: 2,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* ── Asset Class Tabs ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '10px 20px',
          borderBottom: '1px solid #1e2a3d',
          backgroundColor: '#080d16',
          flexShrink: 0,
          overflowX: 'auto',
        }}>
          {ASSET_CLASSES.map((ac) => {
            const Icon    = ac.icon;
            const active  = selectedAssetClass === ac.id;
            return (
              <button
                key={ac.id}
                onClick={() => { setSelectedAssetClass(ac.id); setHighlightedIndex(0); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  fontSize: 10, fontWeight: active ? 700 : 500,
                  letterSpacing: '0.06em',
                  fontFamily: '"JetBrains Mono", monospace',
                  cursor: 'pointer',
                  border: active ? `1px solid ${ac.color}` : '1px solid transparent',
                  background: active ? `${ac.color}18` : 'transparent',
                  color: active ? ac.color : '#64748b',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = '#0e1624'; } }}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; } }}
              >
                <Icon size={11} />
                {ac.label}
              </button>
            );
          })}

          {/* Spacer + Exchange pills on the right */}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <button
              onClick={() => { setSelectedExchange('ALL'); setHighlightedIndex(0); }}
              style={{
                padding: '4px 10px', fontSize: 9, fontWeight: 600, cursor: 'pointer',
                fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em',
                border: selectedExchange === 'ALL' ? '1px solid #06b6d4' : '1px solid #1e2a3d',
                background: selectedExchange === 'ALL' ? 'rgba(6,182,212,0.12)' : 'transparent',
                color: selectedExchange === 'ALL' ? '#06b6d4' : '#475569',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              ALL
            </button>
            {EXCHANGES.map((ex) => {
              const active = selectedExchange === ex.id;
              const style  = EXCHANGE_BADGE_STYLES[ex.id] || { bg: 'transparent', text: '#64748b', border: '#1e2a3d' };
              return (
                <button
                  key={ex.id}
                  title={`${ex.name} (${ex.country})`}
                  onClick={() => { setSelectedExchange(ex.id); setHighlightedIndex(0); }}
                  style={{
                    padding: '4px 8px', fontSize: 9, fontWeight: 600, cursor: 'pointer',
                    fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.05em',
                    border: active ? `1px solid ${style.border}` : '1px solid transparent',
                    background: active ? style.bg : 'transparent',
                    color: active ? style.text : '#475569',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#94a3b8'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#475569'; }}
                >
                  {ex.id}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Results count bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 20px',
          backgroundColor: '#060b12',
          borderBottom: '1px solid #1e2a3d',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 9, color: '#475569', letterSpacing: '0.08em' }}>
            <strong style={{ color: '#94a3b8' }}>{filteredInstruments.length}</strong>
            &nbsp;INSTRUMENTS
            {selectedAssetClass !== 'ALL' && (
              <span style={{ color: activeClass?.color, marginLeft: 6 }}>
                · {activeClass?.label.toUpperCase()}
              </span>
            )}
            {selectedExchange !== 'ALL' && (
              <span style={{ color: '#94a3b8', marginLeft: 6 }}>· {selectedExchange}</span>
            )}
          </span>
          <span style={{ fontSize: 9, color: '#2a3a55', letterSpacing: '0.08em' }}>
            CLICK OR ↵ TO ROUTE TERMINAL FEED
          </span>
        </div>

        {/* ── Instrument List ── */}
        <div
          ref={listContainerRef}
          style={{
            flex: '1 1 auto',
            overflowY: 'auto',
            backgroundColor: '#080d16',
          }}
        >
          {filteredInstruments.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12, padding: '60px 20px',
            }}>
              <Search size={28} style={{ color: '#2a3a55' }} />
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                No results for <em>"{searchQuery}"</em>
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedAssetClass('ALL'); setSelectedExchange('ALL'); }}
                style={{
                  padding: '6px 16px', fontSize: 10,
                  background: '#0e1624', color: '#06b6d4',
                  border: '1px solid #1e2a3d', cursor: 'pointer',
                  fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em',
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredInstruments.map((inst, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isActive      = inst.symbol.toUpperCase() === activeSymbol.toUpperCase();
              const badgeStyle    = EXCHANGE_BADGE_STYLES[inst.exchange] || { bg: '#1e2a3d', text: '#94a3b8', border: '#2a3a55' };
              const acColor       = ASSET_CLASS_COLOR[inst.assetClass];

              return (
                <div
                  key={inst.symbol}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => { onSelectInstrument(inst.symbol); onClose(); }}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '11px 20px',
                    cursor: 'pointer',
                    borderLeft: isHighlighted ? '2px solid #06b6d4' : '2px solid transparent',
                    backgroundColor: isHighlighted ? 'rgba(6,182,212,0.05)' : 'transparent',
                    borderBottom: '1px solid #0e1624',
                    transition: 'background 0.1s',
                    gap: 0,
                  }}
                >
                  {/* Left col: symbol + name */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 180, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: isHighlighted ? '#ffffff' : '#dee2f1',
                        letterSpacing: '0.03em',
                      }}>
                        {inst.symbol}
                      </span>
                      {/* Exchange badge */}
                      <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
                        padding: '2px 6px',
                        background: badgeStyle.bg,
                        color: badgeStyle.text,
                        border: `1px solid ${badgeStyle.border}`,
                      }}>
                        {inst.exchange}
                      </span>
                      {isActive && (
                        <span style={{
                          fontSize: 8, fontWeight: 700,
                          padding: '2px 6px',
                          background: 'rgba(8,153,129,0.15)',
                          color: '#089981',
                          border: '1px solid rgba(8,153,129,0.35)',
                        }}>
                          LIVE
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inst.name}
                    </span>
                  </div>

                  {/* Center col: sector + metadata */}
                  <div style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inst.sector}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 8, fontWeight: 600, letterSpacing: '0.07em',
                        padding: '1px 6px',
                        background: `${acColor}12`,
                        color: acColor,
                        border: `1px solid ${acColor}28`,
                      }}>
                        {inst.assetClass}
                      </span>
                      <span style={{ fontSize: 9, color: '#334155' }}>{inst.region}</span>
                      {inst.marketCap && inst.marketCap !== '—' && (
                        <span style={{ fontSize: 9, color: '#334155' }}>MCap {inst.marketCap}</span>
                      )}
                    </div>
                  </div>

                  {/* Right col: price */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      {(() => {
                        const livePrice = livePrices.get(inst.symbol);
                        const displayPrice = livePrice ?? inst.referencePrice;
                        const isLiveData  = livePrice != null;
                        return (
                          <>
                            <div style={{
                              fontSize: 13, fontWeight: 700,
                              color: isHighlighted ? '#ffffff' : (isLiveData ? '#dee2f1' : '#64748b'),
                              letterSpacing: '0.02em',
                            }}>
                              {formatInstrumentPrice(displayPrice, inst)}
                            </div>
                            <div style={{ fontSize: 9, color: isLiveData ? '#089981' : '#334155', marginTop: 2 }}>
                              {isLiveData ? '● LIVE' : inst.currency}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <ChevronRight
                      size={14}
                      style={{
                        color: isHighlighted ? '#06b6d4' : '#1e2a3d',
                        transform: isHighlighted ? 'translateX(2px)' : 'none',
                        transition: 'all 0.15s',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 20px',
          background: 'linear-gradient(135deg, #060b12 0%, #070c14 100%)',
          borderTop: '1px solid #1e2a3d',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={10} style={{ color: '#089981' }} />
            <span style={{ fontSize: 9, color: '#089981', fontWeight: 700, letterSpacing: '0.08em' }}>AETHER-CORE</span>
            <span style={{ fontSize: 9, color: '#2a3a55' }}>· Institutional Global Venue Router</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 9, color: '#2a3a55', letterSpacing: '0.06em' }}>
              CRYPTO: <strong style={{ color: '#facc15' }}>BINANCE LIVE WS</strong>
            </span>
            <span style={{ fontSize: 9, color: '#2a3a55', letterSpacing: '0.06em' }}>
              EQUITY / FX / CMDT: <strong style={{ color: '#06b6d4' }}>YAHOO FINANCE LIVE</strong>
            </span>
            <span style={{ fontSize: 9, color: '#2a3a55', letterSpacing: '0.06em' }}>
              REFRESH: <strong style={{ color: '#94a3b8' }}>30s</strong>
            </span>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
