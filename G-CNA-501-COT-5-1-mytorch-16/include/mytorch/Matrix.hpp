/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Classe de matrices de float, base de tout le calcul.
** Dépend de : Errors.hpp
*/

#pragma once

#include <cstddef>
#include <initializer_list>
#include <iosfwd>
#include <vector>

#include "mytorch/Errors.hpp"

namespace mytorch {

// Matrice de float, stockée ligne par ligne dans une seule zone mémoire.
// Toute opération sur des dimensions incompatibles lève une DimensionError.
class Matrix {
public:
    Matrix() = default;
    Matrix(std::size_t rows, std::size_t cols, float value = 0.0f);
    // Construction depuis des lignes de valeurs, ex. Matrix({{1, 2}, {3, 4}}).
    Matrix(std::initializer_list<std::initializer_list<float>> values);

    std::size_t rows() const { return rows_; }
    std::size_t cols() const { return cols_; }
    std::size_t size() const { return data_.size(); }

    // Accès (ligne, colonne) sans vérification des bornes (chemin rapide).
    float &operator()(std::size_t row, std::size_t col) { return data_[row * cols_ + col]; }
    const float &operator()(std::size_t row, std::size_t col) const { return data_[row * cols_ + col]; }
    // Accès avec vérification des bornes.
    float &at(std::size_t row, std::size_t col);
    const float &at(std::size_t row, std::size_t col) const;

    float *data() { return data_.data(); }
    const float *data() const { return data_.data(); }

    // Remplit toutes les cases avec une valeur / avec zéro.
    void fill(float value);
    void zero() { fill(0.0f); }

    Matrix transpose() const;

    // Somme de chaque colonne sur les lignes : (n x m) -> (1 x m). Sert au gradient du biais.
    Matrix sumRows() const;
    // Ajoute un vecteur (1 x m) à chaque ligne d'une matrice (n x m). Sert à ajouter le biais.
    Matrix addRowVector(const Matrix &row) const;
    // Applique une fonction à chaque élément (ex. une activation).
    template <typename F>
    Matrix map(F fn) const
    {
        Matrix result(rows_, cols_);
        for (std::size_t i = 0; i < data_.size(); i++)
            result.data_[i] = fn(data_[i]);
        return result;
    }
    // Extrait les lignes demandées, dans cet ordre. Sert à fabriquer un mini-batch.
    Matrix selectRows(const std::vector<std::size_t> &indices) const;
    // Indice de la plus grande valeur de chaque ligne (le premier en cas d'égalité).
    std::vector<std::size_t> argmaxRows() const;

    // Écriture / lecture binaire : lignes et colonnes (uint32), puis les valeurs (float).
    // L'ordre des octets est celui de la machine. read() lève une FileError si le flux est
    // tronqué et une FormatError si les dimensions lues sont absurdes (fichier corrompu).
    void write(std::ostream &out) const;
    static Matrix read(std::istream &in);

    Matrix operator+(const Matrix &other) const;
    Matrix operator-(const Matrix &other) const;
    // Produit terme à terme (Hadamard).
    Matrix hadamard(const Matrix &other) const;
    // Produit matriciel : (n x k) * (k x m) -> (n x m).
    Matrix operator*(const Matrix &other) const;
    Matrix operator*(float scalar) const;

private:
    std::size_t rows_ = 0;
    std::size_t cols_ = 0;
    std::vector<float> data_;
};

} // namespace mytorch
