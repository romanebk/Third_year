#include "engine/asio/AsioNetwork.hpp"

#include <chrono>
#include <cstdint>
#include <gtest/gtest.h>
#include <optional>
#include <thread>
#include <vector>

using engine::asio::AsioNetwork;

namespace {
// The socket never blocks: poll a little while the datagram travels.
std::optional<engine::Datagram> waitFor(engine::INetwork &net)
{
    for (int i = 0; i < 200; ++i) {
        if (auto d = net.receive()) {
            return d;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    return std::nullopt;
}
} // namespace

TEST(AsioNetwork, SendsAndReceivesOnLocalhost)
{
    AsioNetwork server;
    AsioNetwork client;
    ASSERT_TRUE(server.bind(0));
    ASSERT_TRUE(client.bind(0));
    ASSERT_NE(server.localPort(), 0);

    const std::vector<std::uint8_t> payload{0x52, 0x54, 0x01, 0x02};
    ASSERT_TRUE(client.send({"127.0.0.1", server.localPort()}, payload));

    const auto got = waitFor(server);
    ASSERT_TRUE(got.has_value());
    EXPECT_EQ(got->data, payload);
    EXPECT_EQ(got->from.port, client.localPort());

    // Reply to the sender address given by the datagram.
    const std::vector<std::uint8_t> reply{0xAA};
    ASSERT_TRUE(server.send(got->from, reply));
    const auto back = waitFor(client);
    ASSERT_TRUE(back.has_value());
    EXPECT_EQ(back->data, reply);
}

TEST(AsioNetwork, ReceiveNeverBlocks)
{
    AsioNetwork net;
    EXPECT_FALSE(net.receive().has_value()); // not bound
    ASSERT_TRUE(net.bind(0));
    EXPECT_FALSE(net.receive().has_value()); // nothing waiting
}

TEST(AsioNetwork, LocalhostNameAndSendWithoutBind)
{
    AsioNetwork server;
    ASSERT_TRUE(server.bind(0));
    AsioNetwork client; // never bound: opened on the first send
    const std::vector<std::uint8_t> payload{1, 2, 3};
    ASSERT_TRUE(client.send({"localhost", server.localPort()}, payload));
    const auto got = waitFor(server);
    ASSERT_TRUE(got.has_value());
    EXPECT_EQ(got->data, payload);
}

TEST(AsioNetwork, RejectsInvalidAddresses)
{
    AsioNetwork net;
    const std::vector<std::uint8_t> payload{1};
    EXPECT_FALSE(net.send({"not an address", 4300}, payload));
    EXPECT_FALSE(net.send({"127.0.0.1", 0}, payload));
}

TEST(AsioNetwork, PortAlreadyTakenFails)
{
    AsioNetwork first;
    ASSERT_TRUE(first.bind(0));
    AsioNetwork second;
    EXPECT_FALSE(second.bind(first.localPort()));
    EXPECT_EQ(second.localPort(), 0);
}
