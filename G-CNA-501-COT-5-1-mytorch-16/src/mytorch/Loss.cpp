/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Loss.hpp
** Dépend de : include/mytorch/Loss.hpp
*/

#include "mytorch/Loss.hpp"

#include <algorithm>
#include <cmath>

namespace mytorch {

namespace {

// Sous cette barre, log(p) et 1/p deviennent infinis.
constexpr float kProbabilityFloor = 1e-12f;

} // namespace

LossResult crossEntropy(const Matrix &probabilities, const Matrix &targets)
{
    if (probabilities.rows() != targets.rows() || probabilities.cols() != targets.cols())
        throw DimensionError("crossEntropy: probabilités et cibles de tailles différentes");

    LossResult result;
    result.gradient = Matrix(probabilities.rows(), probabilities.cols());
    if (probabilities.rows() == 0)
        return result;

    const float inverseBatch = 1.0f / static_cast<float>(probabilities.rows());
    double sum = 0.0;
    for (std::size_t i = 0; i < probabilities.rows(); i++) {
        for (std::size_t j = 0; j < probabilities.cols(); j++) {
            const float p = std::max(probabilities(i, j), kProbabilityFloor);
            const float y = targets(i, j);
            if (y != 0.0f) {
                sum -= static_cast<double>(y) * std::log(static_cast<double>(p));
                result.gradient(i, j) = -y / p * inverseBatch;
            }
        }
    }
    result.value = sum / static_cast<double>(probabilities.rows());
    return result;
}

} // namespace mytorch
