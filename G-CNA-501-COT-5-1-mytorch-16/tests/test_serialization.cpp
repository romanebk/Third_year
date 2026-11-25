/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests de sauvegarde et chargement binaire des réseaux (.nn).
** Dépend de : mytorch/Serializer.hpp
*/

#include <cstdint>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <random>
#include <string>
#include <vector>

#include "mytorch/Activation.hpp"
#include "mytorch/Dense.hpp"
#include "mytorch/Errors.hpp"
#include "mytorch/Init.hpp"
#include "mytorch/Matrix.hpp"
#include "mytorch/Serializer.hpp"

using mytorch::FileError;
using mytorch::FormatError;
using mytorch::Matrix;
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

static NetworkFile buildNetwork()
{
    NetworkFile net;
    net.inputSize = 4;
    net.numClasses = 3;
    net.labels = {"Nothing", "Check", "Checkmate"};
    net.training.epochs = 7;
    net.training.batchSize = 8;
    net.training.learningRate = 0.02f;
    net.training.momentum = 0.9f;
    net.training.l2 = 0.001f;
    net.training.dropout = 0.1f;
    net.training.seed = 123;
    std::mt19937 gen(1);
    net.layers.push_back(std::make_unique<Dense>(4, 5, InitStrategy::He, gen));
    net.layers.push_back(makeActivation("relu"));
    net.layers.push_back(std::make_unique<Dense>(5, 3, InitStrategy::Xavier, gen));
    net.layers.push_back(makeActivation("softmax"));
    return net;
}

static Matrix forwardAll(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &input)
{
    Matrix output = input;
    for (auto &layer : layers) {
        layer->setTraining(false);
        output = layer->forward(output);
    }
    return output;
}

static void compareParameters(Layer &left, Layer &right)
{
    std::vector<Parameter> a = left.parameters();
    std::vector<Parameter> b = right.parameters();
    CHECK(a.size() == b.size());
    for (std::size_t i = 0; i < a.size() && i < b.size(); i++) {
        CHECK(a[i].value->rows() == b[i].value->rows());
        CHECK(a[i].value->cols() == b[i].value->cols());
        for (std::size_t r = 0; r < a[i].value->rows(); r++)
            for (std::size_t c = 0; c < a[i].value->cols(); c++)
                CHECK((*a[i].value)(r, c) == (*b[i].value)(r, c));
    }
}

static void testRoundTrip()
{
    const std::string path = "/tmp/mytorch_test_network.nn";
    NetworkFile net = buildNetwork();
    saveNetwork(path, net);
    NetworkFile loaded = loadNetwork(path);
    CHECK(loaded.inputSize == net.inputSize);
    CHECK(loaded.numClasses == net.numClasses);
    CHECK(loaded.labels == net.labels);
    CHECK(loaded.training.epochs == net.training.epochs);
    CHECK(loaded.training.batchSize == net.training.batchSize);
    CHECK(loaded.training.learningRate == net.training.learningRate);
    CHECK(loaded.training.momentum == net.training.momentum);
    CHECK(loaded.training.l2 == net.training.l2);
    CHECK(loaded.training.dropout == net.training.dropout);
    CHECK(loaded.training.seed == net.training.seed);
    CHECK(loaded.layers.size() == net.layers.size());
    for (std::size_t i = 0; i < net.layers.size() && i < loaded.layers.size(); i++) {
        CHECK(loaded.layers[i]->type() == net.layers[i]->type());
        compareParameters(*net.layers[i], *loaded.layers[i]);
    }
}

static void testSamePredictions()
{
    const std::string path = "/tmp/mytorch_test_network.nn";
    NetworkFile net = buildNetwork();
    saveNetwork(path, net);
    NetworkFile loaded = loadNetwork(path);
    Matrix x(3, 4, 0.25f);
    Matrix before = forwardAll(net.layers, x);
    Matrix after = forwardAll(loaded.layers, x);
    CHECK(before.rows() == after.rows());
    CHECK(before.cols() == after.cols());
    for (std::size_t r = 0; r < before.rows(); r++)
        for (std::size_t c = 0; c < before.cols(); c++)
            CHECK(before(r, c) == after(r, c));
}

