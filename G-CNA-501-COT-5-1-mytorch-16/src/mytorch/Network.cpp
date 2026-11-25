/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Network.hpp
** Dépend de : include/mytorch/Network.hpp
*/

#include "mytorch/Network.hpp"

#include <utility>

namespace mytorch {

Network::Network(NetworkFile file)
    : file_(std::move(file))
{
    if (file_.layers.empty())
        throw FormatError("Network: un réseau doit contenir au moins une couche");
}

void Network::save(const std::string &path) const
{
    saveNetwork(path, file_);
}

Network Network::load(const std::string &path)
{
    return Network(loadNetwork(path));
}

Matrix Network::forward(const Matrix &input)
{
    Matrix output = input;
    for (auto &layer : file_.layers) {
        layer->setTraining(true);
        output = layer->forward(output);
    }
    return output;
}

Matrix Network::predict(const Matrix &input)
{
    Matrix output = input;
    for (auto &layer : file_.layers) {
        layer->setTraining(false);
        output = layer->forward(output);
    }
    return output;
}

Matrix Network::backward(const Matrix &gradOutput)
{
    Matrix gradient = gradOutput;
    for (std::size_t i = file_.layers.size(); i > 0; i--)
        gradient = file_.layers[i - 1]->backward(gradient);
    return gradient;
}

std::vector<Parameter> Network::parameters()
{
    std::vector<Parameter> all;
    for (auto &layer : file_.layers)
        for (const Parameter &parameter : layer->parameters())
            all.push_back(parameter);
    return all;
}

} // namespace mytorch
