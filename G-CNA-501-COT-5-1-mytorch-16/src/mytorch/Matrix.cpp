/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Matrix.hpp
** Dépend de : include/mytorch/Matrix.hpp
*/

#include "mytorch/Matrix.hpp"

#include <cstdint>
#include <istream>
#include <ostream>
#include <string>

namespace mytorch {

namespace {

std::string shape(const Matrix &m)
{
    return std::to_string(m.rows()) + "x" + std::to_string(m.cols());
}

void requireSameShape(const Matrix &a, const Matrix &b, const char *op)
{
    if (a.rows() != b.rows() || a.cols() != b.cols())
        throw DimensionError(std::string("Matrix: dimensions incompatibles pour ") + op + " (" +
                             shape(a) + " et " + shape(b) + ")");
}

} // namespace

Matrix::Matrix(std::size_t rows, std::size_t cols, float value)
    : rows_(rows), cols_(cols), data_(rows * cols, value)
{
}

Matrix::Matrix(std::initializer_list<std::initializer_list<float>> values)
    : rows_(values.size()), cols_(values.size() == 0 ? 0 : values.begin()->size())
{
    data_.reserve(rows_ * cols_);
    for (const auto &row : values) {
        if (row.size() != cols_)
            throw DimensionError("Matrix: les lignes n'ont pas toutes la même taille");
        data_.insert(data_.end(), row.begin(), row.end());
    }
}

float &Matrix::at(std::size_t row, std::size_t col)
{
    if (row >= rows_ || col >= cols_)
        throw DimensionError("Matrix: indice (" + std::to_string(row) + "," + std::to_string(col) +
                             ") hors de la matrice " + shape(*this));
    return data_[row * cols_ + col];
}

const float &Matrix::at(std::size_t row, std::size_t col) const
{
    if (row >= rows_ || col >= cols_)
        throw DimensionError("Matrix: indice (" + std::to_string(row) + "," + std::to_string(col) +
                             ") hors de la matrice " + shape(*this));
    return data_[row * cols_ + col];
}

void Matrix::fill(float value)
{
    for (float &v : data_)
        v = value;
}

Matrix Matrix::sumRows() const
{
    Matrix result(1, cols_);
    for (std::size_t i = 0; i < rows_; i++)
        for (std::size_t j = 0; j < cols_; j++)
            result.data_[j] += data_[i * cols_ + j];
    return result;
}

Matrix Matrix::addRowVector(const Matrix &row) const
{
    if (row.rows() != 1 || row.cols() != cols_)
        throw DimensionError("Matrix: le vecteur ligne " + shape(row) + " ne s'ajoute pas à une matrice " +
                             shape(*this));
    Matrix result(rows_, cols_);
    for (std::size_t i = 0; i < rows_; i++)
        for (std::size_t j = 0; j < cols_; j++)
            result.data_[i * cols_ + j] = data_[i * cols_ + j] + row.data_[j];
    return result;
}

Matrix Matrix::selectRows(const std::vector<std::size_t> &indices) const
{
    Matrix result(indices.size(), cols_);
    for (std::size_t i = 0; i < indices.size(); i++) {
        if (indices[i] >= rows_)
            throw DimensionError("Matrix: la ligne " + std::to_string(indices[i]) + " n'existe pas dans une matrice " +
                                 shape(*this));
        for (std::size_t j = 0; j < cols_; j++)
            result.data_[i * cols_ + j] = data_[indices[i] * cols_ + j];
    }
    return result;
}

std::vector<std::size_t> Matrix::argmaxRows() const
{
    if (cols_ == 0 && rows_ > 0)
        throw DimensionError("Matrix: argmax impossible sur une matrice sans colonne");
    std::vector<std::size_t> best(rows_, 0);
    for (std::size_t i = 0; i < rows_; i++)
        for (std::size_t j = 1; j < cols_; j++)
            if (data_[i * cols_ + j] > data_[i * cols_ + best[i]])
                best[i] = j;
    return best;
}

void Matrix::write(std::ostream &out) const
{
    const std::uint32_t rows = static_cast<std::uint32_t>(rows_);
    const std::uint32_t cols = static_cast<std::uint32_t>(cols_);
    out.write(reinterpret_cast<const char *>(&rows), sizeof(rows));
    out.write(reinterpret_cast<const char *>(&cols), sizeof(cols));
    out.write(reinterpret_cast<const char *>(data_.data()), static_cast<std::streamsize>(data_.size() * sizeof(float)));
    if (!out)
        throw FileError("Matrix: écriture impossible");
}

Matrix Matrix::read(std::istream &in)
{
    // Au-delà, le fichier est considéré corrompu (évite d'allouer une mémoire énorme).
    constexpr std::uint64_t kMaxElements = 1ull << 26;

    std::uint32_t rows = 0;
    std::uint32_t cols = 0;
    in.read(reinterpret_cast<char *>(&rows), sizeof(rows));
    in.read(reinterpret_cast<char *>(&cols), sizeof(cols));
    if (!in)
        throw FileError("Matrix: lecture impossible (fichier tronqué)");
    if (static_cast<std::uint64_t>(rows) * cols > kMaxElements)
        throw FormatError("Matrix: dimensions lues absurdes (" + std::to_string(rows) + "x" +
                          std::to_string(cols) + "), fichier corrompu ?");

    Matrix result(rows, cols);
    in.read(reinterpret_cast<char *>(result.data_.data()),
            static_cast<std::streamsize>(result.data_.size() * sizeof(float)));
    if (!in)
        throw FileError("Matrix: lecture impossible (fichier tronqué)");
    return result;
}

Matrix Matrix::transpose() const
{
    Matrix result(cols_, rows_);
    for (std::size_t i = 0; i < rows_; i++)
        for (std::size_t j = 0; j < cols_; j++)
            result(j, i) = (*this)(i, j);
    return result;
}

Matrix Matrix::operator+(const Matrix &other) const
{
    requireSameShape(*this, other, "l'addition");
    Matrix result(rows_, cols_);
    for (std::size_t i = 0; i < data_.size(); i++)
        result.data_[i] = data_[i] + other.data_[i];
    return result;
}

Matrix Matrix::operator-(const Matrix &other) const
{
    requireSameShape(*this, other, "la soustraction");
    Matrix result(rows_, cols_);
    for (std::size_t i = 0; i < data_.size(); i++)
        result.data_[i] = data_[i] - other.data_[i];
    return result;
}

Matrix Matrix::hadamard(const Matrix &other) const
{
    requireSameShape(*this, other, "le produit terme à terme");
    Matrix result(rows_, cols_);
    for (std::size_t i = 0; i < data_.size(); i++)
        result.data_[i] = data_[i] * other.data_[i];
    return result;
}

Matrix Matrix::operator*(const Matrix &other) const
{
    if (cols_ != other.rows_)
        throw DimensionError("Matrix: dimensions incompatibles pour le produit matriciel (" +
                             shape(*this) + " et " + shape(other) + ")");
    Matrix result(rows_, other.cols_);
    // Résultat vide : on sort avant de toucher data(), qui est alors vide (accès interdit).
    if (rows_ == 0 || other.cols_ == 0)
        return result;
    // Ordre i-k-j : les lignes de other et de result sont parcourues de façon contiguë (cache).
    // Chaque ligne de sortie est indépendante : on parallélise sur i sans réduction, donc
    // l'ordre des additions ne change pas et le résultat reste identique au bit près.
    // Le seuil évite de payer le coût d'une région parallèle sur les petites matrices.
#ifdef _OPENMP
#pragma omp parallel for schedule(static) if (rows_ * cols_ * other.cols_ > 200000)
#endif
    for (std::size_t i = 0; i < rows_; i++) {
        float *out = &result.data_[i * other.cols_];
        for (std::size_t k = 0; k < cols_; k++) {
            const float a = data_[i * cols_ + k];
            const float *in = &other.data_[k * other.cols_];
            for (std::size_t j = 0; j < other.cols_; j++)
                out[j] += a * in[j];
        }
    }
    return result;
}

Matrix Matrix::operator*(float scalar) const
{
    Matrix result(rows_, cols_);
    for (std::size_t i = 0; i < data_.size(); i++)
        result.data_[i] = data_[i] * scalar;
    return result;
}

} // namespace mytorch
