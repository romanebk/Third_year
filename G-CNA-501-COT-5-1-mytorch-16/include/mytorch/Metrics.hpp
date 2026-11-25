/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Métriques de classification : précision, rappel, F1, matrice de confusion.
** Dépend de : Matrix.hpp, Errors.hpp
*/

#pragma once

#include <cstddef>
#include <string>
#include <vector>

#include "mytorch/Matrix.hpp"

namespace mytorch {

// Mesures d'une classe. Le support est le nombre d'exemples réels de la classe.
struct ClassMetrics {
    std::string label;
    std::size_t truePositives = 0;
    std::size_t falsePositives = 0;
    std::size_t falseNegatives = 0;
    double precision = 0.0;
    double recall = 0.0;
    double f1 = 0.0;
    double support = 0.0;
};

// Matrice de confusion : counts[réel][prédit].
struct ConfusionMatrix {
    std::size_t numClasses = 0;
    std::vector<std::size_t> counts;

    std::size_t at(std::size_t trueIndex, std::size_t predictedIndex) const;
    std::size_t total() const;
};

// Bilan complet d'une classification.
struct ClassificationReport {
    std::size_t numSamples = 0;
    double accuracy = 0.0;
    double macroF1 = 0.0;
    std::vector<ClassMetrics> perClass;
    ConfusionMatrix confusion;
};

// Compare les scores prédits (N x C) aux cibles one-hot (N x C) et renvoie le bilan.
// Les scores sont des probabilités : la classe prédite est l'argmax de chaque ligne.
// Lève une DimensionError si les matrices ne correspondent pas.
ClassificationReport classify(const Matrix &scores, const Matrix &expected,
                               const std::vector<std::string> &labels);

} // namespace mytorch
