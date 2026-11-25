/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Metrics.hpp
** Dépend de : include/mytorch/Metrics.hpp
*/

#include "mytorch/Metrics.hpp"

#include <numeric>

#include "mytorch/Errors.hpp"

namespace mytorch {

namespace {

void checkSizes(const Matrix &scores, const Matrix &expected, const std::vector<std::string> &labels)
{
    if (scores.rows() != expected.rows() || scores.cols() != expected.cols())
        throw DimensionError("Metrics: scores et cibles doivent avoir la même taille");
    if (scores.cols() != labels.size())
        throw DimensionError("Metrics: le nombre de libellés ne correspond pas aux classes");
}

double safeRatio(std::size_t numerator, std::size_t denominator)
{
    if (denominator == 0)
        return 0.0;
    return static_cast<double>(numerator) / static_cast<double>(denominator);
}

ClassMetrics computeClass(std::size_t index, const std::string &label,
                          const std::vector<std::size_t> &predicted,
                          const std::vector<std::size_t> &actual)
{
    ClassMetrics metrics;
    metrics.label = label;
    for (std::size_t i = 0; i < actual.size(); i++) {
        bool isActual = actual[i] == index;
        bool isPredicted = predicted[i] == index;
        if (isActual && isPredicted)
            metrics.truePositives++;
        else if (isActual)
            metrics.falseNegatives++;
        else if (isPredicted)
            metrics.falsePositives++;
    }
    metrics.precision = safeRatio(metrics.truePositives, metrics.truePositives + metrics.falsePositives);
    metrics.recall = safeRatio(metrics.truePositives, metrics.truePositives + metrics.falseNegatives);
    double sum = metrics.precision + metrics.recall;
    metrics.f1 = sum > 0.0 ? 2.0 * metrics.precision * metrics.recall / sum : 0.0;
    metrics.support = static_cast<double>(metrics.truePositives + metrics.falseNegatives);
    return metrics;
}

std::vector<std::size_t> argmaxColumns(const Matrix &matrix)
{
    std::vector<std::size_t> result(matrix.rows(), 0);
    for (std::size_t i = 0; i < matrix.rows(); i++) {
        std::size_t best = 0;
        for (std::size_t j = 1; j < matrix.cols(); j++)
            if (matrix(i, j) > matrix(i, best))
                best = j;
        result[i] = best;
    }
    return result;
}

} // namespace

std::size_t ConfusionMatrix::at(std::size_t trueIndex, std::size_t predictedIndex) const
{
    if (trueIndex >= numClasses || predictedIndex >= numClasses)
        throw DimensionError("Metrics: indice de classe hors limites");
    return counts[trueIndex * numClasses + predictedIndex];
}

std::size_t ConfusionMatrix::total() const
{
    return std::accumulate(counts.begin(), counts.end(), std::size_t(0));
}

ClassificationReport classify(const Matrix &scores, const Matrix &expected,
                               const std::vector<std::string> &labels)
{
    checkSizes(scores, expected, labels);
    ClassificationReport report;
    report.numSamples = scores.rows();
    report.confusion.numClasses = labels.size();
    report.confusion.counts.assign(labels.size() * labels.size(), 0);
    std::vector<std::size_t> predicted = argmaxColumns(scores);
    std::vector<std::size_t> actual = argmaxColumns(expected);
    for (std::size_t i = 0; i < report.numSamples; i++) {
        report.confusion.counts[actual[i] * report.confusion.numClasses + predicted[i]]++;
        if (actual[i] == predicted[i])
            report.accuracy += 1.0;
    }
    if (report.numSamples > 0)
        report.accuracy /= static_cast<double>(report.numSamples);
    double f1Sum = 0.0;
    for (std::size_t i = 0; i < labels.size(); i++) {
        ClassMetrics metrics = computeClass(i, labels[i], predicted, actual);
        f1Sum += metrics.f1;
        report.perClass.push_back(metrics);
    }
    report.macroF1 = labels.empty() ? 0.0 : f1Sum / static_cast<double>(labels.size());
    return report;
}

} // namespace mytorch
