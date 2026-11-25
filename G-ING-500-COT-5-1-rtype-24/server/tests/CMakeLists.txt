add_executable(server_tests
  DatagramQueue_test.cpp
  Lobby_test.cpp
  Room_test.cpp
)
target_link_libraries(server_tests PRIVATE server_core GTest::gtest_main)
rtype_set_warnings(server_tests)
gtest_discover_tests(server_tests)
