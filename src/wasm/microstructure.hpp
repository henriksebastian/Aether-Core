#pragma once
#include <cmath>
#include <vector>
#include <numeric>
#include <algorithm>

namespace aether {

class MicrostructureCore {
public:
    MicrostructureCore() = default;

    // Multi-level weighted Micro-price
    // P_micro = (I_b * P_a + I_a * P_b) / (I_b + I_a)
    static double compute_micro_price(
        double best_bid_p, double best_bid_q,
        double best_ask_p, double best_ask_q,
        double depth_bid_q = 0.0, double depth_ask_q = 0.0
    ) noexcept {
        const double total_bid = best_bid_q + 0.5 * depth_bid_q;
        const double total_ask = best_ask_q + 0.5 * depth_ask_q;
        const double total_imbalance = total_bid + total_ask;

        if (total_imbalance <= 1e-9) {
            return 0.5 * (best_bid_p + best_ask_p);
        }

        return (total_bid * best_ask_p + total_ask * best_bid_p) / total_imbalance;
    }

    // Cont-Kukanov-Stoikov Order Flow Imbalance (OFI)
    // OFI_t = I_{P_b >= P_b_{-1}} * v_b - I_{P_b <= P_b_{-1}} * v_b_{-1}
    //       - I_{P_a <= P_a_{-1}} * v_a + I_{P_a >= P_a_{-1}} * v_a_{-1}
    double update_ofi(double bid_p, double bid_q, double ask_p, double ask_q) noexcept {
        if (prev_bid_p_ <= 0.0) {
            prev_bid_p_ = bid_p;
            prev_bid_q_ = bid_q;
            prev_ask_p_ = ask_p;
            prev_ask_q_ = ask_q;
            return 0.0;
        }

        double delta_bid_v = 0.0;
        if (bid_p > prev_bid_p_) delta_bid_v = bid_q;
        else if (bid_p == prev_bid_p_) delta_bid_v = bid_q - prev_bid_q_;
        else delta_bid_v = -prev_bid_q_;

        double delta_ask_v = 0.0;
        if (ask_p < prev_ask_p_) delta_ask_v = ask_q;
        else if (ask_p == prev_ask_p_) delta_ask_v = ask_q - prev_ask_q_;
        else delta_ask_v = -prev_ask_q_;

        const double instant_ofi = delta_bid_v - delta_ask_v;
        prev_bid_p_ = bid_p;
        prev_bid_q_ = bid_q;
        prev_ask_p_ = ask_p;
        prev_ask_q_ = ask_q;

        // Exponential smoothing on OFI stream
        ema_ofi_ = 0.85 * ema_ofi_ + 0.15 * instant_ofi;
        return ema_ofi_;
    }

    // Kyle's Lambda estimation: price return per unit of signed volume
    // Lambda = Cov(Delta P, Net Vol) / Var(Net Vol)
    double update_kyles_lambda(double mid_price, double trade_size, int side) noexcept {
        if (prev_mid_price_ <= 0.0) {
            prev_mid_price_ = mid_price;
            return 0.0001;
        }

        const double delta_p = mid_price - prev_mid_price_;
        prev_mid_price_ = mid_price;
        const double signed_vol = (side == 0 ? 1.0 : -1.0) * trade_size;

        if (price_deltas_.size() >= WindowSize) {
            price_deltas_.erase(price_deltas_.begin());
            signed_volumes_.erase(signed_volumes_.begin());
        }
        price_deltas_.push_back(delta_p);
        signed_volumes_.push_back(signed_vol);

        if (price_deltas_.size() < 5) {
            return 0.0001;
        }

        double sum_vol = 0.0, sum_dp = 0.0;
        for (size_t i = 0; i < price_deltas_.size(); ++i) {
            sum_vol += signed_volumes_[i];
            sum_dp  += price_deltas_[i];
        }
        const double mean_vol = sum_vol / price_deltas_.size();
        const double mean_dp  = sum_dp / price_deltas_.size();

        double cov = 0.0, var_vol = 0.0;
        for (size_t i = 0; i < price_deltas_.size(); ++i) {
            const double diff_v = signed_volumes_[i] - mean_vol;
            const double diff_p = price_deltas_[i] - mean_dp;
            cov     += diff_v * diff_p;
            var_vol += diff_v * diff_v;
        }

        if (var_vol <= 1e-12) return 0.0001;
        const double raw_lambda = std::abs(cov / var_vol);
        current_lambda_ = 0.9 * current_lambda_ + 0.1 * raw_lambda;
        return current_lambda_;
    }

    // Queue Priority Estimation:
    // Tracks position ahead of our synthetic order at best bid
    double update_queue_priority(double best_bid_q, double executed_volume_at_bid) noexcept {
        if (best_bid_q <= 0.0) return 1.0;
        queue_ahead_vol_ = std::max(0.0, queue_ahead_vol_ - executed_volume_at_bid);
        const double priority_fraction = 1.0 - (queue_ahead_vol_ / (best_bid_q + 1e-6));
        return std::clamp(priority_fraction, 0.0, 1.0);
    }

    void reset_queue_order(double current_depth_ahead) noexcept {
        queue_ahead_vol_ = current_depth_ahead;
    }

private:
    static constexpr size_t WindowSize = 30;
    double prev_bid_p_{0.0};
    double prev_bid_q_{0.0};
    double prev_ask_p_{0.0};
    double prev_ask_q_{0.0};
    double ema_ofi_{0.0};
    double prev_mid_price_{0.0};
    double current_lambda_{0.0001};
    double queue_ahead_vol_{5.0};
    std::vector<double> price_deltas_;
    std::vector<double> signed_volumes_;
};

} // namespace aether
