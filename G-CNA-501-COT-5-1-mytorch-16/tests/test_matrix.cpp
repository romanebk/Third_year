/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests de la classe Matrix.
** Dépend de : le module testé (voir les include)
*/

#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <random>
#include <sstream>
#include <utility>

#include "mytorch/Matrix.hpp"

using mytorch::DimensionError;
using mytorch::Matrix;

static int failures = 0;

#define CHECK(cond)                                                       \
    do {                                                                  \
        if (!(cond)) {                                                    \
            std::cerr << "FAIL ligne " << __LINE__ << " : " #cond "\n";   \
            failures++;                                                   \
        }                                                                 \
    } while (0)

static bool near(float a, float b) { return std::fabs(a - b) < 1e-4f; }

template <typename E, typename F>
static bool throwsType(F fn)
{
    try {
        fn();
    } catch (const E &) {
        return true;
    }
    return false;
}

template <typename F>
static bool throwsDimension(F fn)
{
    return throwsType<DimensionError>(fn);
}

int main()
{
    // Construction
    Matrix empty;
    CHECK(empty.rows() == 0 && empty.cols() == 0 && empty.size() == 0);
    Matrix zeros(2, 3);
    CHECK(zeros.rows() == 2 && zeros.cols() == 3 && zeros.size() == 6);
    CHECK(zeros(1, 2) == 0.0f);
    Matrix sevens(2, 2, 7.0f);
    CHECK(sevens(0, 0) == 7.0f && sevens(1, 1) == 7.0f);
    Matrix a = {{1, 2, 3}, {4, 5, 6}};
    CHECK(a.rows() == 2 && a.cols() == 3);
    CHECK(a(0, 0) == 1 && a(0, 2) == 3 && a(1, 0) == 4 && a(1, 2) == 6);
    CHECK(throwsDimension([] { Matrix bad = {{1, 2}, {3}}; }));

    // Accès
    a(1, 1) = 50.0f;
    CHECK(a(1, 1) == 50.0f);
    CHECK(a.at(0, 1) == 2.0f);
    CHECK(throwsDimension([&] { a.at(2, 0); }));
    CHECK(throwsDimension([&] { a.at(0, 3); }));
    a(1, 1) = 5.0f;

    // Copie et déplacement
    Matrix copy = a;
    copy(0, 0) = 99.0f;
    CHECK(a(0, 0) == 1.0f && copy(0, 0) == 99.0f);
    Matrix moved = std::move(copy);
    CHECK(moved(0, 0) == 99.0f);

    // Transposée
    Matrix t = a.transpose();
    CHECK(t.rows() == 3 && t.cols() == 2);
    CHECK(t(0, 0) == 1 && t(1, 0) == 2 && t(2, 0) == 3 && t(0, 1) == 4 && t(2, 1) == 6);
    Matrix tt = t.transpose();
    CHECK(tt.rows() == 2 && tt.cols() == 3 && tt(1, 2) == 6);

    // Addition, soustraction, terme à terme, scalaire
    Matrix b = {{10, 20, 30}, {40, 50, 60}};
    Matrix sum = a + b;
    CHECK(sum(0, 0) == 11 && sum(1, 2) == 66);
    Matrix diff = b - a;
    CHECK(diff(0, 0) == 9 && diff(1, 2) == 54);
    Matrix had = a.hadamard(b);
    CHECK(had(0, 1) == 40 && had(1, 0) == 160);
    Matrix scaled = a * 2.0f;
    CHECK(scaled(0, 2) == 6 && scaled(1, 1) == 10);
    CHECK(throwsDimension([&] { a + t; }));
    CHECK(throwsDimension([&] { a - t; }));
    CHECK(throwsDimension([&] { a.hadamard(t); }));

    // Produit matriciel : (2x3) * (3x2) = (2x2), vérifié à la main
    Matrix c = {{7, 8}, {9, 10}, {11, 12}};
    Matrix prod = a * c;
    CHECK(prod.rows() == 2 && prod.cols() == 2);
    CHECK(prod(0, 0) == 58 && prod(0, 1) == 64 && prod(1, 0) == 139 && prod(1, 1) == 154);
    CHECK(throwsDimension([&] { a * a; }));

    // Produit par l'identité
    Matrix id = {{1, 0, 0}, {0, 1, 0}, {0, 0, 1}};
    Matrix same = a * id;
    CHECK(same.rows() == 2 && same.cols() == 3);
    for (std::size_t i = 0; i < 2; i++)
        for (std::size_t j = 0; j < 3; j++)
            CHECK(same(i, j) == a(i, j));

    // Produit non carré contre un calcul naïf (i-j-k), sur des valeurs aléatoires
    std::mt19937 gen(42);
    std::uniform_real_distribution<float> dist(-1.0f, 1.0f);
    Matrix x(37, 53), y(53, 29);
    for (std::size_t i = 0; i < x.rows(); i++)
        for (std::size_t j = 0; j < x.cols(); j++)
            x(i, j) = dist(gen);
    for (std::size_t i = 0; i < y.rows(); i++)
        for (std::size_t j = 0; j < y.cols(); j++)
            y(i, j) = dist(gen);
    Matrix xy = x * y;
    CHECK(xy.rows() == 37 && xy.cols() == 29);
    bool allNear = true;
    for (std::size_t i = 0; i < 37; i++)
        for (std::size_t j = 0; j < 29; j++) {
            float ref = 0.0f;
            for (std::size_t k = 0; k < 53; k++)
                ref += x(i, k) * y(k, j);
            allNear = allNear && near(ref, xy(i, j));
        }
    CHECK(allNear);

    // (A*B)^T = B^T * A^T
    Matrix left = (a * c).transpose();
    Matrix right = c.transpose() * a.transpose();
    for (std::size_t i = 0; i < 2; i++)
        for (std::size_t j = 0; j < 2; j++)
            CHECK(near(left(i, j), right(i, j)));

    // Matrices vides
    Matrix e1(0, 3), e2(3, 0);
    Matrix e = e1 * e2;
    CHECK(e.rows() == 0 && e.cols() == 0);
    Matrix e3 = e2 * e1;
    CHECK(e3.rows() == 3 && e3.cols() == 3 && e3(1, 1) == 0.0f);

    // Produit dont une dimension vaut 0 : le résultat est vide, sans accès mémoire interdit.
    Matrix emptyColsProduct = a * e2; // (2x3) * (3x0) -> (2x0)
    CHECK(emptyColsProduct.rows() == 2 && emptyColsProduct.cols() == 0 && emptyColsProduct.size() == 0);
    Matrix emptyRowsProduct = e1 * Matrix(3, 2); // (0x3) * (3x2) -> (0x2)
    CHECK(emptyRowsProduct.rows() == 0 && emptyRowsProduct.cols() == 2 && emptyRowsProduct.size() == 0);
    Matrix emptyBothProduct = e1 * e2; // (0x3) * (3x0) -> (0x0)
    CHECK(emptyBothProduct.rows() == 0 && emptyBothProduct.cols() == 0);
    Matrix zeroInnerProduct = Matrix(2, 0) * Matrix(0, 3); // (2x0) * (0x3) -> (2x3) de zéros
    CHECK(zeroInnerProduct.rows() == 2 && zeroInnerProduct.cols() == 3 && zeroInnerProduct(1, 2) == 0.0f);

    // fill / zero
    Matrix f(2, 2, 3.0f);
    f.fill(9.0f);
    CHECK(f(0, 0) == 9.0f && f(1, 1) == 9.0f);
    f.zero();
    CHECK(f(0, 1) == 0.0f && f(1, 0) == 0.0f);

    // sumRows : (2x3) -> (1x3), colonne par colonne
    Matrix s = a.sumRows(); // a = {{1,2,3},{4,5,6}}
    CHECK(s.rows() == 1 && s.cols() == 3);
    CHECK(s(0, 0) == 5 && s(0, 1) == 7 && s(0, 2) == 9);
    Matrix noRows(0, 3);
    Matrix sNone = noRows.sumRows();
    CHECK(sNone.rows() == 1 && sNone.cols() == 3 && sNone(0, 0) == 0.0f);

    // addRowVector : le biais est ajouté à chaque ligne
    Matrix bias = {{10, 20, 30}};
    Matrix withBias = a.addRowVector(bias);
    CHECK(withBias.rows() == 2 && withBias.cols() == 3);
    CHECK(withBias(0, 0) == 11 && withBias(0, 2) == 33 && withBias(1, 0) == 14 && withBias(1, 2) == 36);
    CHECK(throwsDimension([&] { a.addRowVector(Matrix({{1, 2}})); }));     // mauvaise largeur
    CHECK(throwsDimension([&] { a.addRowVector(Matrix({{1, 2, 3}, {4, 5, 6}})); })); // pas une seule ligne

    // map : applique une fonction à chaque élément, sans modifier l'original
    Matrix squared = a.map([](float v) { return v * v; });
    CHECK(squared(0, 1) == 4 && squared(1, 2) == 36);
    CHECK(a(0, 1) == 2);
    Matrix relu = Matrix({{-1, 2}, {0, -3}}).map([](float v) { return v > 0 ? v : 0.0f; });
    CHECK(relu(0, 0) == 0 && relu(0, 1) == 2 && relu(1, 0) == 0 && relu(1, 1) == 0);

    // selectRows : extraction dans l'ordre demandé, doublons permis
    Matrix picked = a.selectRows({1, 0, 1});
    CHECK(picked.rows() == 3 && picked.cols() == 3);
    CHECK(picked(0, 0) == 4 && picked(1, 0) == 1 && picked(2, 2) == 6);
    CHECK(a.selectRows({}).rows() == 0);
    CHECK(throwsDimension([&] { a.selectRows({0, 2}); }));

    // argmaxRows : première occurrence en cas d'égalité
    Matrix scores = {{0.1f, 0.7f, 0.2f}, {0.9f, 0.05f, 0.05f}, {1.0f, 1.0f, 0.0f}};
    std::vector<std::size_t> best = scores.argmaxRows();
    CHECK(best.size() == 3 && best[0] == 1 && best[1] == 0 && best[2] == 0);
    CHECK(Matrix(0, 3).argmaxRows().empty());
    CHECK(throwsDimension([] { Matrix(2, 0).argmaxRows(); }));

    // write / read : aller-retour exact, flux tronqué, dimensions absurdes
    {
        std::stringstream buffer;
        a.write(buffer);
        Matrix back = Matrix::read(buffer);
        CHECK(back.rows() == a.rows() && back.cols() == a.cols());
        bool identical = true;
        for (std::size_t i = 0; i < a.size(); i++)
            identical = identical && back.data()[i] == a.data()[i];
        CHECK(identical);

        std::stringstream emptyBuffer;
        Matrix(0, 4).write(emptyBuffer);
        Matrix emptyBack = Matrix::read(emptyBuffer);
        CHECK(emptyBack.rows() == 0 && emptyBack.cols() == 4);

        std::stringstream full;
        a.write(full);
        const std::string bytes = full.str();
        std::stringstream truncated(bytes.substr(0, bytes.size() - 3));
        CHECK(throwsType<mytorch::FileError>([&] { Matrix::read(truncated); }));
        std::stringstream onlyHalfHeader(bytes.substr(0, 5));
        CHECK(throwsType<mytorch::FileError>([&] { Matrix::read(onlyHalfHeader); }));

        const std::uint32_t huge[2] = {0xFFFFFFFFu, 0xFFFFFFFFu};
        std::stringstream absurd(std::string(reinterpret_cast<const char *>(huge), sizeof(huge)));
        CHECK(throwsType<mytorch::FormatError>([&] { Matrix::read(absurd); }));
    }

    if (failures == 0)
        std::cout << "test_matrix : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
