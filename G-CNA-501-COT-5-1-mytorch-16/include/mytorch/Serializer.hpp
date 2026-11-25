/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Sauvegarde et chargement binaire des réseaux (.nn).
** Dépend de : Layer.hpp, TrainSettings.hpp, Errors.hpp
*/

#pragma once

#include <cstddef>
#include <iosfwd>
#include <memory>
#include <string>
#include <vector>

#include "mytorch/Layer.hpp"
#include "mytorch/TrainSettings.hpp"

namespace mytorch {

// Contenu complet d'un fichier .nn : l'architecture (les couches), les
// hyperparamètres d'entraînement et les libellés de classes affichés en prédiction.
struct NetworkFile {
    std::size_t inputSize = 0;
    std::size_t numClasses = 0;
    std::vector<std::string> labels;
    TrainSettings training;
    std::vector<std::unique_ptr<Layer>> layers;
};

// Écrit / lit la structure binaire décrite dans docs/NN_FILE_FORMAT.md.
void writeNetwork(std::ostream &out, const NetworkFile &net);
NetworkFile readNetwork(std::istream &in);

// Écrit / lit un fichier .nn complet. Les erreurs (fichier absent, magic
// incorrect, version inconnue, fichier tronqué) lèvent une Error.
void saveNetwork(const std::string &path, const NetworkFile &net);
NetworkFile loadNetwork(const std::string &path);

// Fabrique une couche à partir de son nom de type ("dense", "relu", ...).
// Lève une FormatError si le type est inconnu.
std::unique_ptr<Layer> makeLayer(const std::string &type);

} // namespace mytorch
