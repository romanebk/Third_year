#include "AssetManager.hpp"
#include "Client.hpp"

#include <cstdlib>
#include <exception>
#include <iostream>
#include <string>

namespace {

void printHelp()
{
    std::cout << "USAGE: ./r-type_client [options]\n"
              << "  --boss-preview    preview every boss without starting a game\n"
              << "  --host <address>  server address (opens the connection screen)\n"
              << "  --port <port>     UDP port of r-type_server (default 4300)\n"
              << "  --name <name>     player name\n"
              << "  --config <file>   settings file (default client.cfg)\n"
              << "  -h, --help        show this help\n";
}

} // namespace

int main(int argc, char **argv)
{
    client::LaunchOptions options;
    for (int i = 1; i < argc; i++) {
        const std::string arg = argv[i];
        const bool hasValue = i + 1 < argc;
        if (arg == "-h" || arg == "--help") {
            printHelp();
            return 0;
        } else if (arg == "--boss-preview") {
            options.bossPreview = true;
        } else if (arg == "--host" && hasValue) {
            options.host = argv[++i];
        } else if (arg == "--port" && hasValue) {
            const int port = std::atoi(argv[++i]);
            if (port <= 0 || port > 65535) {
                std::cerr << "Invalid port" << std::endl;
                return 84;
            }
            options.port = static_cast<unsigned short>(port);
        } else if (arg == "--name" && hasValue) {
            options.name = argv[++i];
        } else if (arg == "--config" && hasValue) {
            options.configFile = argv[++i];
        } else {
            std::cerr << "Unknown option: " << arg << " (try --help)" << std::endl;
            return 84;
        }
    }

    try {
        client::Client app(client::findAssetFolder(argv[0]), options);
        app.run();
    } catch (const std::exception &error) {
        std::cerr << "Error: " << error.what() << std::endl;
        return 84;
    }
    return 0;
}
