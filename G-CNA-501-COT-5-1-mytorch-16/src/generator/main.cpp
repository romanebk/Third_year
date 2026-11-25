/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Point d'entrée de my_torch_generator : crée un ou plusieurs réseaux vierges.
** Dépend de : NetworkConfig.hpp, Serializer.hpp, chess/Labels.hpp
*/

#include <cerrno>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <random>
#include <string>
#include <vector>

#include "mytorch/Activation.hpp"
#include "mytorch/Dense.hpp"
#include "mytorch/Errors.hpp"
#include "mytorch/Init.hpp"
#include "mytorch/NetworkConfig.hpp"
#include "mytorch/Serializer.hpp"

using namespace mytorch;

namespace {

// Nombre maximal de réseaux générés en une commande : garde-fou contre une
// faute de frappe (un zéro de trop) qui remplirait le disque.
constexpr unsigned long kMaxBatch = 10000;

void printUsage()
{
    std::cout << "USAGE\n"
              << "\t./my_torch_generator CONFIG_FILE OUTPUT_FILE\n"
              << "\t./my_torch_generator CONFIG_FILE_1 NB_1 [CONFIG_FILE_2 NB_2 ...]\n\n"
              << "DESCRIPTION\n"
              << "\tCONFIG_FILE\tDescription of the network to create (see configs/*.conf)\n"
              << "\tOUTPUT_FILE\tFile where the created network is written (.nn)\n"
              << "\tNB_i\t\tNumber of networks to generate from CONFIG_FILE_i;\n"
              << "\t\t\tthey are written as <config>_1.nn ... <config>_NB_i.nn\n\n"
              << "EXAMPLES\n"
              << "\t./my_torch_generator configs/basic_network.conf basic.nn\n"
              << "\t./my_torch_generator configs/basic_network.conf 3\n";
}

void addHiddenLayers(const NetworkConfig &config, std::mt19937 &gen,
                     std::vector<std::unique_ptr<Layer>> &layers)
{
    std::size_t previous = config.inputSize;
    InitStrategy strategy = initStrategyFromName(config.hiddenInit);
    for (std::size_t size : config.hiddenSizes) {
        layers.push_back(std::make_unique<Dense>(previous, size, strategy, gen));
        layers.push_back(makeActivation(config.hiddenActivation));
        previous = size;
    }
}

void addOutputLayer(const NetworkConfig &config, std::mt19937 &gen,
                    std::vector<std::unique_ptr<Layer>> &layers)
{
    std::size_t previous = config.hiddenSizes.back();
    InitStrategy strategy = initStrategyFromName(config.outputInit);
    layers.push_back(std::make_unique<Dense>(previous, config.numClasses, strategy, gen));
    layers.push_back(makeActivation("softmax"));
}

NetworkFile buildNetwork(const NetworkConfig &config, unsigned int seed)
{
    std::mt19937 gen(seed);
    NetworkFile net;
    net.inputSize = config.inputSize;
    net.numClasses = config.numClasses;
    net.training = config.training;
    net.training.seed = seed;
    net.labels = config.labels;
    addHiddenLayers(config, gen, net.layers);
    addOutputLayer(config, gen, net.layers);
    return net;
}

// Lit un entier strictement positif. Refuse tout le reste (signe, espace,
// dépassement) pour que "3x" ou "-2" ne soient jamais pris pour un nombre.
bool readCount(const std::string &text, unsigned long &count)
{
    if (text.empty())
        return false;
    for (char c : text) {
        if (c < '0' || c > '9')
            return false;
    }
    errno = 0;
    char *end = nullptr;
    unsigned long value = std::strtoul(text.c_str(), &end, 10);
    if (errno != 0 || end == nullptr || *end != '\0' || value == 0 || value > kMaxBatch)
        return false;
    count = value;
    return true;
}

// "configs/basic_network.conf" -> "basic_network" : les réseaux générés en lot
// sont écrits dans le répertoire courant, comme dans l'exemple du sujet.
std::string configStem(const std::string &path)
{
    std::string name = path;
    std::string::size_type slash = name.find_last_of('/');
    if (slash != std::string::npos)
        name = name.substr(slash + 1);
    const std::string suffix = ".conf";
    if (name.size() > suffix.size()
        && name.compare(name.size() - suffix.size(), suffix.size(), suffix) == 0)
        name.erase(name.size() - suffix.size());
    if (name.empty())
        throw ArgumentError("my_torch_generator: nom de configuration invalide");
    return name;
}

void generateOne(const std::string &configPath, const std::string &outputPath,
                 unsigned int seedOffset)
{
    NetworkConfig config = readConfigFile(configPath);
    NetworkFile net = buildNetwork(config, config.training.seed + seedOffset);
    saveNetwork(outputPath, net);
    std::cout << "Réseau créé : " << outputPath << " (" << net.layers.size() << " couches, "
              << net.numClasses << " classes)" << std::endl;
}

// Un seul fichier : ./my_torch_generator CONFIG OUTPUT
void generateSingle(const char *configPath, const char *outputPath)
{
    generateOne(configPath, outputPath, 0);
}

// Lot : ./my_torch_generator CONFIG NB [CONFIG NB ...]
void generateBatch(int argc, char **argv)
{
    for (int i = 1; i + 1 < argc; i += 2) {
        unsigned long count = 0;
        if (!readCount(argv[i + 1], count))
            throw ArgumentError("my_torch_generator: nombre de réseaux invalide");
        std::string stem = configStem(argv[i]);
        for (unsigned long index = 1; index <= count; index++) {
            std::string output = stem + "_" + std::to_string(index) + ".nn";
            generateOne(argv[i], output, static_cast<unsigned int>(index - 1));
        }
    }
}

// Vrai si le texte ne contient que des chiffres. Sert à lever l'ambiguïté de
// l'appel à trois arguments : "CONFIG 3" est un lot, "CONFIG out.nn" un fichier.
bool looksLikeCount(const std::string &text)
{
    if (text.empty())
        return false;
    for (char c : text) {
        if (c < '0' || c > '9')
            return false;
    }
    return true;
}

bool isBatchCall(int argc, char **argv)
{
    return argc == 3 && looksLikeCount(argv[2]);
}

} // namespace

int main(int argc, char **argv)
{
    try {
        if (argc == 2 && std::string(argv[1]) == "--help") {
            printUsage();
            return 0;
        }
        if (argc < 3)
            throw ArgumentError("my_torch_generator: CONFIG_FILE et OUTPUT_FILE requis");
        if (argc == 3 && !isBatchCall(argc, argv)) {
            generateSingle(argv[1], argv[2]);
            return 0;
        }
        if (argc % 2 == 0)
            throw ArgumentError("my_torch_generator: paires CONFIG_FILE NB attendues");
        generateBatch(argc, argv);
        return 0;
    } catch (const Error &e) {
        std::cerr << e.what() << std::endl;
        return kErrorExitCode;
    } catch (const std::exception &e) {
        std::cerr << e.what() << std::endl;
        return kErrorExitCode;
    }
}
