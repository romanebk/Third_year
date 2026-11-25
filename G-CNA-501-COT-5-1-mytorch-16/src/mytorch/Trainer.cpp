/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Trainer.hpp
** Dépend de : include/mytorch/Trainer.hpp
*/

#include "mytorch/Trainer.hpp"

namespace mytorch {

Trainer::Trainer(Network &network, Optimizer &optimizer, const TrainSettings &settings)
    : network_(network),
      optimizer_(optimizer),
      settings_(settings)
{
}

double Trainer::trainBatch(const Matrix &inputs, const Matrix &targets)
{
    Matrix probabilities = network_.forward(inputs);
    LossResult loss = crossEntropy(probabilities, targets);
    optimizer_.zeroGradients();
    network_.backward(loss.gradient);
    optimizer_.step();
    return loss.value;
}

} // namespace mytorch
