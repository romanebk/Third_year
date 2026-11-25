/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de PredictMode.hpp
** Dépend de : include/analyzer/PredictMode.hpp
*/

#include "analyzer/PredictMode.hpp"

#include <algorithm>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#include "chess/Augment.hpp"
#include "chess/Fen.hpp"
#include "mytorch/Errors.hpp"
#include "mytorch/Matrix.hpp"
#include "mytorch/Network.hpp"
#include "mytorch/StringUtils.hpp"

namespace mytorch {
namespace analyzer {

namespace {

constexpr std::size_t kPredictBatch = 256;

std::vector<std::string> readPositions(const std::string &path)
{
    std::ifstream in(path);
    if (!in.is_open())
        throw FileError("my_torch_analyzer: impossible d'ouvrir le fichier '" + path + "'");
    std::vector<std::string> lines;
    std::string line;
    while (std::getline(in, line)) {
        if (!trim(line).empty())
            lines.push_back(line);
    }
    if (lines.empty())
        throw FormatError("my_torch_analyzer: le fichier '" + path + "' ne contient aucune position");
    return lines;
}

Matrix encodePositions(const std::vector<std::string> &lines, std::size_t start, std::size_t count)
{
    Matrix inputs(count, chess::kFenEncodedSize, 0.0f);
    for (std::size_t i = 0; i < count; i++) {
        std::vector<float> encoded = chess::encodeString(lines[start + i]);
        if (encoded.size() != chess::kFenEncodedSize)
            throw FormatError("my_torch_analyzer: position invalide : " + lines[start + i]);
        for (std::size_t j = 0; j < encoded.size(); j++)
            inputs(i, j) = encoded[j];
    }
    return inputs;
}

std::string labelFor(const NetworkFile &net, std::size_t index)
{
    if (index >= net.labels.size())
        throw FormatError("my_torch_analyzer: le réseau ne définit pas assez de libellés");
    return net.labels[index];
}

// Test-time augmentation : chaque position est présentée dans les quatre
// symétries exactes du jeu d'échecs (identité, miroir, inversion des couleurs,
// les deux), puis les probabilités sont moyennées. Les réseaux medium et full
// ont été entraînés avec ces symétries ; le basic en profite aussi comme un
// ensemble de quatre vues. En mode 5 classes, l'échange des classes de couleur
// est réappliqué quand la symétrie inverse les couleurs. Coût : 4 passes avant
// au lieu d'une, pour +3,0 à +3,6 points de précision sur le jeu de test.
Matrix predictWithSymmetries(Network &net, const Matrix &inputs)
{
    constexpr int kSymmetryCount = 4;
    Matrix total(inputs.rows(), net.file().numClasses, 0.0f);
    for (int s = 0; s < kSymmetryCount; s++) {
        chess::Symmetry symmetry = static_cast<chess::Symmetry>(s);
        Matrix transformed = inputs;
        for (std::size_t i = 0; i < transformed.rows(); i++)
            chess::applySymmetry(&transformed(i, 0), symmetry);
        Matrix probabilities = net.predict(transformed);
        // L'échange des classes de couleur ne concerne que les réseaux 5 classes :
        // en mode 3 classes, « Check » et « Checkmate » ne nomment aucune couleur.
        bool flip = chess::flipsColors(symmetry) &&
                    probabilities.cols() == chess::kNumClassesFull;
        for (std::size_t i = 0; i < probabilities.rows(); i++) {
            for (std::size_t c = 0; c < probabilities.cols(); c++) {
                std::size_t source = c;
                if (flip) {
                    if (c == 1) source = 2;
                    else if (c == 2) source = 1;
                    else if (c == 3) source = 4;
                    else if (c == 4) source = 3;
                }
                total(i, c) += probabilities(i, source);
            }
        }
    }
    return total;
}

void predictChunk(Network &net, const std::vector<std::string> &lines, std::size_t start,
                  std::size_t count)
{
    Matrix inputs = encodePositions(lines, start, count);
    Matrix scores = predictWithSymmetries(net, inputs);
    std::vector<std::size_t> predicted = scores.argmaxRows();
    for (std::size_t i = 0; i < count; i++)
        std::cout << labelFor(net.file(), predicted[i]) << '\n';
}

} // namespace

void runPredict(const Options &opt)
{
    Network net = Network::load(opt.loadFile);
    std::vector<std::string> lines = readPositions(opt.chessFile);
    for (std::size_t start = 0; start < lines.size(); start += kPredictBatch) {
        std::size_t count = std::min(kPredictBatch, lines.size() - start);
        predictChunk(net, lines, start, count);
    }
}

} // namespace analyzer
} // namespace mytorch
