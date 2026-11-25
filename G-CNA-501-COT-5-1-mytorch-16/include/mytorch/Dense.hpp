/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Couche entièrement connectée (Z = X·W + b).
** Dépend de : Layer.hpp, Init.hpp
*/

#pragma once

#include <cstddef>
#include <random>

#include "mytorch/Init.hpp"
#include "mytorch/Layer.hpp"

namespace mytorch {

class Dense : public Layer {
public:
    // Couche vide, à remplir avec load().
    Dense() = default;
    // Poids (nIn x nOut) tirés selon la stratégie avec le générateur donné, biais à zéro.
    Dense(std::size_t nIn, std::size_t nOut, InitStrategy init, std::mt19937 &gen);

    // Z = X·W + b, avec X de taille (B x nIn). Renvoie (B x nOut).
    Matrix forward(const Matrix &input) override;
    // dW = Xᵀ·dOut, db = somme des lignes de dOut, renvoie dOut·Wᵀ.
    Matrix backward(const Matrix &gradOutput) override;

    std::vector<Parameter> parameters() override;

    std::string type() const override { return "dense"; }
    void save(std::ostream &out) const override;
    void load(std::istream &in) override;

private:
    Matrix weights_;
    Matrix bias_;
    Matrix weightsGrad_;
    Matrix biasGrad_;
    Matrix input_;
    bool hasInput_ = false;
};

} // namespace mytorch
