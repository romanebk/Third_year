add_executable(client_tests
  Assets_test.cpp
  ClientWorld_test.cpp
  Config_test.cpp
  Prediction_test.cpp
  UdpConnection_test.cpp
  Viewport_test.cpp
  Voice_test.cpp
)
target_link_libraries(client_tests PRIVATE client_lib GTest::gtest_main)
# Folder of the sounds, for Assets_test.cpp.
target_compile_definitions(client_tests PRIVATE CLIENT_ASSETS_DIR="${CMAKE_CURRENT_SOURCE_DIR}/../assets")
rtype_set_warnings(client_tests)
gtest_discover_tests(client_tests)
