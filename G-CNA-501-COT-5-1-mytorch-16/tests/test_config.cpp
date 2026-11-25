/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests de lecture des fichiers de configuration (.conf).
** Dépend de : mytorch/NetworkConfig.hpp
*/

#include <cstdlib>
#include <fstream>
#include <iostream>
#include <string>

#include "mytorch/Errors.hpp"
#include "mytorch/NetworkConfig.hpp"

using mytorch::FileError;
using mytorch::FormatError;
using namespace mytorch;

static int failures = 0;

#define CHECK(cond)                                                                 \
    do {                                                                            \
        if (!(cond)) {                                                              \
            std::cerr << "FAIL ligne " << __LINE__ << " : " #cond "\n";             \
            failures++;                                                             \
        }                                                                           \
    } while (0)

template <typename E, typename F>
static bool throws(F fn)
{
    try {
        fn();
    } catch (const E &) {
        return true;
    }
    return false;
}

static void writeConf(const std::string &path, const std::string &body)
{
    std::ofstream out(path);
    out << body;
}

static void testValidConfig()
{
    const std::string path = "/tmp/mytorch_test_config.conf";
    writeConf(path,
              "## un commentaire\n"
              "\n"
              "input_size = 773\n"
              "num_classes = 3\n"
              "label = Nothing\n"
              "label = Check\n"
              "label = Checkmate\n"
              "hidden_sizes = 64 32\n"
              "hidden_activation = relu\n"
              "hidden_init = he\n"
              "output_init = xavier\n"
              "epochs = 30\n"
              "batch_size = 64\n"
              "learning_rate = 0.01\n"
              "momentum = 0.9\n"
              "l2 = 0.0\n"
              "dropout = 0.0\n"
              "seed = 42\n");
    NetworkConfig config = readConfigFile(path);
    CHECK(config.inputSize == 773);
    CHECK(config.numClasses == 3);
    CHECK(config.labels.size() == 3);
    CHECK(config.labels[1] == "Check");
    CHECK(config.hiddenSizes.size() == 2);
    CHECK(config.hiddenSizes[0] == 64);
    CHECK(config.hiddenSizes[1] == 32);
    CHECK(config.hiddenActivation == "relu");
    CHECK(config.hiddenInit == "he");
    CHECK(config.outputInit == "xavier");
    CHECK(config.training.epochs == 30);
    CHECK(config.training.batchSize == 64);
    CHECK(config.training.learningRate == 0.01f);
    CHECK(config.training.momentum == 0.9f);
    CHECK(config.training.seed == 42);
}

static void testShippedConfigs()
{
    NetworkConfig basic = readConfigFile("configs/basic_network.conf");
    CHECK(basic.numClasses == 3);
    CHECK(basic.labels.size() == 3);
    CHECK(basic.hiddenSizes.size() == 2);
    NetworkConfig full = readConfigFile("configs/full_network.conf");
    CHECK(full.numClasses == 5);
    CHECK(full.labels.size() == 5);
    CHECK(full.labels[4] == "Checkmate Black");
}

static void testUnknownKey()
{
    const std::string path = "/tmp/mytorch_test_config_bad.conf";
    writeConf(path, "hidden_sizes = 8\nmystery = 3\n");
    CHECK(throws<FormatError>([&] { readConfigFile(path); }));
}

static void testMissingKey()
{
    const std::string path = "/tmp/mytorch_test_config_missing.conf";
    writeConf(path, "input_size = 773\n");
    CHECK(throws<FormatError>([&] { readConfigFile(path); }));
}

static void testBadValue()
{
    const std::string path = "/tmp/mytorch_test_config_value.conf";
    writeConf(path, "hidden_sizes = 8\nnum_classes = abc\n");
    CHECK(throws<FormatError>([&] { readConfigFile(path); }));
}

static void testWrongLabelCount()
{
    const std::string path = "/tmp/mytorch_test_config_labels.conf";
    writeConf(path, "hidden_sizes = 8\nnum_classes = 5\nlabel = Nothing\n");
    CHECK(throws<FormatError>([&] { readConfigFile(path); }));
}

static void testMissingFile()
{
    CHECK(throws<FileError>([] { readConfigFile("/tmp/mytorch_test_absent.conf"); }));
}

// Un momentum hors de l'intervalle [0, 1[ est refusé.
static void testBadMomentum()
{
    const std::string path = "/tmp/mytorch_test_config_momentum.conf";
    writeConf(path, "hidden_sizes = 8\nmomentum = 1.5\n");
    CHECK(throws<FormatError>([&] { readConfigFile(path); }));
}

// Le dropout n'est pas implémenté : toute valeur non nulle est refusée.
static void testBadDropout()
{
    const std::string path = "/tmp/mytorch_test_config_dropout.conf";
    writeConf(path, "hidden_sizes = 8\ndropout = 0.2\n");
    CHECK(throws<FormatError>([&] { readConfigFile(path); }));
    writeConf(path, "hidden_sizes = 8\ndropout = 2.0\n");
    CHECK(throws<FormatError>([&] { readConfigFile(path); }));
}

int main()
{
    testValidConfig();
    testShippedConfigs();
    testUnknownKey();
    testMissingKey();
    testBadValue();
    testWrongLabelCount();
    testMissingFile();
    testBadMomentum();
    testBadDropout();
    if (failures == 0)
        std::cout << "test_config : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
