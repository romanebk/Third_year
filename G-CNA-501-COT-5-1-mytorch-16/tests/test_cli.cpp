/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests du parseur d'arguments de l'analyseur.
** Dépend de : include/analyzer/Cli.hpp
*/

#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

#include "mytorch/Errors.hpp"

// Le module analyseur n'est pas linké dans libmytorch.a : son source est inclus
// ici pour que le test soit exécuté par "make tests" sans toucher au Makefile.
#include "../src/analyzer/Cli.cpp"

using mytorch::analyzer::Mode;
using mytorch::analyzer::Options;
using mytorch::analyzer::parseArgs;

static int failures = 0;

#define CHECK(cond)                                                                 \
    do {                                                                            \
        if (!(cond)) {                                                              \
            std::cerr << "FAIL ligne " << __LINE__ << " : " #cond "\n";             \
            failures++;                                                             \
        }                                                                           \
    } while (0)

// Construit un argv classique à partir d'une liste de chaînes.
static std::vector<char *> makeArgv(std::vector<std::string> &storage)
{
    std::vector<char *> argv;
    for (std::string &value : storage)
        argv.push_back(const_cast<char *>(value.c_str()));
    return argv;
}

// Vérifie que l'appel est refusé avec une erreur d'arguments.
static void checkRejected(const std::vector<std::string> &arguments)
{
    std::vector<std::string> storage = arguments;
    std::vector<char *> argv = makeArgv(storage);
    bool thrown = false;
    try {
        parseArgs(static_cast<int>(argv.size()), argv.data());
    } catch (const mytorch::ArgumentError &) {
        thrown = true;
    }
    CHECK(thrown);
}

static void testTrainWithoutSave()
{
    std::vector<std::string> storage = {"my_torch_analyzer", "--train", "net.nn", "data.txt"};
    std::vector<char *> argv = makeArgv(storage);
    Options opt = parseArgs(static_cast<int>(argv.size()), argv.data());
    CHECK(opt.mode == Mode::Train);
    CHECK(opt.loadFile == "net.nn");
    CHECK(opt.chessFile == "data.txt");
    CHECK(!opt.hasSave);
}

static void testTrainWithSave()
{
    std::vector<std::string> storage = {"my_torch_analyzer", "--train", "--save", "out.nn",
                                         "net.nn", "data.txt"};
    std::vector<char *> argv = makeArgv(storage);
    Options opt = parseArgs(static_cast<int>(argv.size()), argv.data());
    CHECK(opt.mode == Mode::Train);
    CHECK(opt.hasSave);
    CHECK(opt.saveFile == "out.nn");
    CHECK(opt.loadFile == "net.nn");
    CHECK(opt.chessFile == "data.txt");
}

static void testPredict()
{
    std::vector<std::string> storage = {"my_torch_analyzer", "--predict", "net.nn", "data.txt"};
    std::vector<char *> argv = makeArgv(storage);
    Options opt = parseArgs(static_cast<int>(argv.size()), argv.data());
    CHECK(opt.mode == Mode::Predict);
    CHECK(opt.loadFile == "net.nn");
    CHECK(opt.chessFile == "data.txt");
    CHECK(!opt.hasSave);
}

// Un appel incomplet ne doit jamais lire hors du tableau d'arguments.
static void testIncompleteCallsAreRejected()
{
    checkRejected({"my_torch_analyzer"});
    checkRejected({"my_torch_analyzer", "--train"});
    checkRejected({"my_torch_analyzer", "--train", "net.nn"});
    checkRejected({"my_torch_analyzer", "--train", "--save"});
    checkRejected({"my_torch_analyzer", "--train", "--save", "out.nn"});
    checkRejected({"my_torch_analyzer", "--train", "--save", "out.nn", "net.nn"});
    checkRejected({"my_torch_analyzer", "--predict"});
    checkRejected({"my_torch_analyzer", "--predict", "net.nn"});
}

// Un appel en trop ou un mode inconnu est refusé.
static void testInvalidCallsAreRejected()
{
    checkRejected({"my_torch_analyzer", "--train", "net.nn", "data.txt", "extra.txt"});
    checkRejected({"my_torch_analyzer", "--predict", "net.nn", "data.txt", "extra.txt"});
    checkRejected({"my_torch_analyzer", "--save", "net.nn", "data.txt"});
    checkRejected({"my_torch_analyzer", "net.nn", "data.txt"});
}

int main()
{
    testTrainWithoutSave();
    testTrainWithSave();
    testPredict();
    testIncompleteCallsAreRejected();
    testInvalidCallsAreRejected();
    if (failures == 0)
        std::cout << "test_cli : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
