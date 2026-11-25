add_executable(network_tests
  Bytes_test.cpp
  Degraded_test.cpp
  Handshake_test.cpp
  Lobby_test.cpp
  Packet_test.cpp
  Reliable_test.cpp
)
target_link_libraries(network_tests PRIVATE network GTest::gtest_main)
rtype_set_warnings(network_tests)
gtest_discover_tests(network_tests)
