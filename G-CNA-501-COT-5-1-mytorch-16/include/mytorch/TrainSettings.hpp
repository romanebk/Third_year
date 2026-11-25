/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Hyperparamètres d'entraînement conservés dans le fichier .nn.
** Dépend de : -
*/

#pragma once

#include <cstddef>
#include <cstdint>

namespace mytorch {

// Les hyperparamètres voyagent dans le fichier .nn : l'analyseur n'a pas
// d'option pour les passer en ligne de commande, ils sont donc lus au chargement.
struct TrainSettings {
    std::size_t epochs = 20;
    std::size_t batchSize = 32;
    float learningRate = 0.01f;
    float momentum = 0.0f;
    float l2 = 0.0f;
    float dropout = 0.0f;
    std::uint32_t seed = 42;
};

} // namespace mytorch
