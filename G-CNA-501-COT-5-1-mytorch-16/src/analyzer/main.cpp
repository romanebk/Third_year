/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Point d'entrée de my_torch_analyzer.
** Dépend de : Cli.hpp, TrainMode.hpp, PredictMode.hpp
*/

#include <iostream>
#include <string>

#include "analyzer/Cli.hpp"
#include "analyzer/PredictMode.hpp"
#include "analyzer/TrainMode.hpp"
#include "mytorch/Errors.hpp"

using namespace mytorch;
using namespace mytorch::analyzer;

static void printUsage()
{
    std::cout << "USAGE\n\t./my_torch_analyzer [--predict | --train [--save SAVEFILE]] LOADFILE CHESSFILE\n\n"
              << "DESCRIPTION\n"
              << "\t--train\tLaunch the neural network in training mode. Each chessboard in FILE must\n"
              << "\t\tcontain inputs to send to the neural network in FEN notation and the expected output separated by\n"
              << "\t\tspace. If specified, the newly trained neural network will be saved in SAVEFILE. Otherwise,\n"
              << "\t\tit will be saved in the original LOADFILE.\n\n"
              << "\t--predict\tLaunch the neural network in prediction mode. Each chessboard in FILE must\n"
              << "\t\tcontain inputs to send to the neural network in FEN notation, and optionally an expected output.\n\n"
              << "\t--save\tSave neural network into SAVEFILE. Only works in train mode.\n\n"
              << "\tLOADFILE\tFile containing an artificial neural network\n"
              << "\tCHESSFILE\tFile containing chessboards\n";
}

int main(int argc, char **argv)
{
    try {
        if (argc == 2 && std::string(argv[1]) == "--help") {
            printUsage();
            return 0;
        }
        Options opt = parseArgs(argc, argv);
        if (opt.mode == Mode::Train)
            runTrain(opt);
        else
            runPredict(opt);
        return 0;
    } catch (const Error &e) {
        std::cerr << e.what() << std::endl;
        return kErrorExitCode;
    } catch (const std::exception &e) {
        std::cerr << e.what() << std::endl;
        return kErrorExitCode;
    }
}
