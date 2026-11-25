# libnetwork: UDP protocol, serialization, lobby TCP (owner: Momo)
add_library(network STATIC
  src/bytes.cpp
  src/handshake.cpp
  src/lobby.cpp
  src/packet.cpp
  src/reliable.cpp
  src/udp_socket.cpp
)
target_include_directories(network PUBLIC include)
rtype_set_warnings(network)
target_link_libraries(network PUBLIC engine asio)

if(RTYPE_BUILD_TESTS)
  add_subdirectory(tests)
endif()
