/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Stratégies d'initialisation des poids.
** Dépend de : Matrix.hpp
*/

#pragma once

#include <cstddef>
#include <random>
#include <string>

#include "mytorch/Matrix.hpp"

namespace mytorch {

enum class InitStrategy {
    Xavier, // uniforme sur [-l, +l], l = sqrt(6 / (n_in + n_out)) : tanh, sigmoid, softmax
    He,     // normale, écart-type sqrt(2 / n_in) : ReLU
    LeCun   // normale, écart-type sqrt(1 / n_in) : sigmoid, tanh
};

// Retrouve une stratégie à partir de son nom ("xavier", "he", "lecun", majuscules et
// espaces autour acceptés). Lève une FormatError si le nom est inconnu (utilisé pour
// lire le fichier .conf).
InitStrategy initStrategyFromName(const std::string &name);

// Matrice de poids (n_in x n_out) tirée au hasard selon la stratégie.
// Le générateur est passé en paramètre : un même std::mt19937 initialisé avec la même graine
// donne les mêmes poids, ce qui rend un entraînement reproductible.
Matrix initWeights(std::size_t nIn, std::size_t nOut, InitStrategy strategy, std::mt19937 &gen);

// Biais initialisés à zéro (1 x n_out).
Matrix initBias(std::size_t nOut);

} // namespace mytorch
