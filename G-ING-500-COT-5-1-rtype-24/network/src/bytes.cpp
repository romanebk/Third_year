#include "network/bytes.hpp"

#include <cstring>

namespace net {

static_assert(sizeof(float) == 4, "the protocol encodes IEEE-754 singles");

Writer::Writer(std::vector<std::uint8_t> &out, std::size_t capacity)
    : _out(out), _capacity(capacity)
{
}

bool Writer::fits(std::size_t count)
{
    if (!_ok || _out.size() + count > _capacity) {
        _ok = false;
        return false;
    }
    return true;
}

void Writer::u8(std::uint8_t value)
{
    if (!fits(1)) {
        return;
    }
    _out.push_back(value);
}

void Writer::u16(std::uint16_t value)
{
    if (!fits(2)) {
        return;
    }
    _out.push_back(static_cast<std::uint8_t>(value & 0xFFu));
    _out.push_back(static_cast<std::uint8_t>((value >> 8) & 0xFFu));
}

void Writer::u32(std::uint32_t value)
{
    if (!fits(4)) {
        return;
    }
    for (unsigned shift = 0; shift < 32; shift += 8) {
        _out.push_back(static_cast<std::uint8_t>((value >> shift) & 0xFFu));
    }
}

void Writer::i32(std::int32_t value)
{
    u32(static_cast<std::uint32_t>(value));
}

void Writer::f32(float value)
{
    std::uint32_t bits = 0;
    std::memcpy(&bits, &value, sizeof(bits));
    u32(bits);
}

void Writer::str(std::string_view value)
{
    if (value.size() > 0xFFu) {
        _ok = false;
        return;
    }
    u8(static_cast<std::uint8_t>(value.size()));
    if (!fits(value.size())) {
        return;
    }
    const auto *first = reinterpret_cast<const std::uint8_t *>(value.data());
    _out.insert(_out.end(), first, first + value.size());
}

Reader::Reader(const std::uint8_t *data, std::size_t size) : _data(data), _size(size) {}

bool Reader::take(std::size_t count)
{
    if (!_ok || count > _size - _pos) {
        _ok = false;
        return false;
    }
    return true;
}

std::uint8_t Reader::u8()
{
    if (!take(1)) {
        return 0;
    }
    return _data[_pos++];
}

std::uint16_t Reader::u16()
{
    if (!take(2)) {
        return 0;
    }
    const auto lo = static_cast<std::uint16_t>(_data[_pos]);
    const auto hi = static_cast<std::uint16_t>(_data[_pos + 1]);
    _pos += 2;
    return static_cast<std::uint16_t>(lo | (hi << 8));
}

std::uint32_t Reader::u32()
{
    if (!take(4)) {
        return 0;
    }
    std::uint32_t value = 0;
    for (unsigned shift = 0; shift < 32; shift += 8) {
        value |= static_cast<std::uint32_t>(_data[_pos + shift / 8]) << shift;
    }
    _pos += 4;
    return value;
}

std::int32_t Reader::i32()
{
    return static_cast<std::int32_t>(u32());
}

float Reader::f32()
{
    const std::uint32_t bits = u32();
    float value = 0.0f;
    std::memcpy(&value, &bits, sizeof(value));
    return value;
}

void Reader::str(std::string &out, std::size_t maxLength)
{
    const auto length = static_cast<std::size_t>(u8());
    if (!_ok || length > maxLength) {
        _ok = false;
        return;
    }
    if (!take(length)) {
        return;
    }
    out.resize(length);
    if (length > 0) {
        std::memcpy(out.data(), _data + _pos, length);
    }
    _pos += length;
}

void Reader::skip(std::size_t count)
{
    if (!take(count)) {
        return;
    }
    _pos += count;
}

} // namespace net
