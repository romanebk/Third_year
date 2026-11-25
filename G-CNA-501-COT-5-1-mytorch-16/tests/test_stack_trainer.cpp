/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests du moteur d'entraînement : apprentissage du XOR et vérification du gradient.
** Dépend de : mytorch/StackTrainer.hpp
*/

#include <cmath>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <random>
#include <vector>

#include "mytorch/Activation.hpp"
#include "mytorch/Dense.hpp"
#include "mytorch/Errors.hpp"
#include "mytorch/Init.hpp"
#include "mytorch/Matrix.hpp"
#include "mytorch/StackTrainer.hpp"

using mytorch::Dense;
using mytorch::DimensionError;
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

#define CHECK_CLOSE(a, b)                                                          \
    do {                                                                            \
        if (std::abs((a) - (b)) > 1e-4) {                                          \
            std::cerr << "FAIL ligne " << __LINE__ << " : " #a " != " #b "\n";      \
            failures++;                                                             \
        }                                                                           \
    } while (0)

static const Matrix kXorInputs = Matrix({{0.0f, 0.0f},
                                          {0.0f, 1.0f},
                                          {1.0f, 0.0f},
                                          {1.0f, 1.0f}});

static const Matrix kXorTargets = Matrix({{1.0f, 0.0f},
                                          {0.0f, 1.0f},
                                          {0.0f, 1.0f},
                                          {1.0f, 0.0f}});

static std::vector<std::unique_ptr<Layer>> buildNetwork(const char *activation, std::uint32_t seed)
{
    std::mt19937 gen(seed);
    std::vector<std::unique_ptr<Layer>> layers;
    layers.push_back(std::make_unique<Dense>(2, 8, InitStrategy::He, gen));
    layers.push_back(makeActivation(activation));
    layers.push_back(std::make_unique<Dense>(8, 2, InitStrategy::Xavier, gen));
    layers.push_back(makeActivation("softmax"));
    return layers;
}

static TrainSettings xorSettings()
{
    TrainSettings settings;
    settings.epochs = 2000;
    settings.batchSize = 4;
    settings.learningRate = 0.5f;
    settings.seed = 42;
    return settings;
}

static void testXorIsLearned()
{
    std::vector<std::unique_ptr<Layer>> layers = buildNetwork("relu", 42);
    StackTrainer trainer(xorSettings());
    double loss = 0.0;
    for (std::size_t epoch = 0; epoch < trainer.settings().epochs; epoch++)
        loss = trainer.trainEpoch(layers, kXorInputs, kXorTargets);
    CHECK(loss < 0.05);
    Matrix probabilities = trainer.predict(layers, kXorInputs);
    std::vector<std::size_t> predicted = probabilities.argmaxRows();
    for (std::size_t i = 0; i < kXorInputs.rows(); i++)
        CHECK(predicted[i] == static_cast<std::size_t>(kXorTargets(i, 1) > 0.5f));
}

static void testPredictIsDeterministic()
{
    std::vector<std::unique_ptr<Layer>> layers = buildNetwork("relu", 42);
    StackTrainer trainer(xorSettings());
    Matrix first = trainer.predict(layers, kXorInputs);
    Matrix second = trainer.predict(layers, kXorInputs);
    for (std::size_t i = 0; i < first.rows(); i++)
        for (std::size_t j = 0; j < first.cols(); j++)
            CHECK(first(i, j) == second(i, j));
}

static void testProbabilitiesSumToOne()
{
    std::vector<std::unique_ptr<Layer>> layers = buildNetwork("relu", 42);
    StackTrainer trainer(xorSettings());
    Matrix probabilities = trainer.predict(layers, kXorInputs);
    for (std::size_t i = 0; i < probabilities.rows(); i++) {
        float sum = 0.0f;
        for (std::size_t j = 0; j < probabilities.cols(); j++)
            sum += probabilities(i, j);
        CHECK_CLOSE(sum, 1.0f);
    }
}

// Vérification du gradient par différences finies : (L(w+h) - L(w-h)) / 2h.
//
// L'activation cachée est tanh et non relu : le ReLU n'est pas dérivable en 0,
// la différence finie y mesure un saut et non la dérivée. Le réseau reste
// entièrement lisse, l'écart avec le gradient analytique reste sous 1e-4.
static void testGradientIsCorrect()
{
    std::vector<std::unique_ptr<Layer>> layers = buildNetwork("tanh", 7);
    StackTrainer trainer(xorSettings());
    Matrix probabilities = trainer.forward(layers, kXorInputs);
    Matrix gradient;
    trainer.crossEntropy(probabilities, kXorTargets, gradient);
    trainer.backward(layers, gradient);
    const float step = 1e-3f;
    for (auto &layer : layers) {
        for (Parameter &parameter : layer->parameters()) {
            for (std::size_t index = 0; index < parameter.value->size(); index++) {
                std::size_t row = index / parameter.value->cols();
                std::size_t column = index % parameter.value->cols();
                float saved = (*parameter.value)(row, column);
                (*parameter.value)(row, column) = saved + step;
                Matrix plus = trainer.forward(layers, kXorInputs);
                Matrix ignored;
                double lossPlus = trainer.crossEntropy(plus, kXorTargets, ignored);
                (*parameter.value)(row, column) = saved - step;
                Matrix minus = trainer.forward(layers, kXorInputs);
                double lossMinus = trainer.crossEntropy(minus, kXorTargets, ignored);
                (*parameter.value)(row, column) = saved;
                double numeric = (lossPlus - lossMinus) / (2.0 * step);
                double analytic = (*parameter.gradient)(row, column);
                CHECK_CLOSE(numeric, analytic);
            }
        }
    }
}

static void testDimensionError()
{
    std::vector<std::unique_ptr<Layer>> layers = buildNetwork("relu", 42);
    StackTrainer trainer(xorSettings());
    Matrix probabilities = trainer.forward(layers, kXorInputs);
    Matrix gradient;
    bool thrown = false;
    try {
        trainer.crossEntropy(probabilities, Matrix(4, 3, 0.0f), gradient);
    } catch (const DimensionError &) {
        thrown = true;
    }
    CHECK(thrown);
}

int main()
{
    testXorIsLearned();
    testPredictIsDeterministic();
    testProbabilitiesSumToOne();
    testGradientIsCorrect();
    testDimensionError();
    if (failures == 0)
        std::cout << "test_stack_trainer : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
