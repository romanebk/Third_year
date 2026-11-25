#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace net {

// Bounds-checked little-endian encoder (docs/rfc-protocol.md §2). Every write
// that would exceed the capacity fails the writer without touching the buffer,
// and every later write is a no-op, so the caller only checks ok() once, after
// the whole message.
class Writer {
public:
    // `out` is the destination buffer, `capacity` the maximum size it may
    // reach (kMaxUdpDatagram for a datagram).
    Writer(std::vector<std::uint8_t> &out, std::size_t capacity);

    void u8(std::uint8_t value);
    void u16(std::uint16_t value);
    void u32(std::uint32_t value);
    void i32(std::int32_t value);
    void f32(float value);
    void str(std::string_view value);

    [[nodiscard]] bool ok() const { return _ok; }
    [[nodiscard]] std::size_t size() const { return _out.size(); }

private:
    bool fits(std::size_t count);

    std::vector<std::uint8_t> &_out;
    std::size_t _capacity;
    bool _ok = true;
};

// Bounds-checked little-endian decoder (docs/rfc-protocol.md §2). A truncated
// or oversized read marks the reader as failed and returns 0, so decoding a
// malformed packet can neither throw nor read out of bounds; the caller checks
// ok() once, after the whole message.
class Reader {
public:
    Reader(const std::uint8_t *data, std::size_t size);

    std::uint8_t u8();
    std::uint16_t u16();
    std::uint32_t u32();
    std::int32_t i32();
    float f32();

    // u8 length prefix then the raw bytes, no terminator (§2). Fails when the
    // length exceeds `maxLength` or the payload is truncated.
    void str(std::string &out, std::size_t maxLength);

    // Advances without reading; fails past the end. Used for trailing bytes a
    // decoder does not know about yet (forward compatibility, §10).
    void skip(std::size_t count);

    [[nodiscard]] bool ok() const { return _ok; }
    [[nodiscard]] std::size_t remaining() const { return _size - _pos; }

private:
    bool take(std::size_t count);

    const std::uint8_t *_data;
    std::size_t _size;
    std::size_t _pos = 0;
    bool _ok = true;
};

} // namespace net
