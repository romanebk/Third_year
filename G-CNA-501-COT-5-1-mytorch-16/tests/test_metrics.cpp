/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests des métriques de classification.
** Dépend de : mytorch/Metrics.hpp
*/

#include <cmath>
#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

#include "mytorch/Errors.hpp"
#include "mytorch/Matrix.hpp"
#include "mytorch/Metrics.hpp"

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
        if (std::abs((a) - (b)) > 1e-6) {                                          \
            std::cerr << "FAIL ligne " << __LINE__ << " : " #a " != " #b "\n";      \
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

static const std::vector<std::string> kLabels = {"Nothing", "Check", "Checkmate"};

// Six positions : deux de chaque classe. Deux prédictions sont fausses.
static Matrix buildExpected()
{
    Matrix expected(6, 3, 0.0f);
    expected(0, 0) = 1.0f;
    expected(1, 1) = 1.0f;
    expected(2, 2) = 1.0f;
    expected(3, 0) = 1.0f;
    expected(4, 1) = 1.0f;
    expected(5, 2) = 1.0f;
    return expected;
}

static Matrix buildScores()
{
    Matrix scores(6, 3, 0.0f);
    scores(0, 0) = 1.0f; // Nothing : correct
    scores(1, 1) = 1.0f; // Check   : correct
    scores(2, 1) = 1.0f; // Checkmate predit Check : faux
    scores(3, 0) = 1.0f; // Nothing : correct
    scores(4, 0) = 1.0f; // Check predit Nothing : faux
    scores(5, 2) = 1.0f; // Checkmate : correct
    return scores;
}

static void testPerfectPrediction()
{
    ClassificationReport report = classify(buildExpected(), buildExpected(), kLabels);
    CHECK(report.numSamples == 6);
    CHECK_CLOSE(report.accuracy, 1.0);
    CHECK_CLOSE(report.macroF1, 1.0);
    for (const auto &metrics : report.perClass)
        CHECK_CLOSE(metrics.f1, 1.0);
}

static void testConfusionMatrix()
{
    ClassificationReport report = classify(buildScores(), buildExpected(), kLabels);
    CHECK(report.numSamples == 6);
    CHECK_CLOSE(report.accuracy, 4.0 / 6.0);
    CHECK(report.confusion.numClasses == 3);
    CHECK(report.confusion.total() == 6);
    CHECK(report.confusion.at(0, 0) == 2);
    CHECK(report.confusion.at(0, 1) == 0);
    CHECK(report.confusion.at(1, 0) == 1);
    CHECK(report.confusion.at(1, 1) == 1);
    CHECK(report.confusion.at(2, 1) == 1);
    CHECK(report.confusion.at(2, 2) == 1);
}

static void testPerClassMetrics()
{
    ClassificationReport report = classify(buildScores(), buildExpected(), kLabels);
    CHECK(report.perClass.size() == 3);
    CHECK(report.perClass[0].label == "Nothing");
    CHECK(report.perClass[0].truePositives == 2);
    CHECK(report.perClass[0].falsePositives == 1);
    CHECK(report.perClass[0].falseNegatives == 0);
    CHECK_CLOSE(report.perClass[0].precision, 2.0 / 3.0);
    CHECK_CLOSE(report.perClass[0].recall, 1.0);
    CHECK_CLOSE(report.perClass[0].f1, 0.8);
    CHECK_CLOSE(report.perClass[1].precision, 0.5);
    CHECK_CLOSE(report.perClass[1].recall, 0.5);
    CHECK_CLOSE(report.perClass[1].f1, 0.5);
    CHECK_CLOSE(report.perClass[2].precision, 1.0);
    CHECK_CLOSE(report.perClass[2].recall, 0.5);
    CHECK_CLOSE(report.perClass[2].f1, 2.0 / 3.0);
    CHECK_CLOSE(report.macroF1, (0.8 + 0.5 + 2.0 / 3.0) / 3.0);
}

static void testAbsentClass()
{
    Matrix expected(2, 3, 0.0f);
    expected(0, 0) = 1.0f;
    expected(1, 1) = 1.0f;
    Matrix scores(2, 3, 0.0f);
    scores(0, 0) = 1.0f;
    scores(1, 1) = 1.0f;
    ClassificationReport report = classify(scores, expected, kLabels);
    CHECK_CLOSE(report.perClass[2].precision, 0.0);
    CHECK_CLOSE(report.perClass[2].recall, 0.0);
    CHECK_CLOSE(report.perClass[2].f1, 0.0);
    CHECK_CLOSE(report.perClass[2].support, 0.0);
}

static void testEmpty()
{
    Matrix empty(0, 3, 0.0f);
    ClassificationReport report = classify(empty, empty, kLabels);
    CHECK(report.numSamples == 0);
    CHECK_CLOSE(report.accuracy, 0.0);
    CHECK(report.perClass.size() == 3);
}

static std::size_t report_at(std::size_t row, std::size_t column)
{
    ClassificationReport report = classify(buildScores(), buildExpected(), kLabels);
    return report.confusion.at(row, column);
}

static void testErrors()
{
    Matrix scores = buildScores();
    Matrix expected = buildExpected();
    CHECK(throws<DimensionError>([&] { classify(scores, Matrix(5, 3, 0.0f), kLabels); }));
    CHECK(throws<DimensionError>([&] { classify(scores, Matrix(6, 2, 0.0f), kLabels); }));
    CHECK(throws<DimensionError>([&] { classify(scores, expected, {"a", "b"}); }));
    CHECK(throws<DimensionError>([&] { report_at(4, 0); }));
}

int main()
{
    testPerfectPrediction();
    testConfusionMatrix();
    testPerClassMetrics();
    testAbsentClass();
    testEmpty();
    testErrors();
    if (failures == 0)
        std::cout << "test_metrics : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
