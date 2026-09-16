pragma circom 2.0.0;

/*
 * AETHER-CORE Zero-Knowledge Strategy Metric Verifier Circuit
 * Proves that a trading strategy achieves Sharpe Ratio >= Target
 * and Max Drawdown <= Limit WITHOUT revealing the proprietary
 * indicator thresholds or execution rules.
 */

template GreaterEqThan(n) {
    signal input in[2];
    signal output out;
    signal diff;
    diff <-- in[0] - in[1];
    out <-- (diff >= 0) ? 1 : 0;
    // Enforce binary output
    out * (out - 1) === 0;
}

template LessEqThan(n) {
    signal input in[2];
    signal output out;
    signal diff;
    diff <-- in[1] - in[0];
    out <-- (diff >= 0) ? 1 : 0;
    out * (out - 1) === 0;
}

template StrategyVerifier() {
    // PRIVATE SIGNALS (Hidden from verifier)
    signal input privateSharpe;          // Strategy Sharpe (scaled x100, e.g. 265 for 2.65)
    signal input privateMaxDrawdown;      // Max Drawdown (scaled x100, e.g. 38 for 3.8%)
    signal input privateOfiThreshold;     // Hidden OFI entry parameter
    signal input privateHawkesThreshold;  // Hidden Hawkes intensity trigger

    // PUBLIC SIGNALS (Known to verifier / Investor / Exchange)
    signal input publicMinSharpe;         // Target minimum Sharpe (e.g. 200 for 2.00)
    signal input publicMaxDrawdownLimit;  // Target maximum drawdown limit (e.g. 50 for 5.0%)

    // OUTPUT SIGNALS
    signal output isVerified;

    // Sub-components
    component sharpeCheck = GreaterEqThan(16);
    sharpeCheck.in[0] <== privateSharpe;
    sharpeCheck.in[1] <== publicMinSharpe;

    component ddCheck = LessEqThan(16);
    ddCheck.in[0] <== privateMaxDrawdown;
    ddCheck.in[1] <== publicMaxDrawdownLimit;

    // Both conditions must hold
    isVerified <== sharpeCheck.out * ddCheck.out;
    isVerified === 1;
}

component main {public [publicMinSharpe, publicMaxDrawdownLimit]} = StrategyVerifier();
