/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Lecture d'un fichier de configuration (.conf) et description d'un réseau.
** Dépend de : TrainSettings.hpp, Errors.hpp
*/

#pragma once

#include <cstddef>
#include <string>
#include <vector>

#include "mytorch/TrainSettings.hpp"

namespace mytorch {

// Description déclarative d'un réseau, lue dans un fichier .conf.
// Le générateur (my_torch_generator) transforme cette description en couches,
// puis en fichier .nn.
struct NetworkConfig {
    std::size_t inputSize = 773;
    std::size_t numClasses = 3;
    std::vector<std::size_t> hiddenSizes;
    std::vector<std::string> labels;
    std::string hiddenActivation = "relu";
    std::string hiddenInit = "he";
    std::string outputInit = "xavier";
    TrainSettings training;
};

// Lit un fichier .conf. Lève une FormatError si une clé est inconnue, si une
// valeur est invalide ou si une clé obligatoire manque.
NetworkConfig readConfigFile(const std::string &path);

} // namespace mytorch