static void testMagic()
{
    const std::string path = "/tmp/mytorch_test_badmagic.nn";
    std::ofstream out(path, std::ios::binary);
    out.write("XXXX", 4);
    const char filler[64] = {};
    out.write(filler, sizeof(filler));
    out.close();
    CHECK(throws<FormatError>([&] { loadNetwork(path); }));
}

static void testVersion()
{
    const std::string path = "/tmp/mytorch_test_badversion.nn";
    std::ofstream out(path, std::ios::binary);
    out.write("MYTN", 4);
    std::uint32_t version = 99;
    out.write(reinterpret_cast<const char *>(&version), sizeof(version));
    out.close();
    CHECK(throws<FormatError>([&] { loadNetwork(path); }));
}

static void testTruncated()
{
    const std::string path = "/tmp/mytorch_test_truncated.nn";
    NetworkFile net = buildNetwork();
    saveNetwork(path, net);
    std::ofstream out(path, std::ios::binary | std::ios::trunc);
    out.write("MYTN", 4);
    out.close();
    CHECK(throws<FileError>([&] { loadNetwork(path); }));
}

static void testMissingFile()
{
    CHECK(throws<FileError>([] { loadNetwork("/tmp/mytorch_test_absent_file.nn"); }));
}

static void testUnknownLayer()
{
    const std::string path = "/tmp/mytorch_test_unknown_layer.nn";
    std::ofstream out(path, std::ios::binary);
    out.write("MYTN", 4);
    std::uint32_t version = 2;
    std::uint32_t nbLayers = 1;
    std::uint32_t inputSize = 4;
    std::uint32_t numClasses = 3;
    out.write(reinterpret_cast<const char *>(&version), sizeof(version));
    out.write(reinterpret_cast<const char *>(&nbLayers), sizeof(nbLayers));
    out.write(reinterpret_cast<const char *>(&inputSize), sizeof(inputSize));
    out.write(reinterpret_cast<const char *>(&numClasses), sizeof(numClasses));
    std::string labels = "Nothing";
    labels += '\0';
    std::uint32_t labelsLength = static_cast<std::uint32_t>(labels.size());
    out.write(reinterpret_cast<const char *>(&labelsLength), sizeof(labelsLength));
    out.write(labels.data(), static_cast<std::streamsize>(labels.size()));
    std::uint32_t epochs = 1;
    std::uint32_t batchSize = 1;
    float learningRate = 0.01f;
    float momentum = 0.0f;
    float l2 = 0.0f;
    float dropout = 0.0f;
    std::uint32_t seed = 42;
    out.write(reinterpret_cast<const char *>(&epochs), sizeof(epochs));
    out.write(reinterpret_cast<const char *>(&batchSize), sizeof(batchSize));
    out.write(reinterpret_cast<const char *>(&learningRate), sizeof(learningRate));
    out.write(reinterpret_cast<const char *>(&momentum), sizeof(momentum));
    out.write(reinterpret_cast<const char *>(&l2), sizeof(l2));
    out.write(reinterpret_cast<const char *>(&dropout), sizeof(dropout));
    out.write(reinterpret_cast<const char *>(&seed), sizeof(seed));
    std::string type = "bogus";
    std::uint32_t typeLength = static_cast<std::uint32_t>(type.size());
    out.write(reinterpret_cast<const char *>(&typeLength), sizeof(typeLength));
    out.write(type.data(), static_cast<std::streamsize>(type.size()));
    out.close();
    CHECK(throws<FormatError>([&] { loadNetwork(path); }));
}

static void testCompareHelper()
{
    NetworkFile net = buildNetwork();
    NetworkFile same = buildNetwork();
    compareParameters(*net.layers[0], *same.layers[0]);
}

int main()
{
    testRoundTrip();
    testSamePredictions();
    testMagic();
    testVersion();
    testTruncated();
    testMissingFile();
    testUnknownLayer();
    testCompareHelper();
    if (failures == 0)
        std::cout << "test_serialization : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
