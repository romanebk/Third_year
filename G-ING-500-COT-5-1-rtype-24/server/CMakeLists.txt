# r-type_server: lobby + room processes (owner: Momo, gameplay hooks: Ariel)
add_library(server_core STATIC
  src/datagram_queues.cpp
  src/lobby.cpp
  src/room.cpp
)
target_include_directories(server_core PUBLIC include)
rtype_set_warnings(server_core)
target_link_libraries(server_core PUBLIC engine network game)

add_executable(r-type_server src/main.cpp)
target_link_libraries(r-type_server PRIVATE server_core)
rtype_set_warnings(r-type_server)

add_executable(r-type_lobby src/lobby_main.cpp)
target_link_libraries(r-type_lobby PRIVATE server_core)
rtype_set_warnings(r-type_lobby)
