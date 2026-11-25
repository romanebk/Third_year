/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Init.hpp
** Dépend de : include/mytorch/Init.hpp
*/

#include "mytorch/Init.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>

namespace mytorch {

namespace {

// Tolère les espaces et les fins de ligne d'un fichier .conf ("  xavier\r\n").
std::string trim(const std::string &text)
{
    const std::string blanks = " \t\r\n";
    const std::size_t begin = text.find_first_not_of(blanks);
    if (begin == std::string::npos)
        return "";
    const std::size_t end = text.find_last_not_of(blanks);
    return text.substr(begin, end - begin + 1);
}

} // namespace

InitStrategy initStrategyFromName(const std::string &name)
{
    std::string lower = trim(name);
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (lower == "xavier")
        return InitStrategy::Xavier;
    if (lower == "he")
        return InitStrategy::He;
    if (lower == "lecun")
        return InitStrategy::LeCun;
    throw FormatError("Init: stratégie d'initialisation inconnue '" + name + "' (xavier, he ou lecun)");
}

Matrix initWeights(std::size_t nIn, std::size_t nOut, InitStrategy strategy, std::mt19937 &gen)
{
    if (nIn == 0 || nOut == 0)
        throw DimensionError("Init: une couche doit avoir au moins une entrée et une sortie");

    Matrix weights(nIn, nOut);
    float *values = weights.data();
    const float in = static_cast<float>(nIn);
    const float out = static_cast<float>(nOut);

    switch (strategy) {
    case InitStrategy::Xavier: {
        const float limit = std::sqrt(6.0f / (in + out));
        std::uniform_real_distribution<float> dist(-limit, limit);
        for (std::size_t i = 0; i < weights.size(); i++)
            values[i] = dist(gen);
        break;
    }
    case InitStrategy::He: {
        std::normal_distribution<float> dist(0.0f, std::sqrt(2.0f / in));
        for (std::size_t i = 0; i < weights.size(); i++)
            values[i] = dist(gen);
        break;
    }
    case InitStrategy::LeCun: {
        std::normal_distribution<float> dist(0.0f, std::sqrt(1.0f / in));
        for (std::size_t i = 0; i < weights.size(); i++)
            values[i] = dist(gen);
        break;
    }
    }
    return weights;
}

Matrix initBias(std::size_t nOut)
{
    if (nOut == 0)
        throw DimensionError("Init: une couche doit avoir au moins une sortie");
    return Matrix(1, nOut, 0.0f);
}

} // namespace mytorch
