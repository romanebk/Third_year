/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Algorithmes de mise à jour des poids.
** Dépend de : Matrix.hpp, Layer.hpp
*/

#pragma once

#include <vector>

#include "mytorch/Layer.hpp"
#include "mytorch/Network.hpp"
#include "mytorch/TrainSettings.hpp"

namespace mytorch {

// Descente de gradient avec momentum et régularisation L2 :
//     v     <- momentum · v + gradient
//     poids <- poids - learningRate · (v + l2 · poids)
// (momentum = 0 : descente de gradient simple). L'état (les vitesses v) est propre à
// l'optimiseur, un par paramètre du réseau.
class Optimizer {
public:
    // Les paramètres sont ceux du réseau au moment de la construction : l'optimiseur ne doit pas
    // survivre au réseau, ni être construit avant que ses couches soient en place.
    explicit Optimizer(Network &network, const TrainSettings &settings);

    // Applique une mise à jour à partir des gradients courants.
    void step();
    // Remet tous les gradients à zéro (à appeler entre deux mini-batchs).
    void zeroGradients();

    // Le pas d'apprentissage peut changer entre deux epochs (décroissance du learning rate).
    float learningRate() const { return learningRate_; }
    void setLearningRate(float learningRate) { learningRate_ = learningRate; }

private:
    std::vector<Parameter> parameters_;
    std::vector<std::vector<float>> velocities_;
    float learningRate_;
    float momentum_;
    float l2_;
};

} // namespace mytorch
