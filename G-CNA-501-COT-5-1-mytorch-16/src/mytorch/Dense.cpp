/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Dense.hpp
** Dépend de : include/mytorch/Dense.hpp
*/

#include "mytorch/Dense.hpp"

#include <istream>
#include <ostream>

namespace mytorch {

Dense::Dense(std::size_t nIn, std::size_t nOut, InitStrategy init, std::mt19937 &gen)
    : weights_(initWeights(nIn, nOut, init, gen)),
      bias_(initBias(nOut)),
      weightsGrad_(nIn, nOut),
      biasGrad_(1, nOut)
{
}

Matrix Dense::forward(const Matrix &input)
{
    Matrix output = (input * weights_).addRowVector(bias_);
    if (training_) {
        input_ = input;
        hasInput_ = true;
    } else {
        hasInput_ = false;
    }
    return output;
}

Matrix Dense::backward(const Matrix &gradOutput)
{
    if (!hasInput_)
        throw Error("Dense: backward() appelé sans forward() en mode entraînement");
    weightsGrad_ = input_.transpose() * gradOutput;
    biasGrad_ = gradOutput.sumRows();
    return gradOutput * weights_.transpose();
}

std::vector<Parameter> Dense::parameters()
{
    return {{&weights_, &weightsGrad_}, {&bias_, &biasGrad_}};
}

void Dense::save(std::ostream &out) const
{
    weights_.write(out);
    bias_.write(out);
}

void Dense::load(std::istream &in)
{
    Matrix weights = Matrix::read(in);
    Matrix bias = Matrix::read(in);
    if (bias.rows() != 1 || bias.cols() != weights.cols())
        throw FormatError("Dense: biais incohérent avec les poids (fichier corrompu ?)");
    weights_ = weights;
    bias_ = bias;
    weightsGrad_ = Matrix(weights_.rows(), weights_.cols());
    biasGrad_ = Matrix(1, weights_.cols());
    hasInput_ = false;
}

} // namespace mytorch
