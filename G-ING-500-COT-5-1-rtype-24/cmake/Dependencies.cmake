# Third-party dependencies, fetched with CPM. Pin every version.
include(${CMAKE_CURRENT_LIST_DIR}/CPM.cmake)

if(RTYPE_BUILD_TESTS)
  CPMAddPackage(
    NAME googletest
    GITHUB_REPOSITORY google/googletest
    VERSION 1.15.2
    OPTIONS "INSTALL_GTEST OFF" "gtest_force_shared_crt ON"
  )
endif()

# UDP/TCP sockets on Linux and Windows. Standalone Asio is header-only: it is
# downloaded, not built, and needs no system package.
CPMAddPackage(
  NAME asio
  GITHUB_REPOSITORY chriskohlhoff/asio
  GIT_TAG asio-1-30-2
  DOWNLOAD_ONLY YES
)
add_library(asio INTERFACE)
target_include_directories(asio SYSTEM INTERFACE ${asio_SOURCE_DIR}/asio/include)
target_compile_definitions(asio INTERFACE ASIO_STANDALONE)
find_package(Threads REQUIRED)
target_link_libraries(asio INTERFACE Threads::Threads)

# Client only: windowing, rendering, input and audio. SFML fetches its own
# FreeType, Ogg, Vorbis and FLAC; on Linux it needs the system X11, OpenGL and
# udev development packages (see README).
if(RTYPE_BUILD_CLIENT)
  CPMAddPackage(
    NAME SFML
    VERSION 3.0.2
    URL https://github.com/SFML/SFML/archive/refs/tags/3.0.2.tar.gz
    URL_HASH SHA256=0034e05f95509e5d3fb81b1625713e06da7b068f210288ce3fd67106f8f46995
    SYSTEM YES
    OPTIONS
      "BUILD_SHARED_LIBS OFF"
      "SFML_BUILD_NETWORK OFF"
      "SFML_USE_SYSTEM_DEPS OFF"
      "SFML_BUILD_EXAMPLES OFF"
      "SFML_BUILD_TEST_SUITE OFF"
      "SFML_BUILD_DOC OFF"
  )
endif()
