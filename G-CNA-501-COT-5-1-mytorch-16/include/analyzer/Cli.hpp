/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Lecture et validation des arguments de my_torch_analyzer.
** Dépend de : mytorch/Errors.hpp
*/

#pragma once

#include <string>

#include "mytorch/Errors.hpp"

namespace mytorch {
namespace analyzer {

enum class Mode {
    Train,
    Predict
};

struct Options {
    Mode mode;
    std::string loadFile;
    std::string chessFile;
    bool hasSave = false;
    std::string saveFile;
};

Options parseArgs(int argc, char **argv);

} // namespace analyzer
} // namespace mytorch
