# Pong: rules as a library (engine only), the window program on top of it.
add_library(pong_logic STATIC src/Pong.cpp)
target_include_directories(pong_logic PUBLIC src)
target_link_libraries(pong_logic PUBLIC engine)
rtype_set_warnings(pong_logic)

# The playable program needs a graphics module.
if(TARGET engine_sfml)
  add_executable(pong src/main.cpp)
  target_link_libraries(pong PRIVATE pong_logic engine_sfml)
  rtype_set_warnings(pong)
endif()

if(RTYPE_BUILD_TESTS)
  add_executable(pong_tests tests/Pong_test.cpp)
  target_link_libraries(pong_tests PRIVATE pong_logic GTest::gtest_main)
  rtype_set_warnings(pong_tests)
  gtest_discover_tests(pong_tests)
endif()
