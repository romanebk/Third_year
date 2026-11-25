# engine_asio: INetwork implemented with a non-blocking Asio UDP socket.
add_library(engine_asio STATIC
  src/AsioNetwork.cpp
)
target_include_directories(engine_asio PUBLIC include)
target_link_libraries(engine_asio
  PUBLIC engine
  PRIVATE asio
)
rtype_set_warnings(engine_asio)
