add_executable(engine_tests
  ecs/Entity_test.cpp
  ecs/SparseArray_test.cpp
  ecs/Registry_test.cpp
  ecs/View_test.cpp
  ecs/Scheduler_test.cpp
  core/EventBus_test.cpp
  core/Clock_test.cpp
  core/Logger_test.cpp
  subsystems/Null_test.cpp
)
target_link_libraries(engine_tests PRIVATE engine GTest::gtest_main)

# Module tests only when the module is built.
if(TARGET engine_asio)
  target_sources(engine_tests PRIVATE subsystems/AsioNetwork_test.cpp)
  target_link_libraries(engine_tests PRIVATE engine_asio)
endif()

rtype_set_warnings(engine_tests)
gtest_discover_tests(engine_tests)
