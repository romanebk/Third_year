#include "network/ServerConnection.hpp"
#include "network/UdpConnection.hpp"

namespace client {

std::unique_ptr<ServerConnection> createNetworkConnection()
{
    return std::make_unique<UdpConnection>();
}

} // namespace client
