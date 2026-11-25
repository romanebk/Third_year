# r-type_client: window, rendering, input, audio, menus (owner: Alexis)

# Everything except main.cpp goes in a library, so the tests can use it too.
add_library(client_lib STATIC
  src/AssetManager.cpp
  src/Client.cpp
  src/Config.cpp
  src/SoundPlayer.cpp
  src/network/LocalServer.cpp
  src/network/NetworkConnection.cpp
  src/network/UdpConnection.cpp
  src/render/Background.cpp
  src/render/MenuBackground.cpp
  src/render/ScrollingBackground.cpp
  src/render/Viewport.cpp
  src/screens/ConnectScreen.cpp
  src/screens/GameOverScreen.cpp
  src/screens/GameScreen.cpp
  src/screens/LobbyScreen.cpp
  src/screens/MainMenuScreen.cpp
  src/screens/SettingsScreen.cpp
  src/ui/Menu.cpp
  src/ui/TextUtils.cpp
  src/world/ClientWorld.cpp
  src/world/Prediction.cpp
  src/world/Sprites.cpp
)
target_include_directories(client_lib PUBLIC src)
target_link_libraries(client_lib
  PUBLIC engine game network SFML::Graphics SFML::Window SFML::Audio SFML::System
)
# Used when the assets folder is not found next to the executable.
target_compile_definitions(client_lib PRIVATE RTYPE_ASSETS_DIR="${CMAKE_CURRENT_SOURCE_DIR}/assets")
rtype_set_warnings(client_lib)

add_executable(r-type_client src/main.cpp)
target_link_libraries(r-type_client PRIVATE client_lib)
rtype_set_warnings(r-type_client)

# Copy the assets next to the executable after each build (no manual step):
# client/assets (sounds, music, font) and the sprite sheets of the repository
# (sprites/ at the root).
add_custom_command(TARGET r-type_client POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory
          ${CMAKE_CURRENT_SOURCE_DIR}/assets $<TARGET_FILE_DIR:r-type_client>/assets
  COMMAND ${CMAKE_COMMAND} -E copy_directory
          ${PROJECT_SOURCE_DIR}/sprites $<TARGET_FILE_DIR:r-type_client>/assets/sprites
)

if(RTYPE_BUILD_TESTS)
  add_subdirectory(tests)
endif()
