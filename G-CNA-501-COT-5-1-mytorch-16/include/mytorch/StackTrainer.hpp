/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Entraînement d'une pile de couches : passe avant, rétropropagation, entropie
** croisée et mise à jour des poids.
** Dépend de : Layer.hpp, Matrix.hpp, TrainSettings.hpp, Errors.hpp
*/

#pragma once

#include <cstddef>
#include <memory>
#include <unordered_map>
#include <vector>

#include "mytorch/Layer.hpp"
#include "mytorch/Matrix.hpp"
#include "mytorch/TrainSettings.hpp"

namespace mytorch {

// Entraîne une pile de couches (Layer) avec une descente de gradient,
// accélérée par un momentum lorsque les hyperparamètres en donnent un.
//
// Le module Trainer/Optimizer du cœur de réseau doit reprendre ce rôle : le
// contrat visé est décrit dans docs/INTERFACES.md. Cette implémentation n'utilise
// que l'interface publique Layer, ce qui permet à l'analyseur de s'entraîner
// sans dépendre des classes Network/Trainer encore en cours d'écriture.
//
// La pile doit se terminer par une activation Softmax : la perte est une entropie
// croisée entre les probabilités sorties et les cibles one-hot.
class StackTrainer {
public:
    explicit StackTrainer(const TrainSettings &settings);

    // Passe avant sur toute la pile, en mode entraînement.
    Matrix forward(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &input) const;
    // Passe avant en mode prédiction : le dropout est désactivé.
    Matrix predict(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &input) const;
    // Rétropropagation : renvoie le gradient par rapport à l'entrée.
    Matrix backward(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &gradOutput) const;

    // Entropie croisée entre probabilités (N x C) et cibles one-hot (N x C).
    // Renvoie la perte moyenne sur le lot et écrit dans `gradient` le gradient
    // de cette perte moyenne par rapport aux probabilités.
    double crossEntropy(const Matrix &probabilities, const Matrix &targets, Matrix &gradient) const;

    // Mise à jour des poids : descente de gradient avec momentum, régularisation L2 optionnelle.
    void update(std::vector<std::unique_ptr<Layer>> &layers) const;

    // Vide l'état interne de l'optimiseur (vitesses accumulées).
    // À appeler avant de réentraîner un réseau déjà entraîné.
    void resetOptimizerState();

    // Une epoch sur le lot donné : passe avant, perte, rétropropagation, mise à jour.
    // Renvoie la perte moyenne sur le lot.
    double trainEpoch(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &inputs,
                       const Matrix &targets) const;

    // Hyperparamètres utilisés par le moteur.
    const TrainSettings &settings() const { return settings_; }

private:
    // Vitesse accumulée pour chaque paramètre, indexée par l'adresse de ses valeurs.
    std::vector<float> &velocityFor(const Matrix *parameter) const;

    TrainSettings settings_;
    mutable std::unordered_map<const Matrix *, std::vector<float>> velocities_;
};

} // namespace mytorch
