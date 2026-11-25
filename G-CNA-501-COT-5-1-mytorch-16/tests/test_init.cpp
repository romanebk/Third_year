/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests des initialisations de poids.
** Dépend de : include/mytorch/Init.hpp
*/

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <random>

#include "mytorch/Init.hpp"

using namespace mytorch;

static int failures = 0;

#define CHECK(cond)                                                       \
    do {                                                                  \
        if (!(cond)) {                                                    \
            std::cerr << "FAIL ligne " << __LINE__ << " : " #cond "\n";   \
            failures++;                                                   \
        }                                                                 \
    } while (0)

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

struct Stats {
    double mean;
    double stddev;
    float maxAbs;
};

static Stats stats(const Matrix &m)
{
    double sum = 0.0;
    float maxAbs = 0.0f;
    for (std::size_t i = 0; i < m.size(); i++) {
        sum += m.data()[i];
        maxAbs = std::max(maxAbs, std::fabs(m.data()[i]));
    }
    const double mean = sum / static_cast<double>(m.size());
    double var = 0.0;
    for (std::size_t i = 0; i < m.size(); i++) {
        const double d = m.data()[i] - mean;
        var += d * d;
    }
    return {mean, std::sqrt(var / static_cast<double>(m.size())), maxAbs};
}

static bool relClose(double value, double expected, double tolerance)
{
    return std::fabs(value - expected) <= tolerance * expected;
}

int main()
{
    const std::size_t nIn = 773;
    const std::size_t nOut = 256;

    // Noms des stratégies
    CHECK(initStrategyFromName("xavier") == InitStrategy::Xavier);
    CHECK(initStrategyFromName("He") == InitStrategy::He);
    CHECK(initStrategyFromName("LECUN") == InitStrategy::LeCun);
    // Tolérance des espaces et fins de ligne venant d'un .conf
    CHECK(initStrategyFromName("  xavier\r\n") == InitStrategy::Xavier);
    CHECK(initStrategyFromName("\tHe ") == InitStrategy::He);
    CHECK(throwsType<FormatError>([] { initStrategyFromName("glorot"); }));
    CHECK(throwsType<FormatError>([] { initStrategyFromName(""); }));
    CHECK(throwsType<FormatError>([] { initStrategyFromName("   \r\n"); }));

    // Forme des matrices
    std::mt19937 gen(1);
    Matrix w = initWeights(nIn, nOut, InitStrategy::He, gen);
    CHECK(w.rows() == nIn && w.cols() == nOut);
    Matrix b = initBias(nOut);
    CHECK(b.rows() == 1 && b.cols() == nOut);
    bool biasZero = true;
    for (std::size_t j = 0; j < nOut; j++)
        biasZero = biasZero && b(0, j) == 0.0f;
    CHECK(biasZero);

    // Xavier : uniforme sur [-l, +l], l = sqrt(6 / (n_in + n_out)) ~ 0.0764 ; écart-type = l / sqrt(3)
    {
        std::mt19937 g(7);
        Matrix x = initWeights(nIn, nOut, InitStrategy::Xavier, g);
        // Même calcul en float que le code testé, sinon l'arrondi donne une limite 5e-9 trop petite.
        const float limit = std::sqrt(6.0f / static_cast<float>(nIn + nOut));
        Stats s = stats(x);
        CHECK(s.maxAbs <= limit);
        CHECK(s.maxAbs > 0.99 * limit); // on couvre bien tout l'intervalle
        CHECK(std::fabs(s.mean) < 0.001);
        CHECK(relClose(s.stddev, limit / std::sqrt(3.0), 0.02));
    }

    // He : normale, écart-type sqrt(2 / n_in) ~ 0.0509
    {
        std::mt19937 g(7);
        Stats s = stats(initWeights(nIn, nOut, InitStrategy::He, g));
        CHECK(std::fabs(s.mean) < 0.001);
        CHECK(relClose(s.stddev, std::sqrt(2.0 / static_cast<double>(nIn)), 0.02));
    }

    // LeCun : normale, écart-type sqrt(1 / n_in) ~ 0.0360
    {
        std::mt19937 g(7);
        Stats s = stats(initWeights(nIn, nOut, InitStrategy::LeCun, g));
        CHECK(std::fabs(s.mean) < 0.001);
        CHECK(relClose(s.stddev, std::sqrt(1.0 / static_cast<double>(nIn)), 0.02));
    }

    // Reproductibilité : même graine -> mêmes poids ; graine différente -> poids différents
    {
        std::mt19937 g1(42), g2(42), g3(43);
        Matrix a = initWeights(20, 10, InitStrategy::Xavier, g1);
        Matrix c = initWeights(20, 10, InitStrategy::Xavier, g2);
        Matrix d = initWeights(20, 10, InitStrategy::Xavier, g3);
        bool same = true, different = false;
        for (std::size_t i = 0; i < a.size(); i++) {
            same = same && a.data()[i] == c.data()[i];
            different = different || a.data()[i] != d.data()[i];
        }
        CHECK(same);
        CHECK(different);
    }

    // Deux couches tirées avec le même générateur ont des poids différents
    {
        std::mt19937 g(5);
        Matrix first = initWeights(8, 8, InitStrategy::He, g);
        Matrix second = initWeights(8, 8, InitStrategy::He, g);
        bool different = false;
        for (std::size_t i = 0; i < first.size(); i++)
            different = different || first.data()[i] != second.data()[i];
        CHECK(different);
    }

    // Dimensions invalides
    CHECK(throwsType<DimensionError>([&] { initWeights(0, 4, InitStrategy::He, gen); }));
    CHECK(throwsType<DimensionError>([&] { initWeights(4, 0, InitStrategy::Xavier, gen); }));
    CHECK(throwsType<DimensionError>([] { initBias(0); }));

    if (failures == 0)
        std::cout << "test_init : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
