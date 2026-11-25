/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Activation.hpp
** Dépend de : include/mytorch/Activation.hpp
*/

#include "mytorch/Activation.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>

namespace mytorch {

void Activation::remember(const Matrix &value)
{
    if (training_) {
        cache_ = value;
        hasCache_ = true;
    } else {
        hasCache_ = false;
    }
}

const Matrix &Activation::remembered(const char *who) const
{
    if (!hasCache_)
        throw Error(std::string(who) + ": backward() appelé sans forward() en mode entraînement");
    return cache_;
}

// ReLU

Matrix ReLU::forward(const Matrix &input)
{
    remember(input);
    return input.map([](float v) { return v > 0.0f ? v : 0.0f; });
}

Matrix ReLU::backward(const Matrix &gradOutput)
{
    const Matrix &input = remembered("ReLU");
    return gradOutput.hadamard(input.map([](float v) { return v > 0.0f ? 1.0f : 0.0f; }));
}

// Sigmoid

Matrix Sigmoid::forward(const Matrix &input)
{
    // Deux formes équivalentes pour éviter le dépassement de e^|z|.
    Matrix output = input.map([](float v) {
        if (v >= 0.0f)
            return 1.0f / (1.0f + std::exp(-v));
        const float e = std::exp(v);
        return e / (1.0f + e);
    });
    remember(output);
    return output;
}

Matrix Sigmoid::backward(const Matrix &gradOutput)
{
    const Matrix &output = remembered("Sigmoid");
    return gradOutput.hadamard(output.map([](float s) { return s * (1.0f - s); }));
}

// Tanh

Matrix Tanh::forward(const Matrix &input)
{
    Matrix output = input.map([](float v) { return std::tanh(v); });
    remember(output);
    return output;
}

Matrix Tanh::backward(const Matrix &gradOutput)
{
    const Matrix &output = remembered("Tanh");
    return gradOutput.hadamard(output.map([](float t) { return 1.0f - t * t; }));
}

// Softmax

Matrix Softmax::forward(const Matrix &input)
{
    if (input.cols() == 0)
        throw DimensionError("Softmax: la matrice n'a aucune colonne");
    Matrix output(input.rows(), input.cols());
    for (std::size_t i = 0; i < input.rows(); i++) {
        float maxValue = input(i, 0);
        for (std::size_t j = 1; j < input.cols(); j++)
            maxValue = std::max(maxValue, input(i, j));
        float sum = 0.0f;
        for (std::size_t j = 0; j < input.cols(); j++) {
            output(i, j) = std::exp(input(i, j) - maxValue);
            sum += output(i, j);
        }
        for (std::size_t j = 0; j < input.cols(); j++)
            output(i, j) /= sum;
    }
    remember(output);
    return output;
}

Matrix Softmax::backward(const Matrix &gradOutput)
{
    const Matrix &output = remembered("Softmax");
    if (gradOutput.rows() != output.rows() || gradOutput.cols() != output.cols())
        throw DimensionError("Softmax: le gradient reçu n'a pas la taille de la sortie");
    Matrix gradInput(output.rows(), output.cols());
    for (std::size_t i = 0; i < output.rows(); i++) {
        float dot = 0.0f;
        for (std::size_t j = 0; j < output.cols(); j++)
            dot += gradOutput(i, j) * output(i, j);
        for (std::size_t j = 0; j < output.cols(); j++)
            gradInput(i, j) = output(i, j) * (gradOutput(i, j) - dot);
    }
    return gradInput;
}

// Fabrique

std::unique_ptr<Layer> makeActivation(const std::string &name)
{
    std::string lower = name;
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (lower == "relu")
        return std::make_unique<ReLU>();
    if (lower == "sigmoid")
        return std::make_unique<Sigmoid>();
    if (lower == "tanh")
        return std::make_unique<Tanh>();
    if (lower == "softmax")
        return std::make_unique<Softmax>();
    throw FormatError("Activation: fonction d'activation inconnue '" + name +
                      "' (relu, sigmoid, tanh ou softmax)");
}

} // namespace mytorch
