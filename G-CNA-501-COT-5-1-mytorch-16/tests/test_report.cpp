/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests de l'export CSV des résultats.
** Dépend de : mytorch/Report.hpp
*/

#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "mytorch/Errors.hpp"
#include "mytorch/Matrix.hpp"
#include "mytorch/Metrics.hpp"
#include "mytorch/Report.hpp"

using mytorch::FileError;
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

static std::vector<std::string> readLines(const std::string &path)
{
    std::vector<std::string> lines;
    std::ifstream in(path);
    std::string line;
    while (std::getline(in, line))
        lines.push_back(line);
    return lines;
}

static ClassificationReport buildReport()
{
    Matrix scores(4, 2, 0.0f);
    scores(0, 0) = 1.0f;
    scores(1, 1) = 1.0f;
    scores(2, 1) = 1.0f;
    scores(3, 0) = 1.0f;
    Matrix expected(4, 2, 0.0f);
    expected(0, 0) = 1.0f;
    expected(1, 1) = 1.0f;
    expected(2, 0) = 1.0f;
    expected(3, 1) = 1.0f;
    return classify(scores, expected, {"Nothing", "Check"});
}

static void testLearningCurves()
{
    const std::string path = "/tmp/mytorch_test_curves.csv";
    std::vector<EpochReport> epochs;
    EpochReport first;
    first.epoch = 1;
    first.loss = 0.5;
    first.trainAccuracy = 0.8;
    first.validationAccuracy = 0.75;
    first.validationF1 = 0.7;
    epochs.push_back(first);
    EpochReport second = first;
    second.epoch = 2;
    second.loss = 0.25;
    epochs.push_back(second);
    writeLearningCurves(path, epochs);
    std::vector<std::string> lines = readLines(path);
    CHECK(lines.size() == 3);
    CHECK(lines[0] == "epoch,loss,train_accuracy,validation_accuracy,validation_f1");
    CHECK(lines[1].find("1,0.500000,0.800000,0.750000,0.700000") == 0);
    CHECK(lines[2].find("2,0.250000") == 0);
}

static void testConfusionMatrix()
{
    const std::string path = "/tmp/mytorch_test_confusion.csv";
    writeConfusionMatrix(path, buildReport());
    std::vector<std::string> lines = readLines(path);
    CHECK(lines.size() == 3);
    CHECK(lines[0] == "real\\predicted,Nothing,Check");
    CHECK(lines[1] == "Nothing,1,1");
    CHECK(lines[2] == "Check,1,1");
}

static void testClassMetrics()
{
    const std::string path = "/tmp/mytorch_test_metrics.csv";
    writeClassMetrics(path, buildReport());
    std::vector<std::string> lines = readLines(path);
    CHECK(lines.size() == 3);
    CHECK(lines[0] == "class,precision,recall,f1,support");
    CHECK(lines[1].find("Nothing,0.500000,0.500000,0.500000,2.000000") == 0);
}

static void testUnwritablePath()
{
    CHECK(throws<FileError>([] { writeClassMetrics("/tmp/mytorch_absent_dir/x.csv", buildReport()); }));
}

int main()
{
    testLearningCurves();
    testConfusionMatrix();
    testClassMetrics();
    testUnwritablePath();
    if (failures == 0)
        std::cout << "test_report : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
