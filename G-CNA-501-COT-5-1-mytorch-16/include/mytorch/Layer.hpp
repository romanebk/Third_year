/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Interface abstraite d'une couche du réseau.
** Dépend de : Matrix.hpp
*/

#pragma once

#include <iosfwd>
#include <string>
#include <vector>

#include "mytorch/Matrix.hpp"

namespace mytorch {

// Un paramètre appris et son gradient, tels que les voit l'optimiseur.
// Les deux pointeurs restent valides tant que la couche existe.
struct Parameter {
    Matrix *value;
    Matrix *gradient;
};

class Layer {
public:
    virtual ~Layer() = default;

    // Calcule la sortie. En mode entraînement, mémorise ce qu'il faut pour backward().
    virtual Matrix forward(const Matrix &input) = 0;
    // Reçoit le gradient de la perte par rapport à la sortie. Calcule les gradients des paramètres
    // et renvoie le gradient par rapport à l'entrée. Doit suivre un forward() en mode entraînement.
    virtual Matrix backward(const Matrix &gradOutput) = 0;

    // Paramètres appris et leurs gradients (vide pour une couche sans paramètre).
    virtual std::vector<Parameter> parameters() { return {}; }

    // Nom du type de couche ("dense", "relu", ...), écrit dans le fichier .nn par le Serializer.
    virtual std::string type() const = 0;
    // Écrit / lit les paramètres de la couche (pas son type : c'est le rôle du Serializer).
    virtual void save(std::ostream &out) const = 0;
    virtual void load(std::istream &in) = 0;

    // Mode entraînement (par défaut) ou prédiction. Seul le dropout se comporte différemment,
    // mais en prédiction toute couche évite de mémoriser son entrée.
    void setTraining(bool training) { training_ = training; }
    bool isTraining() const { return training_; }

protected:
    bool training_ = true;
};

} // namespace mytorch
