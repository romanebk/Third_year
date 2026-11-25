/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Chargement et préparation du dataset.
** Dépend de : Fen.hpp, Labels.hpp, mytorch/Matrix.hpp
*/

#pragma once

#include <cstddef>
#include <random>
#include <string>
#include <vector>

#include "chess/Fen.hpp"
#include "chess/Labels.hpp"
#include "mytorch/Matrix.hpp"

namespace mytorch {
namespace chess {

struct Sample {
    std::vector<float> input;
    std::size_t label = 0;
};

class Dataset {
public:
    Dataset() = default;

    // Charge un fichier texte (FEN + label). Par défaut (strict), on ne perd pas de données
    // en silence : une ligne sans étiquette, ou un fichier qui ne donne aucun échantillon,
    // est une FormatError. Avec strict = false, les lignes sans étiquette sont ignorées.
    static Dataset loadFromFile(const std::string &path, LabelMode mode = LabelMode::Full, bool strict = true);

    std::size_t size() const;
    const Sample &at(std::size_t index) const;
    Sample &at(std::size_t index);

    LabelMode mode() const;

    void addSample(const Sample &sample);
    void shuffle(std::mt19937 &gen);

    void trainTestSplit(float trainRatio, Dataset &train, Dataset &test, std::mt19937 &gen) const;
    void splitTrainValTest(float trainRatio, float valRatio, Dataset &train, Dataset &val, Dataset &test, std::mt19937 &gen) const;

    Matrix inputs() const;
    Matrix targets() const;

    // Renvoie un mini-batch directement sans copier tout le dataset
    Matrix batchInputs(std::size_t start, std::size_t batchSize) const;
    Matrix batchTargets(std::size_t start, std::size_t batchSize) const;
    std::pair<Matrix, Matrix> getBatch(std::size_t start, std::size_t batchSize) const;

    // Poids de classes pour gérer le déséquilibre (inverse frequency)
    std::vector<float> getClassWeights() const;

    // Sous-échantillonnage pour équilibrer les classes
    void balanceClasses(std::mt19937 &gen);

private:
    std::vector<Sample> samples_;
    LabelMode mode_ = LabelMode::Full;
};

} // namespace chess
} // namespace mytorch
