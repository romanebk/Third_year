/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Boucle d'entraînement.
** Dépend de : Network.hpp, Optimizer.hpp, Loss.hpp, Metrics.hpp
*/

#pragma once

#include "mytorch/Loss.hpp"
#include "mytorch/Network.hpp"
#include "mytorch/Optimizer.hpp"
#include "mytorch/TrainSettings.hpp"

namespace mytorch {

class Trainer {
public:
    Trainer(Network &network, Optimizer &optimizer, const TrainSettings &settings);

    // Un pas d'entraînement sur un mini-batch : passe avant, entropie croisée, rétropropagation,
    // mise à jour des poids. Renvoie la perte moyenne sur le lot.
    double trainBatch(const Matrix &inputs, const Matrix &targets);
    // Nom donné par docs/INTERFACES.md : même chose que trainBatch().
    double trainEpoch(const Matrix &inputs, const Matrix &targets) { return trainBatch(inputs, targets); }

    // Prédiction (mode prédiction, aucune mémorisation) : probabilités (N x classes).
    Matrix predict(const Matrix &inputs) { return network_.predict(inputs); }

    const TrainSettings &settings() const { return settings_; }

private:
    Network &network_;
    Optimizer &optimizer_;
    TrainSettings settings_;
};

} // namespace mytorch
