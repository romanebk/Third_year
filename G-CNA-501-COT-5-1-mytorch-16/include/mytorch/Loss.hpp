/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Fonctions de perte.
** Dépend de : Matrix.hpp
*/

#pragma once

#include "mytorch/Matrix.hpp"

namespace mytorch {

struct LossResult {
    double value = 0.0; // perte moyenne sur le lot
    Matrix gradient;    // gradient de la perte moyenne par rapport aux probabilités (N x C)
};

// Entropie croisée entre les probabilités d'une sortie Softmax et des cibles (N x C),
// en général one-hot : L = -(1/N) · Σ y·log(p).
//
// Le gradient est la vraie dérivée dL/dp = -y / (p·N), de sorte qu'il passe tel quel dans
// Softmax::backward (qui applique la jacobienne) et donne dL/dz = (p - y) / N. C'est
// équivalent à la forme (p - y)/p de docs/INTERFACES.md (elles ne diffèrent que d'une
// constante, que la jacobienne annule), mais celle-ci est la dérivée exacte de value.
// Les probabilités sont écrêtées à 1e-12 pour éviter log(0) et la division par zéro.
// Lève une DimensionError si les deux matrices n'ont pas la même taille.
LossResult crossEntropy(const Matrix &probabilities, const Matrix &targets);

} // namespace mytorch
