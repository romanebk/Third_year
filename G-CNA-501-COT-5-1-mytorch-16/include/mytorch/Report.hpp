/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Export CSV des résultats d'entraînement (courbes, matrice de confusion).
** Dépend de : mytorch/Metrics.hpp
*/

#pragma once

#include <cstddef>
#include <string>
#include <vector>

#include "mytorch/Metrics.hpp"

namespace mytorch {

// Résultats d'une epoch : ce qui alimente les courbes d'apprentissage.
struct EpochReport {
    std::size_t epoch = 0;
    double loss = 0.0;
    double trainAccuracy = 0.0;
    double validationAccuracy = 0.0;
    double validationF1 = 0.0;
};

// Écrit les courbes d'apprentissage : une ligne par epoch, en-tête compris.
void writeLearningCurves(const std::string &path, const std::vector<EpochReport> &epochs);

// Écrit la matrice de confusion : première colonne = classe réelle, en-têtes = classes.
void writeConfusionMatrix(const std::string &path, const ClassificationReport &report);

// Écrit les métriques par classe (précision, rappel, F1, support).
void writeClassMetrics(const std::string &path, const ClassificationReport &report);

} // namespace mytorch
