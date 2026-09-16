#pragma once
#include <cstdint>
#include <atomic>
#include <cstddef>

namespace aether {

#pragma pack(push, 1)
struct EventPacket {
    uint64_t timestamp_ns;
    uint32_t seq_num;
    uint8_t  event_type; // 0=depth, 1=trade, 2=sim_l3
    uint8_t  side;       // 0=bid/buy, 1=ask/sell
    uint16_t flags;
    double   price;
    double   quantity;
    double   extra_param; // e.g. order_id hash or delta
};

struct alignas(64) SharedBufferHeader {
    std::atomic<uint32_t> write_idx{0};
    std::atomic<uint32_t> read_idx{0};
    uint32_t capacity{4096};
    uint32_t element_size{sizeof(EventPacket)};
    
    // Microstructure Outputs calculated by WASM
    double micro_price{0.0};
    double ofi{0.0};
    double kyles_lambda{0.0};
    double queue_priority{0.0};
    double shannon_entropy{0.0};
    double hawkes_intensity{0.0};
    uint64_t last_update_ns{0};
};
#pragma pack(pop)

template <size_t Capacity = 4096>
class LockFreeRingBuffer {
    static_assert((Capacity & (Capacity - 1)) == 0, "Capacity must be power of two");
public:
    LockFreeRingBuffer(SharedBufferHeader* header, EventPacket* storage)
        : header_(header), storage_(storage) {
        if (header_) {
            header_->capacity = Capacity;
            header_->element_size = sizeof(EventPacket);
        }
    }

    bool push(const EventPacket& item) noexcept {
        const uint32_t current_write = header_->write_idx.load(std::memory_order_relaxed);
        const uint32_t current_read  = header_->read_idx.load(std::memory_order_acquire);

        if ((current_write - current_read) >= Capacity) {
            return false; // Buffer full
        }

        storage_[current_write & BufferMask] = item;
        header_->write_idx.store(current_write + 1, std::memory_order_release);
        return true;
    }

    bool pop(EventPacket& item) noexcept {
        const uint32_t current_read  = header_->read_idx.load(std::memory_order_relaxed);
        const uint32_t current_write = header_->write_idx.load(std::memory_order_acquire);

        if (current_read == current_write) {
            return false; // Buffer empty
        }

        item = storage_[current_read & BufferMask];
        header_->read_idx.store(current_read + 1, std::memory_order_release);
        return true;
    }

    size_t size() const noexcept {
        return header_->write_idx.load(std::memory_order_relaxed) -
               header_->read_idx.load(std::memory_order_relaxed);
    }

private:
    static constexpr uint32_t BufferMask = Capacity - 1;
    SharedBufferHeader* header_;
    EventPacket* storage_;
};

} // namespace aether
