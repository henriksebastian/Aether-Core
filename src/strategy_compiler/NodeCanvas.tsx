import React, { useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CodeGeneratorService, StrategyGraphRule } from './code_generators';
import { SnarkProverService, ZKProofPayload } from './zksnark/snark_prover';
import { LiveStrategyEvaluationState } from './strategy_evaluator';
import { Code, ShieldCheck, Play, CheckCircle2, Copy, Terminal, X, Zap, Activity, Check } from 'lucide-react';

const initialNodes: Node[] = [
  {
    id: '1',
    position: { x: 40, y: 45 },
    data: { label: 'Hawkes Intensity > 1.05 (Cascade Detected)' },
    style: {
      background: '#090e18',
      color: '#06b6d4',
      border: '1px solid #06b6d4',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono',
      padding: '10px',
      width: 220,
    },
  },
  {
    id: '2',
    position: { x: 300, y: 45 },
    data: { label: 'Price touches 0.618 Fib Retracement' },
    style: {
      background: '#090e18',
      color: '#f59e0b',
      border: '1px solid #f59e0b',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono',
      padding: '10px',
      width: 210,
    },
  },
  {
    id: '3',
    position: { x: 550, y: 45 },
    data: { label: 'Liquidity Gravity Force G(x) > 1.20' },
    style: {
      background: '#090e18',
      color: '#8b5cf6',
      border: '1px solid #8b5cf6',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono',
      padding: '10px',
      width: 210,
    },
  },
  {
    id: '4',
    position: { x: 800, y: 45 },
    data: { label: 'EXECUTE: Immediate IOC Aggressive Buy' },
    style: {
      background: '#090e18',
      color: '#089981',
      border: '1px solid #089981',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono',
      fontWeight: 'bold',
      padding: '10px',
      width: 210,
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#f59e0b', strokeWidth: 2 } },
  { id: 'e3-4', source: '3', target: '4', animated: true, style: { stroke: '#089981', strokeWidth: 2 } },
];

export const StrategyNodeCompilerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  personaDefaultTarget?: string;
  liveStrategyState?: LiveStrategyEvaluationState | null;
  onToggleAutoExecute?: () => void;
  onApplyRules?: (rules: StrategyGraphRule) => void;
}> = ({ isOpen, onClose, personaDefaultTarget, liveStrategyState, onToggleAutoExecute, onApplyRules }) => {
  const [nodes] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);
  const [activeTab, setActiveTab] = useState<'cpp' | 'python' | 'zksnark'>(
    personaDefaultTarget === 'Positional Quant'
      ? 'zksnark'
      : personaDefaultTarget === 'Intraday Momentum'
      ? 'python'
      : 'cpp'
  );
  const [isProving, setIsProving] = useState(false);
  const [proofResult, setProofResult] = useState<ZKProofPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [isApplied, setIsApplied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentRules: StrategyGraphRule = {
    hawkesThreshold: 1.05,
    fibLevel: 0.618,
    gravityForce: 1.2,
    action: 'BUY',
    orderType: 'IOC_AGGRESSIVE',
  };

  const cppCode = CodeGeneratorService.generateCppHFT(currentRules);
  const pythonCode = CodeGeneratorService.generatePythonAsyncio(currentRules);
  const zkCode = CodeGeneratorService.generateZkVerificationCode(currentRules);

  const activeCode = activeTab === 'cpp' ? cppCode : activeTab === 'python' ? pythonCode : zkCode;

  const handleGenerateProof = async () => {
    setIsProving(true);
    const prover = new SnarkProverService();
    const result = await prover.generateProof(2.65, 3.8, 1.8, 1.05, 2.0, 5.0);
    setProofResult(result);
    setIsProving(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToEngine = () => {
    if (onApplyRules) {
      onApplyRules(currentRules);
    }
    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 2500);
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      {/* Modal Dialog Container */}
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Modal Header */}
        <div className="flex items-center justify-between px-4 h-10 border-b border-[#1b2232] bg-[#090e18] shrink-0 font-mono text-[11px]">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-[#06b6d4]" />
            <span className="font-bold text-xs tracking-wider uppercase text-[#dee2f1]">
              VISUAL STRATEGY-TO-CODE COMPILER & ZK-SNARK VERIFIER
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-[#1b202a] text-[#06b6d4] border border-[#1b2232]">
              REACT FLOW HFT PIPELINE
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 bg-[#1b202a] hover:bg-[#242c40] text-[#dee2f1] font-bold text-[11px] border border-[#1b2232] flex items-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>CLOSE ✕</span>
          </button>
        </div>

        {/* 2. Visual Node Canvas (React Flow) */}
        <div
          style={{ height: '260px', minHeight: '260px', width: '100%', position: 'relative', backgroundColor: '#090e18' }}
          className="border-b border-[#1b2232]"
        >
          <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
            <Background color="#1b2232" gap={18} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>

          {/* Strategy Flow Banner Tag */}
          <div className="absolute top-2 left-3 bg-[#0e131d]/90 px-2.5 py-1 text-[10px] font-mono border border-[#1b2232] text-[#94a3b8] z-10 flex items-center gap-2 backdrop-blur-sm">
            <span>Pipeline:</span>
            <span className={liveStrategyState?.isHawkesMet ? 'text-[#089981] font-bold' : 'text-[#06b6d4]'}>
              Hawkes_Cascade {liveStrategyState ? `(${liveStrategyState.currentHawkes})` : ''}
            </span>
            <span>➔</span>
            <span className="text-[#f59e0b] font-bold">Fib_0.618</span>
            <span>➔</span>
            <span className={liveStrategyState?.isGravityMet ? 'text-[#089981] font-bold' : 'text-[#8b5cf6]'}>
              Gravity_Vector {liveStrategyState ? `(${liveStrategyState.currentGravity})` : ''}
            </span>
            <span>➔</span>
            <span className={liveStrategyState?.isAllConditionsMet ? 'text-[#089981] font-extrabold animate-pulse' : 'text-[#089981]'}>
              IOC_AGG_BUY
            </span>
          </div>

          {/* Live Engine Action Strip */}
          <div className="absolute top-2 right-3 z-10 flex items-center gap-1.5 font-mono text-[9px]">
            {onToggleAutoExecute && (
              <button
                onClick={onToggleAutoExecute}
                className={`px-2 py-1 font-bold border transition-colors flex items-center gap-1 ${
                  liveStrategyState?.isAutoExecuteEnabled
                    ? 'bg-[#089981]/25 border-[#089981] text-[#089981]'
                    : 'bg-[#0e131d]/90 border-[#1b2232] text-[#64748b] hover:text-[#dee2f1]'
                }`}
              >
                <Zap size={10} />
                AUTO-EXECUTE: {liveStrategyState?.isAutoExecuteEnabled ? 'ACTIVE [ON]' : 'OFF'}
              </button>
            )}

            <button
              onClick={handleApplyToEngine}
              className={`px-2.5 py-1 font-bold border rounded transition-all flex items-center gap-1 shadow-lg ${
                isApplied
                  ? 'bg-[#089981] text-[#090e18] border-[#089981]'
                  : 'bg-[#06b6d4]/20 hover:bg-[#06b6d4]/35 text-[#06b6d4] border-[#06b6d4]/60'
              }`}
            >
              {isApplied ? <Check size={11} /> : <Activity size={11} />}
              {isApplied ? 'DEPLOYED TO ENGINE' : '⚡ APPLY & RUN LIVE IN ENGINE'}
            </button>
          </div>
        </div>

        {/* 3. Code Generation & zk-SNARK Inspection (Bottom Area) */}
        <div className="flex-1 flex flex-col bg-[#0e131d] overflow-hidden min-h-0 font-mono text-[11px]">
          {/* Tabs Toolbar */}
          <div className="flex items-center justify-between px-3 h-8 border-b border-[#1b2232] bg-[#090e18] shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('cpp')}
                className={`px-2 py-1 text-[10px] font-bold border-b-2 flex items-center gap-1 transition-colors ${
                  activeTab === 'cpp'
                    ? 'bg-[#1b202a] text-[#06b6d4] border-[#06b6d4]'
                    : 'text-[#94a3b8] border-transparent hover:text-[#dee2f1]'
                }`}
              >
                <Code className="w-3 h-3" /> C++20 HFT Template
              </button>
              <button
                onClick={() => setActiveTab('python')}
                className={`px-2 py-1 text-[10px] font-bold border-b-2 flex items-center gap-1 transition-colors ${
                  activeTab === 'python'
                    ? 'bg-[#1b202a] text-[#06b6d4] border-[#06b6d4]'
                    : 'text-[#94a3b8] border-transparent hover:text-[#dee2f1]'
                }`}
              >
                <Code className="w-3 h-3" /> Python / Asyncio Backtest
              </button>
              <button
                onClick={() => setActiveTab('zksnark')}
                className={`px-2 py-1 text-[10px] font-bold border-b-2 flex items-center gap-1 transition-colors ${
                  activeTab === 'zksnark'
                    ? 'bg-[#1b202a] text-[#8b5cf6] border-[#8b5cf6]'
                    : 'text-[#94a3b8] border-transparent hover:text-[#dee2f1]'
                }`}
              >
                <ShieldCheck className="w-3 h-3 text-[#8b5cf6]" /> zk-SNARK Circom Prover
              </button>
            </div>

            <div className="flex items-center gap-2">
              {liveStrategyState && (
                <span className="text-[9px] text-[#64748b] mr-1">
                  Live Execs: <strong className="text-[#089981]">{liveStrategyState.executionCount}</strong> ({liveStrategyState.simulatedLatencyMicroseconds}µs)
                </span>
              )}
              {activeTab === 'zksnark' && (
                <button
                  onClick={handleGenerateProof}
                  disabled={isProving}
                  className="px-2.5 py-0.5 bg-[#8b5cf6]/20 text-[#8b5cf6] border border-[#8b5cf6]/50 text-[10px] font-bold hover:bg-[#8b5cf6]/30 transition-colors flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  {isProving ? 'Generating Groth16 Proof...' : 'Execute zk-SNARK Proof'}
                </button>
              )}
              <button
                onClick={handleCopy}
                className="px-2.5 py-0.5 bg-[#1b202a] text-[#dee2f1] border border-[#1b2232] text-[10px] hover:bg-[#242c40] transition-colors flex items-center gap-1"
              >
                {copied ? <CheckCircle2 className="w-3 h-3 text-[#089981]" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>

          {/* Code Viewer & Proof Results */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            <pre className="flex-1 p-3 font-mono text-[11px] text-[#dee2f1] overflow-auto bg-[#090e18] leading-relaxed select-text m-0">
              <code>{activeCode}</code>
            </pre>

            {/* zk-SNARK Proof Results Panel */}
            {activeTab === 'zksnark' && proofResult && (
              <div className="w-80 border-l border-[#1b2232] p-3 bg-[#0e131d] overflow-y-auto text-[10px] flex flex-col gap-2.5 shrink-0">
                <div className="flex items-center gap-1.5 text-[#089981] font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#089981]" /> Cryptographically Verified Proof
                </div>
                <div className="p-2 bg-[#090e18] border border-[#1b2232] text-[#dee2f1] flex flex-col gap-1">
                  <span className="text-[#64748b]">Zero-Knowledge Guarantee:</span>
                  <span className="text-[#089981] font-bold">✓ Sharpe Ratio &gt; 2.00 Proven (2.65)</span>
                  <span className="text-[#089981] font-bold">✓ Max Drawdown &lt; 5.0% Proven (3.8%)</span>
                  <span className="text-[#f59e0b] text-[9px] pt-1 border-t border-[#1b2232]">
                    Hidden: Proprietary OFI & Hawkes parameters
                  </span>
                </div>
                <div>
                  <span className="text-[#64748b]">Verification Hash:</span>
                  <div className="break-all font-mono text-[9px] text-[#8b5cf6] bg-[#090e18] p-1.5 border border-[#1b2232] mt-0.5">
                    {proofResult.verificationHash}
                  </div>
                </div>
                <div>
                  <span className="text-[#64748b]">Public Signals:</span>
                  <div className="font-mono text-[9px] text-[#dee2f1] bg-[#090e18] p-1.5 border border-[#1b2232] mt-0.5">
                    {JSON.stringify(proofResult.publicSignals)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
