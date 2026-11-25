/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de TrainMode.hpp
** Dépend de : include/analyzer/TrainMode.hpp
*/

#include "analyzer/TrainMode.hpp"

#include <algorithm>
#include <cstdlib>
#include <iostream>
#include <random>
#include <string>
#include <utility>
#include <vector>

#include "chess/Augment.hpp"
#include "chess/Dataset.hpp"
#include "chess/Labels.hpp"
#include "mytorch/Errors.hpp"
#include "mytorch/Metrics.hpp"
#include "mytorch/Network.hpp"
#include "mytorch/Optimizer.hpp"
#include "mytorch/Report.hpp"
#include "mytorch/Trainer.hpp"

namespace mytorch {
namespace analyzer {

namespace {

// 10 % des positions servent à la validation, le reste à l'entraînement.
constexpr std::size_t kValidationRatio = 10;
// Nombre de positions évaluées pour la précision d'entraînement (courbe de gauche).
constexpr std::size_t kAccuracySample = 4096;

chess::LabelMode labelModeFor(std::size_t numClasses)
{
    if (numClasses == chess::kNumClassesBasic)
        return chess::LabelMode::Basic;
    if (numClasses == chess::kNumClassesFull)
        return chess::LabelMode::Full;
    throw ArgumentError("my_torch_analyzer: le réseau a " + std::to_string(numClasses) +
                         " classes, 3 (basic) ou 5 (full) sont attendues");
}

// Vérifie que l'ordre des libellés du réseau est celui attendu par le mode :
// sinon les cibles one-hot et les sorties du réseau ne seraient pas alignées.
void checkLabels(const NetworkFile &net, chess::LabelMode mode)
{
    const std::vector<std::string> &expected = chess::getClassNames(mode);
    if (net.labels.size() != expected.size())
        throw FormatError("my_torch_analyzer: le réseau annonce " + std::to_string(net.labels.size()) +
                          " libellés, " + std::to_string(expected.size()) + " sont attendus");
    for (std::size_t i = 0; i < expected.size(); i++) {
        if (net.labels[i] != expected[i])
            throw FormatError("my_torch_analyzer: libellé " + net.labels[i] + " à la place de " +
                              expected[i]);
    }
}

// Le dataset produit toujours l'encodage 773 (cf. chess/Fen.hpp). Un réseau de
// taille d'entrée différente ne peut pas être entraîné avec, et l'augmentation
// écrirait hors de la ligne : on refuse tôt, avec un message clair.
void checkInputSize(const NetworkFile &net)
{
    if (net.inputSize != chess::kFenEncodedSize)
        throw FormatError("my_torch_analyzer: le réseau attend " + std::to_string(net.inputSize) +
                          " entrées, l'encodage du dataset en produit " +
                          std::to_string(chess::kFenEncodedSize));
}

// Mélange la portion [start, end) du dataset par échanges d'échantillons.
void shuffleRange(chess::Dataset &dataset, std::size_t start, std::size_t end, std::mt19937 &gen)
{
    for (std::size_t i = end; i > start + 1; i--) {
        std::uniform_int_distribution<std::size_t> pick(0, i - start - 1);
        std::size_t j = start + pick(gen);
        std::swap(dataset.at(i - 1), dataset.at(j));
    }
}

// L'augmentation est active par défaut. MYTORCH_AUGMENT=0 la désactive : c'est
// uniquement un commutateur de mesure, pour comparer deux entraînements à
// protocole identique. Il ne change rien à la prédiction.
bool augmentationEnabled()
{
    const char *value = std::getenv("MYTORCH_AUGMENT");
    return value == nullptr || std::string(value) != "0";
}

// Applique à chaque position du lot une symétrie tirée au hasard (identité,
// miroir gauche-droite, inversion des couleurs, ou les deux). Ces symétries sont
// exactes : la classe de la position ne change pas, donc le réseau voit des
// positions inédites sans étiquette fausse. C'est une source d'information
// nouvelle, contrairement à un simple réglage de régularisation.
//
// Seules les entrées sont transformées ; la validation reste intacte, sinon la
// précision mesurée ne serait plus comparable d'un epoch à l'autre.
void augmentBatch(Matrix &inputs, Matrix &targets, chess::LabelMode mode, std::mt19937 &gen)
{
    for (std::size_t row = 0; row < inputs.rows(); row++) {
        chess::Symmetry symmetry = chess::randomSymmetry(gen);
        chess::applySymmetry(inputs.data() + row * inputs.cols(), symmetry);
        if (chess::flipsColors(symmetry))
            chess::swapTargetColors(targets.data(), row, targets.cols(), mode);
    }
}

// Entraîne les mini-batchs de la portion [start, end) et renvoie la perte moyenne.
double runBatches(chess::Dataset &dataset, Trainer &trainer, Network &net,
                  std::size_t start, std::size_t end, std::mt19937 &gen)
{
    chess::LabelMode mode = net.file().numClasses == chess::kNumClassesFull ? chess::LabelMode::Full
                                                                           : chess::LabelMode::Basic;
    bool augment = augmentationEnabled();
    shuffleRange(dataset, start, end, gen);
    double total = 0.0;
    std::size_t batches = 0;
    for (std::size_t offset = start; offset < end; offset += net.settings().batchSize) {
        std::size_t count = std::min(net.settings().batchSize, end - offset);
        Matrix inputs = dataset.batchInputs(offset, count);
        Matrix targets = dataset.batchTargets(offset, count);
        if (augment)
            augmentBatch(inputs, targets, mode, gen);
        total += trainer.trainBatch(inputs, targets);
        batches++;
    }
    return batches == 0 ? 0.0 : total / static_cast<double>(batches);
}

// Précision sur un échantillon de la portion d'entraînement.
double sampleAccuracy(chess::Dataset &dataset, Network &net, std::size_t start)
{
    if (start >= dataset.size())
        return 0.0;
    std::size_t count = std::min(kAccuracySample, dataset.size() - start);
    Matrix inputs = dataset.batchInputs(start, count);
    Matrix targets = dataset.batchTargets(start, count);
    Matrix scores = net.predict(inputs);
    return classify(scores, targets, net.file().labels).accuracy;
}

// Entraîne une epoch et renvoie ses mesures.
EpochReport trainOneEpoch(chess::Dataset &dataset, Trainer &trainer, Network &net,
                           std::size_t validationSize, std::size_t epoch, std::mt19937 &gen,
                           const Matrix &validationInputs, const Matrix &validationTargets)
{
    double loss = runBatches(dataset, trainer, net, validationSize, dataset.size(), gen);
    Matrix scores = net.predict(validationInputs);
    ClassificationReport report = classify(scores, validationTargets, net.file().labels);
    EpochReport result;
    result.epoch = epoch;
    result.loss = loss;
    result.trainAccuracy = sampleAccuracy(dataset, net, validationSize);
    result.validationAccuracy = report.accuracy;
    result.validationF1 = report.macroF1;
    return result;
}

// Entraîne le réseau et enregistre le meilleur epoch vu sur la validation.
//
// Le réseau écrit sur le disque n'est donc pas forcément le dernier epoch : c'est
// celui qui maximise la précision de validation. Sans cela, un réseau qui
// sur-apprend finirait par livrer un modèle moins bon que le meilleur.
void trainNetwork(chess::Dataset &dataset, Network &net, Trainer &trainer,
                  std::size_t validationSize, std::mt19937 &gen, const std::string &output,
                  const Matrix &validationInputs, const Matrix &validationTargets,
                  std::vector<EpochReport> &epochs)
{
    double bestAccuracy = -1.0;
    for (std::size_t epoch = 1; epoch <= net.settings().epochs; epoch++) {
        EpochReport report = trainOneEpoch(dataset, trainer, net, validationSize, epoch, gen,
                                            validationInputs, validationTargets);
        epochs.push_back(report);
        std::cout << "epoch " << report.epoch << '/' << net.settings().epochs
                  << " loss=" << report.loss << " train_acc=" << report.trainAccuracy
                  << " val_acc=" << report.validationAccuracy << " val_f1=" << report.validationF1
                  << std::endl;
        if (report.validationAccuracy > bestAccuracy) {
            bestAccuracy = report.validationAccuracy;
            net.save(output);
        }
    }
}

// Écrit les rapports CSV du réseau enregistré (le meilleur epoch).
void writeReports(const std::string &output, const Matrix &validationInputs,
                  const Matrix &validationTargets)
{
    Network best = Network::load(output);
    Matrix scores = best.predict(validationInputs);
    ClassificationReport report = classify(scores, validationTargets, best.file().labels);
    writeConfusionMatrix(output + ".confusion.csv", report);
    writeClassMetrics(output + ".metrics.csv", report);
}

} // namespace

void runTrain(const Options &opt)
{
    Network net = Network::load(opt.loadFile);
    chess::LabelMode mode = labelModeFor(net.file().numClasses);
    checkLabels(net.file(), mode);
    checkInputSize(net.file());
    chess::Dataset dataset = chess::Dataset::loadFromFile(opt.chessFile, mode, true);
    std::mt19937 gen(net.settings().seed);
    dataset.shuffle(gen);
    std::size_t validationSize = dataset.size() / kValidationRatio;
    Optimizer optimizer(net, net.settings());
    Trainer trainer(net, optimizer, net.settings());
    Matrix validationInputs = dataset.batchInputs(0, validationSize);
    Matrix validationTargets = dataset.batchTargets(0, validationSize);
    std::vector<EpochReport> epochs;
    std::string output = opt.hasSave ? opt.saveFile : opt.loadFile;
    trainNetwork(dataset, net, trainer, validationSize, gen, output, validationInputs,
                 validationTargets, epochs);
    writeLearningCurves(output + ".curves.csv", epochs);
    writeReports(output, validationInputs, validationTargets);
    std::cout << "reseau entrainement sauvegarde dans " << output << '\n';
}

} // namespace analyzer
} // namespace mytorch
