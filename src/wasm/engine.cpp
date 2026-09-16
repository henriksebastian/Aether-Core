#include "ring_buffer.hpp"
#include "microstructure.hpp"
#include <cstring>

static aether::SharedBufferHeader* g_header = nullptr;
static aether::EventPacket* g_events = nullptr;
static aether::LockFreeRingBuffer<4096>* g_ring_buffer = nullptr;
static aether::MicrostructureCore g_micro_core;

extern "C" {

void init_aether_engine(uint8_t* shared_memory_ptr, uint32_t capacity) {
    if (!shared_memory_ptr) return;
    g_header = reinterpret_cast<aether::SharedBufferHeader*>(shared_memory_ptr);
    g_events = reinterpret_cast<aether::EventPacket*>(shared_memory_ptr + sizeof(aether::SharedBufferHeader));
    
    if (g_ring_buffer) delete g_ring_buffer;
    g_ring_buffer = new aether::LockFreeRingBuffer<4096>(g_header, g_events);
}

void push_depth_event(double bid_p, double bid_q, double ask_p, double ask_q, uint64_t ts_ns) {
    if (!g_ring_buffer || !g_header) return;

    aether::EventPacket pkt{};
    pkt.timestamp_ns = ts_ns;
    pkt.event_type = 0; // Depth
    pkt.price = 0.5 * (bid_p + ask_p);
    pkt.quantity = bid_q + ask_q;
    g_ring_buffer->push(pkt);

    // Compute Microstructure in WASM
    const double micro = aether::MicrostructureCore::compute_micro_price(bid_p, bid_q, ask_p, ask_q);
    const double ofi = g_micro_core.update_ofi(bid_p, bid_q, ask_p, ask_q);

    g_header->micro_price = micro;
    g_header->ofi = ofi;
    g_header->last_update_ns = ts_ns;
}

void push_trade_event(double price, double size, int side, uint64_t ts_ns) {
    if (!g_ring_buffer || !g_header) return;

    aether::EventPacket pkt{};
    pkt.timestamp_ns = ts_ns;
    pkt.event_type = 1; // Trade
    pkt.side = static_cast<uint8_t>(side);
    pkt.price = price;
    pkt.quantity = size;
    g_ring_buffer->push(pkt);

    // Update Kyle's Lambda and Queue Priority
    const double lambda = g_micro_core.update_kyles_lambda(price, size, side);
    const double q_prio = g_micro_core.update_queue_priority(g_header->ofi, size);

    g_header->kyles_lambda = lambda;
    g_header->queue_priority = q_prio;
    g_header->last_update_ns = ts_ns;
}

double get_micro_price() { return g_header ? g_header->micro_price : 0.0; }
double get_ofi() { return g_header ? g_header->ofi : 0.0; }
double get_kyles_lambda() { return g_header ? g_header->kyles_lambda : 0.0; }
double get_queue_priority() { return g_header ? g_header->queue_priority : 0.0; }

} // extern "C"
