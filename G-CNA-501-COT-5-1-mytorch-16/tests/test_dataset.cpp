/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests du Dataset.
** Dépend de : chess/Dataset.hpp
*/

#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <random>
#include <string>
#include <vector>

#include "chess/Dataset.hpp"
#include "mytorch/Matrix.hpp"

using mytorch::FormatError;
using mytorch::Matrix;
using namespace mytorch::chess;

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

static void writeTmp(const std::string &path)
{
    std::ofstream f(path);
    f << "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 Nothing\n";
    f << "8/8/R2k4/4r1p1/8/5K2/5P2/8 b - - 7 59 Check White\n";
    f << "8/8/8/1p1p2p1/q1p5/8/K1k5/8 w - - 4 70 Checkmate Black\n";
    f << "8/5p1p/5K1P/6P1/7k/8/8/6R1 b - - 14 80 Nothing\n";
    f << "rnbqkbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3 Check Black\n";
    f << "8/8/K3Q2k/6p1/6Q1/4B3/7P/8 b - - 2 61 Checkmate White\n";
}

static void writeUnlabelled(const std::string &path)
{
    std::ofstream f(path);
    f << "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1\n";
}

static void testLoad()
{
    const std::string path = "/tmp/mytorch_test_dataset.txt";
    writeTmp(path);
    Dataset d = Dataset::loadFromFile(path, LabelMode::Full);
    CHECK(d.size() == 6);
    CHECK(!d.at(0).input.empty());
    CHECK(d.at(0).input.size() == kFenEncodedSize);
    CHECK(d.at(1).label < kNumClassesFull);
    CHECK(d.mode() == LabelMode::Full);
}

static void testLoadBasic()
{
    const std::string path = "/tmp/mytorch_test_dataset.txt";
    writeTmp(path);
    Dataset d = Dataset::loadFromFile(path, LabelMode::Basic);
    CHECK(d.size() == 6);
    CHECK(d.targets().cols() == kNumClassesBasic);
    CHECK(d.at(1).label == 1);
}

static void testSplit()
{
    const std::string path = "/tmp/mytorch_test_dataset.txt";
    Dataset d = Dataset::loadFromFile(path, LabelMode::Full);
    std::mt19937 gen(42);
    Dataset train, val, test;
    d.splitTrainValTest(0.6f, 0.2f, train, val, test, gen);
    CHECK(train.size() + val.size() + test.size() == d.size());
    CHECK(train.size() > 0);
    CHECK(train.mode() == LabelMode::Full);
}

static void testShuffle()
{
    const std::string path = "/tmp/mytorch_test_dataset.txt";
    Dataset d = Dataset::loadFromFile(path, LabelMode::Full);
    std::mt19937 gen(12345);
    d.shuffle(gen);
    CHECK(d.size() == 6);
}

static void testMatrices()
{
    const std::string path = "/tmp/mytorch_test_dataset.txt";
    Dataset d = Dataset::loadFromFile(path, LabelMode::Full);
    Matrix X = d.inputs();
    Matrix Y = d.targets();
    CHECK(X.rows() == d.size());
    CHECK(X.cols() == kFenEncodedSize);
    CHECK(Y.rows() == d.size());
    CHECK(Y.cols() == numClasses(LabelMode::Full));
    CHECK(Y(0, static_cast<std::size_t>(d.at(0).label)) == 1.0f);
}

static void testBatch()
{
    const std::string path = "/tmp/mytorch_test_dataset.txt";
    Dataset d = Dataset::loadFromFile(path, LabelMode::Full);
    Matrix X = d.batchInputs(2, 3);
    Matrix Y = d.batchTargets(2, 3);
    CHECK(X.rows() == 3);
    CHECK(X.cols() == kFenEncodedSize);
    CHECK(Y.rows() == 3);
    CHECK(Y.cols() == numClasses(LabelMode::Full));
    CHECK(X(0, 0) == d.at(2).input[0]);
}

static void testBatchOutOfRange()
{
    const std::string path = "/tmp/mytorch_test_dataset.txt";
    Dataset d = Dataset::loadFromFile(path, LabelMode::Full);
    Matrix X = d.batchInputs(4, 10);
    CHECK(X.rows() == 2);
    CHECK(d.batchInputs(100, 2).rows() == 0);
}

static void testClassWeights()
{
    const std::string path = "/tmp/mytorch_test_dataset.txt";
    Dataset d = Dataset::loadFromFile(path, LabelMode::Full);
    std::vector<float> weights = d.getClassWeights();
    CHECK(weights.size() == numClasses(LabelMode::Full));
    CHECK(weights[0] > 0.0f);
    CHECK(weights[1] > 0.0f);
}

static void testBalance()
{
    const std::string path = "/tmp/mytorch_test_dataset.txt";
    Dataset d = Dataset::loadFromFile(path, LabelMode::Full);
    std::mt19937 gen(7);
    d.balanceClasses(gen);
    std::vector<float> weights = d.getClassWeights();
    for (std::size_t i = 1; i < weights.size(); i++)
        CHECK(std::abs(weights[i] - weights[0]) < 0.001f);
}

static void testStrict()
{
    const std::string path = "/tmp/mytorch_test_unlabelled.txt";
    writeUnlabelled(path);
    Dataset d = Dataset::loadFromFile(path, LabelMode::Full, false);
    CHECK(d.size() == 0);
    CHECK(throws<FormatError>([&] { Dataset::loadFromFile(path, LabelMode::Full, true); }));
    // Le mode strict est le mode par défaut.
    CHECK(throws<FormatError>([&] { Dataset::loadFromFile(path); }));
    CHECK(throws<FormatError>([&] { Dataset::loadFromFile(path, LabelMode::Basic); }));
}

// Deux lignes valides, une ligne vide, puis une FEN sans étiquette à la ligne 4.
static void testStrictReportsLine()
{
    const std::string path = "/tmp/mytorch_test_mixed.txt";
    {
        std::ofstream f(path);
        f << "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 Nothing\n";
        f << "8/8/R2k4/4r1p1/8/5K2/5P2/8 b - - 7 59 Check White\n";
        f << "\n";
        f << "8/5p1p/5K1P/6P1/7k/8/8/6R1 b - - 14 80\n";
    }
    std::string message;
    try {
        Dataset::loadFromFile(path);
    } catch (const FormatError &e) {
        message = e.what();
    }
    CHECK(message.find("ligne 4") != std::string::npos);
    // En mode tolérant, la ligne sans étiquette est ignorée et les deux autres sont gardées.
    Dataset lenient = Dataset::loadFromFile(path, LabelMode::Full, false);
    CHECK(lenient.size() == 2);
}

// Un fichier vide (ou fait de lignes vides) ne donne pas de dataset vide en silence.
static void testStrictEmptyFile()
{
    const std::string path = "/tmp/mytorch_test_empty.txt";
    {
        std::ofstream f(path);
        f << "\n\n";
    }
    CHECK(throws<FormatError>([&] { Dataset::loadFromFile(path); }));
    CHECK(Dataset::loadFromFile(path, LabelMode::Full, false).size() == 0);
}

static void testErrors()
{
    CHECK(throws<mytorch::FileError>([] { Dataset::loadFromFile("/tmp/mytorch_does_not_exist_xyz.txt"); }));
}

int main()
{
    testLoad();
    testLoadBasic();
    testSplit();
    testShuffle();
    testMatrices();
    testBatch();
    testBatchOutOfRange();
    testClassWeights();
    testBalance();
    testStrict();
    testStrictReportsLine();
    testStrictEmptyFile();
    testErrors();
    if (failures == 0)
        std::cout << "test_dataset : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
