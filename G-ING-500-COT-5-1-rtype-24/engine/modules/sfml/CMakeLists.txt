# engine_sfml: IGraphics and IAudio implemented with SFML.
add_library(engine_sfml STATIC
  src/SfmlGraphics.cpp
  src/SfmlAudio.cpp
)
target_include_directories(engine_sfml PUBLIC include)
target_link_libraries(engine_sfml
  PUBLIC engine
  PRIVATE SFML::Graphics SFML::Window SFML::Audio SFML::System
)
rtype_set_warnings(engine_sfml)
