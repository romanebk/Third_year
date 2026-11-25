/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Le réseau de neurones : l'objet central du module.
** Dépend de : Layer.hpp, Loss.hpp, Optimizer.hpp, NetworkConfig.hpp, Serializer.hpp
*/

#pragma once

#include <memory>
#include <string>
#include <vector>

#include "mytorch/Layer.hpp"
#include "mytorch/Matrix.hpp"
#include "mytorch/Serializer.hpp"

namespace mytorch {

// Le réseau est la pile de couches et les métadonnées du fichier .nn (hyperparamètres
// d'entraînement, libellés de classes).
class Network {
public:
    Network() = default;
    // Prend la possession des couches de la description sérialisée.
    // Lève une FormatError si elle ne contient aucune couche.
    explicit Network(NetworkFile file);

    // Fichier .nn (voir docs/NN_FILE_FORMAT.md). Les erreurs sont des Error.
    void save(const std::string &path) const;
    static Network load(const std::string &path);

    // Passe avant en mode entraînement : chaque couche mémorise ce dont backward() a besoin.
    Matrix forward(const Matrix &input);
    // Passe avant en mode prédiction : le dropout est désactivé et rien n'est mémorisé.
    Matrix predict(const Matrix &input);
    // Rétropropagation : renvoie le gradient par rapport à l'entrée. Suit un forward().
    Matrix backward(const Matrix &gradOutput);

    // Les paramètres appris de toutes les couches, avec leurs gradients.
    std::vector<Parameter> parameters();

    std::vector<std::unique_ptr<Layer>> &layers() { return file_.layers; }
    const std::vector<std::unique_ptr<Layer>> &layers() const { return file_.layers; }
    const NetworkFile &file() const { return file_; }
    // Hyperparamètres d'entraînement stockés avec le réseau (modifiables : ils sont réécrits au save).
    TrainSettings &settings() { return file_.training; }
    const TrainSettings &settings() const { return file_.training; }

private:
    NetworkFile file_;
};

} // namespace mytorch
