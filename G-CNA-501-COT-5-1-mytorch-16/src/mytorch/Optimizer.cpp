/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Optimizer.hpp
** Dépend de : include/mytorch/Optimizer.hpp
*/

#include "mytorch/Optimizer.hpp"

namespace mytorch {

Optimizer::Optimizer(Network &network, const TrainSettings &settings)
    : parameters_(network.parameters()),
      learningRate_(settings.learningRate),
      momentum_(settings.momentum),
      l2_(settings.l2)
{
    for (const Parameter &parameter : parameters_)
        velocities_.emplace_back(parameter.value->size(), 0.0f);
}

void Optimizer::step()
{
    for (std::size_t k = 0; k < parameters_.size(); k++) {
        float *value = parameters_[k].value->data();
        const float *gradient = parameters_[k].gradient->data();
        std::vector<float> &velocity = velocities_[k];
        for (std::size_t i = 0; i < velocity.size(); i++) {
            velocity[i] = momentum_ * velocity[i] + gradient[i];
            value[i] -= learningRate_ * (velocity[i] + l2_ * value[i]);
        }
    }
}

void Optimizer::zeroGradients()
{
    for (Parameter &parameter : parameters_)
        parameter.gradient->zero();
}

} // namespace mytorch
