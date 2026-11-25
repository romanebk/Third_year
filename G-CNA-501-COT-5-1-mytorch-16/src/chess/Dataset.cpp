/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Dataset.hpp
** Dépend de : include/chess/Dataset.hpp
*/

#include "chess/Dataset.hpp"

#include <algorithm>
#include <fstream>

namespace mytorch {
namespace chess {

namespace {

std::vector<std::size_t> shuffledIndices(std::size_t count, std::mt19937 &gen)
{
    std::vector<std::size_t> indices(count);
    for (std::size_t i = 0; i < count; i++)
        indices[i] = i;
    std::shuffle(indices.begin(), indices.end(), gen);
    return indices;
}

} // namespace

Dataset Dataset::loadFromFile(const std::string &path, LabelMode mode, bool strict)
{
    Dataset dataset;
    dataset.mode_ = mode;
    std::ifstream file(path);
    if (!file.is_open())
        throw FileError("Dataset: impossible d'ouvrir le fichier '" + path + "'");
    std::string line;
    std::size_t lineNum = 0;
    while (std::getline(file, line)) {
        lineNum++;
        while (!line.empty() && line.back() == '\r')
            line.pop_back();
        if (line.empty())
            continue;
        FenParts parts = parseLine(line);
        if (parts.label.empty()) {
            if (strict)
                throw FormatError("Dataset: ligne sans étiquette à la ligne " + std::to_string(lineNum));
            continue;
        }
        Sample sample;
        sample.input = encode(parts);
        sample.label = labelToIndex(parts.label, mode);
        dataset.addSample(sample);
    }
    if (strict && dataset.size() == 0)
        throw FormatError("Dataset: aucun échantillon dans le fichier '" + path + "'");
    return dataset;
}

std::size_t Dataset::size() const
{
    return samples_.size();
}

LabelMode Dataset::mode() const
{
    return mode_;
}

const Sample &Dataset::at(std::size_t index) const
{
    if (index >= samples_.size())
        throw DimensionError("Dataset: index hors limites");
    return samples_[index];
}

Sample &Dataset::at(std::size_t index)
{
    if (index >= samples_.size())
        throw DimensionError("Dataset: index hors limites");
    return samples_[index];
}

void Dataset::addSample(const Sample &sample)
{
    if (sample.input.size() != kFenEncodedSize)
        throw DimensionError("Dataset: taille d'entrée invalide");
    samples_.push_back(sample);
}

void Dataset::shuffle(std::mt19937 &gen)
{
    std::shuffle(samples_.begin(), samples_.end(), gen);
}

void Dataset::trainTestSplit(float trainRatio, Dataset &train, Dataset &test, std::mt19937 &gen) const
{
    if (trainRatio <= 0.0f || trainRatio >= 1.0f)
        throw ArgumentError("Dataset: trainRatio doit être entre 0 et 1");
    std::vector<std::size_t> indices = shuffledIndices(samples_.size(), gen);
    std::size_t trainCount = static_cast<std::size_t>(samples_.size() * trainRatio);
    train.mode_ = mode_;
    test.mode_ = mode_;
    train.samples_.clear();
    test.samples_.clear();
    for (std::size_t i = 0; i < trainCount; i++)
        train.samples_.push_back(samples_[indices[i]]);
    for (std::size_t i = trainCount; i < indices.size(); i++)
        test.samples_.push_back(samples_[indices[i]]);
}

void Dataset::splitTrainValTest(float trainRatio, float valRatio, Dataset &train, Dataset &val, Dataset &test, std::mt19937 &gen) const
{
    if (trainRatio <= 0.0f || valRatio <= 0.0f || trainRatio + valRatio >= 1.0f)
        throw ArgumentError("Dataset: ratios invalides pour un split 80/10/10");
    std::vector<std::size_t> indices = shuffledIndices(samples_.size(), gen);
    std::size_t trainCount = static_cast<std::size_t>(samples_.size() * trainRatio);
    std::size_t valCount = static_cast<std::size_t>(samples_.size() * valRatio);
    train.mode_ = mode_;
    val.mode_ = mode_;
    test.mode_ = mode_;
    train.samples_.clear();
    val.samples_.clear();
    test.samples_.clear();
    for (std::size_t i = 0; i < trainCount; i++)
        train.samples_.push_back(samples_[indices[i]]);
    for (std::size_t i = trainCount; i < trainCount + valCount && i < indices.size(); i++)
        val.samples_.push_back(samples_[indices[i]]);
    for (std::size_t i = trainCount + valCount; i < indices.size(); i++)
        test.samples_.push_back(samples_[indices[i]]);
}

Matrix Dataset::inputs() const
{
    if (samples_.empty())
        return Matrix(0, kFenEncodedSize);
    Matrix mat(samples_.size(), kFenEncodedSize);
    for (std::size_t i = 0; i < samples_.size(); i++) {
        for (std::size_t j = 0; j < kFenEncodedSize; j++)
            mat(i, j) = samples_[i].input[j];
    }
    return mat;
}

Matrix Dataset::targets() const
{
    std::size_t classes = numClasses(mode_);
    if (samples_.empty())
        return Matrix(0, classes);
    Matrix mat(samples_.size(), classes, 0.0f);
    for (std::size_t i = 0; i < samples_.size(); i++) {
        if (samples_[i].label < classes)
            mat(i, samples_[i].label) = 1.0f;
    }
    return mat;
}

Matrix Dataset::batchInputs(std::size_t start, std::size_t batchSize) const
{
    if (samples_.empty() || start >= samples_.size())
        return Matrix(0, kFenEncodedSize);
    std::size_t size = batchSize;
    if (start + size > samples_.size())
        size = samples_.size() - start;
    Matrix mat(size, kFenEncodedSize);
    for (std::size_t i = 0; i < size; i++) {
        for (std::size_t j = 0; j < kFenEncodedSize; j++)
            mat(i, j) = samples_[start + i].input[j];
    }
    return mat;
}

Matrix Dataset::batchTargets(std::size_t start, std::size_t batchSize) const
{
    std::size_t classes = numClasses(mode_);
    if (samples_.empty() || start >= samples_.size())
        return Matrix(0, classes);
    std::size_t size = batchSize;
    if (start + size > samples_.size())
        size = samples_.size() - start;
    Matrix mat(size, classes, 0.0f);
    for (std::size_t i = 0; i < size; i++) {
        std::size_t label = samples_[start + i].label;
        if (label < classes)
            mat(i, label) = 1.0f;
    }
    return mat;
}

std::pair<Matrix, Matrix> Dataset::getBatch(std::size_t start, std::size_t batchSize) const
{
    return {batchInputs(start, batchSize), batchTargets(start, batchSize)};
}

std::vector<float> Dataset::getClassWeights() const
{
    std::size_t classes = numClasses(mode_);
    std::vector<float> counts(classes, 0.0f);
    for (const auto &sample : samples_)
        if (sample.label < classes)
            counts[sample.label] += 1.0f;
    std::vector<float> weights(classes, 1.0f);
    float total = static_cast<float>(samples_.size());
    for (std::size_t i = 0; i < classes; i++) {
        if (counts[i] > 0.0f)
            weights[i] = total / (static_cast<float>(classes) * counts[i]);
    }
    return weights;
}

void Dataset::balanceClasses(std::mt19937 &gen)
{
    std::size_t classes = numClasses(mode_);
    std::vector<std::vector<std::size_t>> perClass(classes);
    for (std::size_t i = 0; i < samples_.size(); i++)
        if (samples_[i].label < classes)
            perClass[samples_[i].label].push_back(i);
    std::size_t minCount = samples_.size();
    for (const auto &cls : perClass) {
        if (!cls.empty() && cls.size() < minCount)
            minCount = cls.size();
    }
    std::vector<std::size_t> keep;
    keep.reserve(classes * minCount);
    for (auto &cls : perClass) {
        std::shuffle(cls.begin(), cls.end(), gen);
        for (std::size_t i = 0; i < minCount && i < cls.size(); i++)
            keep.push_back(cls[i]);
    }
    std::sort(keep.begin(), keep.end());
    // Compactage en place : les indices conserves sont tries, donc la destination
    // (rang k) reste inferieure a la source (keep[k]) et rien de lu n'est ecrase.
    std::size_t written = 0;
    for (std::size_t index : keep) {
        if (written != index)
            samples_[written] = std::move(samples_[index]);
        written++;
    }
    samples_.resize(written);
    std::shuffle(samples_.begin(), samples_.end(), gen);
}

} // namespace chess
} // namespace mytorch
