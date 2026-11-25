/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de StackTrainer.hpp
** Dépend de : include/mytorch/StackTrainer.hpp
*/

#include "mytorch/StackTrainer.hpp"

#include <algorithm>
#include <cmath>

#include "mytorch/Errors.hpp"

namespace mytorch {

namespace {

// Sous la barre de probabilité, le logarithme et la division deviennent infinis.
// La valeur est écrêtée : le gradient reste exact car il est multiplié par la
// probabilité elle-même.
constexpr float kProbabilityFloor = 1e-12f;

// Multiplie tous les coefficients d'une matrice par un facteur.
void scaleMatrix(Matrix &matrix, float factor)
{
    for (std::size_t i = 0; i < matrix.rows(); i++)
        for (std::size_t j = 0; j < matrix.cols(); j++)
            matrix(i, j) *= factor;
}

} // namespace

StackTrainer::StackTrainer(const TrainSettings &settings)
    : settings_(settings)
{
}

Matrix StackTrainer::forward(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &input) const
{
    Matrix output = input;
    for (auto &layer : layers) {
        layer->setTraining(true);
        output = layer->forward(output);
    }
    return output;
}

Matrix StackTrainer::predict(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &input) const
{
    Matrix output = input;
    for (auto &layer : layers) {
        layer->setTraining(false);
        output = layer->forward(output);
    }
    return output;
}

Matrix StackTrainer::backward(std::vector<std::unique_ptr<Layer>> &layers,
                              const Matrix &gradOutput) const
{
    Matrix gradient = gradOutput;
    for (std::size_t i = layers.size(); i > 0; i--)
        gradient = layers[i - 1]->backward(gradient);
    return gradient;
}

double StackTrainer::crossEntropy(const Matrix &probabilities, const Matrix &targets,
                                  Matrix &gradient) const
{
    if (probabilities.rows() != targets.rows() || probabilities.cols() != targets.cols())
        throw DimensionError("StackTrainer: probabilités et cibles de tailles différentes");
    gradient = Matrix(probabilities.rows(), probabilities.cols(), 0.0f);
    double loss = 0.0;
    for (std::size_t i = 0; i < probabilities.rows(); i++) {
        for (std::size_t j = 0; j < probabilities.cols(); j++) {
            float probability = std::max(probabilities(i, j), kProbabilityFloor);
            float target = targets(i, j);
            if (target > 0.5f)
                loss -= std::log(probability);
            gradient(i, j) = (probability - target) / probability;
        }
    }
    if (probabilities.rows() == 0)
        return 0.0;
    // La perte renvoyée est la moyenne sur le lot : le gradient doit l'être aussi,
    // sinon le pas de mise à jour dépendrait de la taille du mini-batch.
    loss /= static_cast<double>(probabilities.rows());
    scaleMatrix(gradient, 1.0f / static_cast<float>(probabilities.rows()));
    return loss;
}

void StackTrainer::update(std::vector<std::unique_ptr<Layer>> &layers) const
{
    for (auto &layer : layers) {
        for (Parameter &parameter : layer->parameters()) {
            if (parameter.value == nullptr || parameter.gradient == nullptr)
                continue;
            float *value = parameter.value->data();
            const float *gradient = parameter.gradient->data();
            std::vector<float> &velocity = velocityFor(parameter.value);
            for (std::size_t i = 0; i < parameter.value->size(); i++) {
                velocity[i] = settings_.momentum * velocity[i] + gradient[i];
                value[i] -= settings_.learningRate * (velocity[i] + settings_.l2 * value[i]);
            }
        }
    }
}

void StackTrainer::resetOptimizerState()
{
    velocities_.clear();
}

std::vector<float> &StackTrainer::velocityFor(const Matrix *parameter) const
{
    auto found = velocities_.find(parameter);
    if (found == velocities_.end())
        found = velocities_.emplace(parameter, std::vector<float>(parameter->size(), 0.0f)).first;
    return found->second;
}

double StackTrainer::trainEpoch(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &inputs,
                                 const Matrix &targets) const
{
    Matrix probabilities = forward(layers, inputs);
    Matrix gradient;
    double loss = crossEntropy(probabilities, targets, gradient);
    backward(layers, gradient);
    update(layers);
    return loss;
}

} // namespace mytorch
