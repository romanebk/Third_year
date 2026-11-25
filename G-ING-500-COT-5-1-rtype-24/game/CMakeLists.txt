# game: components, systems, levels, bosses (owner: Ariel)
add_library(game STATIC
  src/boss.cpp
  src/collision.cpp
  src/endless.cpp
  src/enemies.cpp
  src/level.cpp
  src/movement.cpp
  src/pickups.cpp
  src/player.cpp
  src/rules.cpp
  src/shoot.cpp
  src/snapshot.cpp
  src/tick.cpp
)
target_include_directories(game PUBLIC include)
rtype_set_warnings(game)
target_link_libraries(game PUBLIC engine)

if(RTYPE_BUILD_TESTS)
  add_subdirectory(tests)
endif()
