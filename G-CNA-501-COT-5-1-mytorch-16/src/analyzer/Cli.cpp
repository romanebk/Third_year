/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Cli.hpp
** Dépend de : include/analyzer/Cli.hpp
*/

#include "analyzer/Cli.hpp"

#include <string>

namespace mytorch {
namespace analyzer {

namespace {

bool isFlag(const std::string &arg, const std::string &flag)
{
    return arg == flag;
}

void requireFiles(int argc, char **argv, int &i, Options &opt)
{
    // Deux fichiers sont attendus (LOADFILE puis CHESSFILE) : il faut donc que
    // argv[i] et argv[i + 1] existent, sinon on sort du tableau.
    if (i + 1 >= argc)
        throw ArgumentError("my_torch_analyzer: LOADFILE et CHESSFILE requis");
    opt.loadFile = argv[i++];
    opt.chessFile = argv[i++];
}

void parseTrain(int argc, char **argv, Options &opt)
{
    int i = 2;
    opt.mode = Mode::Train;
    if (i < argc && isFlag(argv[i], "--save")) {
        i++;
        if (i >= argc)
            throw ArgumentError("my_torch_analyzer: nom de fichier attendu après --save");
        opt.hasSave = true;
        opt.saveFile = argv[i++];
    }
    requireFiles(argc, argv, i, opt);
    if (i != argc)
        throw ArgumentError("my_torch_analyzer: trop d'arguments");
}

void parsePredict(int argc, char **argv, Options &opt)
{
    int i = 2;
    opt.mode = Mode::Predict;
    requireFiles(argc, argv, i, opt);
    if (i != argc)
        throw ArgumentError("my_torch_analyzer: trop d'arguments");
}

} // namespace

Options parseArgs(int argc, char **argv)
{
    Options opt;
    if (argc < 4)
        throw ArgumentError("my_torch_analyzer: arguments insuffisants");
    if (isFlag(argv[1], "--predict"))
        parsePredict(argc, argv, opt);
    else if (isFlag(argv[1], "--train"))
        parseTrain(argc, argv, opt);
    else
        throw ArgumentError("my_torch_analyzer: mode requis (--train ou --predict)");
    return opt;
}

} // namespace analyzer
} // namespace mytorch
