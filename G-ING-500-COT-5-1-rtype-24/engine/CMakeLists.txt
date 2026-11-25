# libengine: game-independent core (ECS, scheduler, events, clock, logger) and
# the subsystem interfaces (IGraphics, IAudio, INetwork). No third-party
# dependency: libraries only appear in the optional modules below.
add_library(engine STATIC
  src/ecs/Registry.cpp
  src/ecs/Scheduler.cpp
  src/core/Clock.cpp
  src/core/Logger.cpp
)
target_include_directories(engine PUBLIC include)
rtype_set_warnings(engine)

# Optional modules: one implementation of the interfaces each. A game links only
# the ones it needs, and each can be turned off at configure time.
option(ENGINE_WITH_SFML "Build engine_sfml (IGraphics and IAudio over SFML)" ON)
option(ENGINE_WITH_ASIO "Build engine_asio (INetwork over Asio UDP)" ON)

if(ENGINE_WITH_SFML AND TARGET SFML::Graphics)
  add_subdirectory(modules/sfml)
endif()
if(ENGINE_WITH_ASIO AND TARGET asio)
  add_subdirectory(modules/asio)
endif()

if(RTYPE_BUILD_TESTS)
  add_subdirectory(tests)
endif()
