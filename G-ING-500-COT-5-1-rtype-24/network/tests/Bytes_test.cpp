#include "network/bytes.hpp"

#include <cstdint>
#include <gtest/gtest.h>
#include <string>
#include <vector>

namespace {

using Bytes = std::vector<std::uint8_t>;

} // namespace

TEST(BytesWriter, WritesLittleEndian)
{
    Bytes out;
    net::Writer w(out, 64);
    w.u16(0x1234);
    w.u32(0x11223344u);
    ASSERT_TRUE(w.ok());
    EXPECT_EQ(out, (Bytes{0x34, 0x12, 0x44, 0x33, 0x22, 0x11}));
}

TEST(BytesWriter, EncodesFloatAsIeee754)
{
    Bytes out;
    net::Writer w(out, 4);
    w.f32(1.0f);
    ASSERT_TRUE(w.ok());
    EXPECT_EQ(out, (Bytes{0x00, 0x00, 0x80, 0x3F}));
}

TEST(BytesWriter, EncodesSignedIntegersInTwosComplement)
{
    Bytes out;
    net::Writer w(out, 4);
    w.i32(-1);
    ASSERT_TRUE(w.ok());
    EXPECT_EQ(out, (Bytes{0xFF, 0xFF, 0xFF, 0xFF}));
}

TEST(BytesWriter, RejectsAWriteThatDoesNotFit)
{
    Bytes out;
    net::Writer w(out, 4);
    w.u32(0xAABBCCDDu);
    w.u8(0x01);
    EXPECT_FALSE(w.ok());
    EXPECT_EQ(out.size(), 4u); // the overflowing byte was not appended
}

TEST(BytesWriter, ARejectedWriteFreezesTheWriter)
{
    Bytes out;
    net::Writer w(out, 1);
    w.u16(0x1234);
    w.u8(0x01);
    EXPECT_FALSE(w.ok());
    EXPECT_TRUE(out.empty());
}

TEST(BytesWriter, RejectsStringsLongerThanA255BytePrefix)
{
    Bytes out;
    net::Writer w(out, 512);
    w.str(std::string(256, 'a'));
    EXPECT_FALSE(w.ok());
}

TEST(BytesReader, RoundTripsEveryPrimitive)
{
    Bytes out;
    net::Writer w(out, 64);
    w.u8(0x7F);
    w.u16(0xBEEF);
    w.u32(0xDEADBEEFu);
    w.i32(-42);
    w.f32(-1.5f);
    w.str("hello");
    ASSERT_TRUE(w.ok());

    net::Reader r(out.data(), out.size());
    EXPECT_EQ(r.u8(), 0x7F);
    EXPECT_EQ(r.u16(), 0xBEEF);
    EXPECT_EQ(r.u32(), 0xDEADBEEFu);
    EXPECT_EQ(r.i32(), -42);
    EXPECT_FLOAT_EQ(r.f32(), -1.5f);
    std::string text;
    r.str(text, 16);
    ASSERT_TRUE(r.ok());
    EXPECT_EQ(text, "hello");
    EXPECT_EQ(r.remaining(), 0u);
}

TEST(BytesReader, TruncatedReadFailsAndReturnsZero)
{
    const Bytes data{0x01, 0x02, 0x03};
    net::Reader r(data.data(), data.size());
    EXPECT_EQ(r.u32(), 0u);
    EXPECT_FALSE(r.ok());
    EXPECT_EQ(r.u8(), 0);
}

TEST(BytesReader, RejectsAStringLongerThanTheFieldLimit)
{
    Bytes out;
    net::Writer w(out, 32);
    w.str("0123456789");
    ASSERT_TRUE(w.ok());

    net::Reader r(out.data(), out.size());
    std::string text;
    r.str(text, 4);
    EXPECT_FALSE(r.ok());
}

TEST(BytesReader, RejectsATruncatedString)
{
    // the length prefix announces 5 bytes, only 2 are present
    const Bytes data{0x05, 'a', 'b'};
    net::Reader r(data.data(), data.size());
    std::string text;
    r.str(text, 16);
    EXPECT_FALSE(r.ok());
}

TEST(BytesReader, SkipCannotRunPastTheEnd)
{
    const Bytes data{1, 2, 3};
    net::Reader r(data.data(), data.size());
    r.skip(3);
    EXPECT_TRUE(r.ok());
    r.skip(1);
    EXPECT_FALSE(r.ok());
}

TEST(BytesReader, SkipAdvancesWithoutReading)
{
    const Bytes data{0xAA, 0xBB, 0xCC, 0xDD};
    net::Reader r(data.data(), data.size());
    r.skip(2);
    EXPECT_TRUE(r.ok());
    EXPECT_EQ(r.u16(), 0xDDCCu);
}
