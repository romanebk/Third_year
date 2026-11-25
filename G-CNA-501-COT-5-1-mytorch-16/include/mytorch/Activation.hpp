/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Fonctions d'activation sous forme de couches.
** Dépend de : Layer.hpp
*/

#pragma once

#include <memory>
#include <string>

#include "mytorch/Layer.hpp"

namespace mytorch {

// Couche sans paramètre à apprendre : rien à sauvegarder ni à charger.
// Mémorise (en mode entraînement) la valeur dont son backward() a besoin.
class Activation : public Layer {
public:
    void save(std::ostream &) const override {}
    void load(std::istream &) override {}

protected:
    void remember(const Matrix &value);
    const Matrix &remembered(const char *who) const;

private:
    Matrix cache_;
    bool hasCache_ = false;
};

// max(0, z). Dérivée : 1 si z > 0, sinon 0.
class ReLU : public Activation {
public:
    Matrix forward(const Matrix &input) override;
    Matrix backward(const Matrix &gradOutput) override;
    std::string type() const override { return "relu"; }
};

// 1 / (1 + e^-z). Dérivée : s·(1 - s).
class Sigmoid : public Activation {
public:
    Matrix forward(const Matrix &input) override;
    Matrix backward(const Matrix &gradOutput) override;
    std::string type() const override { return "sigmoid"; }
};

// Dérivée : 1 - t².
class Tanh : public Activation {
public:
    Matrix forward(const Matrix &input) override;
    Matrix backward(const Matrix &gradOutput) override;
    std::string type() const override { return "tanh"; }
};

// Softmax ligne par ligne, stable (on soustrait le maximum de la ligne avant l'exponentielle).
// backward() applique la vraie jacobienne : dIn_i = s_i · (g_i - Σ_j g_j·s_j). Il est donc correct
// seul. La fusion avec la cross-entropy (gradient (P - Y) / B) se décide dans Loss / Network.
class Softmax : public Activation {
public:
    Matrix forward(const Matrix &input) override;
    Matrix backward(const Matrix &gradOutput) override;
    std::string type() const override { return "softmax"; }
};

// Crée une activation à partir de son nom ("relu", "sigmoid", "tanh", "softmax", majuscules acceptées).
// Lève une FormatError si le nom est inconnu (utilisé par le fichier .conf et le chargement .nn).
std::unique_ptr<Layer> makeActivation(const std::string &name);

} // namespace mytorch
