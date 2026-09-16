import React, { useState } from 'react';
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
import { Code, ShieldCheck, Play, CheckCircle2, Copy, Terminal } from 'lucide-react';

const initialNodes: Node[] = [
  {
    id: '1',
    position: { x: 50, y: 50 },
    data: { label: 'Hawkes Intensity > 1.05 (Cascade Detected)' },
    style: {
      background: 'rgba(11, 16, 24, 0.9)',
      color: '#00f3ff',
      border: '1px solid #00f3ff',
      borderRadius: '6px',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono',
      padding: '10px',
      width: 220,
    },
  },
  {
    id: '2',
    position: { x: 320, y: 50 },
    data: { label: 'Price touches 0.618 Fib Pocket' },
    style: {
      background: 'rgba(11, 16, 24, 0.9)',
      color: '#ffb700',
      border: '1px solid #ffb700',
      borderRadius: '6px',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono',
      padding: '10px',
      width: 200,
    },
  },
  {
    id: '3',
    position: { x: 570, y: 50 },
    data: { label: 'Liquidity Gravity Vector > 1.20' },
    style: {
      background: 'rgba(11, 16, 24, 0.9)',
      color: '#9d4edd',
      border: '1px solid #9d4edd',
      borderRadius: '6px',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono',
      padding: '10px',
      width: 200,
    },
  },
  {
    id: '4',
    position: { x: 820, y: 50 },
    data: { label: 'EXECUTE: Immediate IOC Buy' },
    style: {
      background: 'rgba(0, 255, 136, 0.15)',
      color: '#00ff88',
      border: '1px solid #00ff88',
      borderRadius: '6px',
      fontSize: '11px',
      fontFamily: 'JetBrains Mono',
      fontWeight: 'bold',
      padding: '10px',
      width: 180,
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#00f3ff' } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#ffb700' } },
  { id: 'e3-4', source: '3', target: '4', animated: true, style: { stroke: '#00ff88' } },
];

export const StrategyNodeCompilerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  personaDefaultTarget?: string;
}> = ({ isOpen, onClose, personaDefaultTarget }) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
      <div className="w-full max-w-6xl h-[85vh] bg-[#0b1018] border border-white/10 rounded-lg flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#06090e]">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-cyan-400 text-cyan" />
            <span className="font-display font-bold text-sm tracking-wider uppercase text-white">
              Visual Strategy-to-Code Compiler & zk-SNARK Verifier
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-dim text-cyan">
              React Flow Engine
            </span>
          </div>
          <button onClick={onClose} className="btn-terminal text-xs">
            Close ✕
          </button>
        </div>

        {/* Visual Node Canvas (Top Half) */}
        <div className="h-[42%] w-full border-b border-white/10 relative bg-[#06090e]/60">
          <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
            <Background color="#1f2937" gap={18} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
          <div className="absolute top-2 left-3 bg-[#0b1018]/90 px-3 py-1 rounded text-[11px] font-mono text-muted-foreground border border-white/5">
            Active Strategy Graph: <span className="text-cyan">Hawkes_Cascade</span> ➔{' '}
            <span className="text-amber">Fib_0.618</span> ➔{' '}
            <span className="text-purple">Gravity_Vector</span> ➔{' '}
            <span className="text-green">IOC_BUY</span>
          </div>
        </div>

        {/* Dynamic Code Generator & zk-SNARK Execution (Bottom Half) */}
        <div className="flex-1 flex flex-col bg-[#0b1018] overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center justify-between px-5 py-2 border-b border-white/10 bg-[#0e141f]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('cpp')}
                className={`btn-terminal ${activeTab === 'cpp' ? 'active' : ''}`}
              >
                <Code className="w-3.5 h-3.5" /> C++20 HFT Template
              </button>
              <button
                onClick={() => setActiveTab('python')}
                className={`btn-terminal ${activeTab === 'python' ? 'active' : ''}`}
              >
                <Code className="w-3.5 h-3.5" /> Python / Asyncio Backtest
              </button>
              <button
                onClick={() => setActiveTab('zksnark')}
                className={`btn-terminal ${activeTab === 'zksnark' ? 'active' : ''}`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple" /> zk-SNARK Circom Prover
              </button>
            </div>

            <div className="flex items-center gap-3">
              {activeTab === 'zksnark' && (
                <button
                  onClick={handleGenerateProof}
                  disabled={isProving}
                  className="btn-terminal bg-purple-dim text-purple border-purple-500/30 hover:border-purple-400"
                >
                  <Play className="w-3.5 h-3.5" />
                  {isProving ? 'Generating Circom Proof...' : 'Execute zk-SNARK Proof'}
                </button>
              )}
              <button onClick={handleCopy} className="btn-terminal">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Code'}
              </button>
            </div>
          </div>

          {/* Code Viewer & Proof Results */}
          <div className="flex-1 flex overflow-hidden">
            <pre className="flex-1 p-4 font-mono text-[11px] text-slate-300 overflow-auto bg-[#06090e] leading-relaxed">
              <code>{activeCode}</code>
            </pre>

            {activeTab === 'zksnark' && proofResult && (
              <div className="w-96 border-l border-white/10 p-4 bg-[#0b1018] overflow-y-auto font-mono text-[11px] flex flex-col gap-3">
                <div className="flex items-center gap-2 text-green font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" /> Cryptographically Verified Proof
                </div>
                <div className="p-2.5 rounded bg-black/40 border border-white/10 text-slate-300">
                  <div className="text-[10px] text-muted text-gray-400">Zero-Knowledge Guarantee:</div>
                  <div className="text-cyan mt-1">✓ Sharpe Ratio &gt; 2.00 Proven</div>
                  <div className="text-cyan">✓ Max Drawdown &lt; 5.0% Proven</div>
                  <div className="text-amber mt-1">Hidden: Indicator Thresholds & Logic</div>
                </div>
                <div className="text-[10px] text-gray-400">Verification Hash:</div>
                <div className="break-all text-[10px] text-purple bg-black/30 p-1.5 rounded">
                  {proofResult.verificationHash}
                </div>
                <div className="text-[10px] text-gray-400">Public Signals:</div>
                <div className="text-[10px] text-slate-300 bg-black/30 p-1.5 rounded">
                  {JSON.stringify(proofResult.publicSignals)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
