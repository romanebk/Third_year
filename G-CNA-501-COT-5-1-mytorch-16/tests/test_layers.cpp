/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests de Layer, Dense et des activations.
** Dépend de : include/mytorch/Dense.hpp, include/mytorch/Activation.hpp
*/

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <random>
#include <sstream>

#include "mytorch/Activation.hpp"
#include "mytorch/Dense.hpp"

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

static bool near(float a, float b, float tolerance = 1e-3f) { return std::fabs(a - b) <= tolerance; }

static bool matrixNear(const Matrix &m, const Matrix &expected, float tolerance = 1e-3f)
{
    if (m.rows() != expected.rows() || m.cols() != expected.cols())
        return false;
    for (std::size_t i = 0; i < m.size(); i++)
        if (!near(m.data()[i], expected.data()[i], tolerance))
            return false;
    return true;
}

// ---------------------------------------------------------------- gradient numérique
// Perte de test : L = somme(sortie ⊙ G), où G joue le rôle du gradient reçu de la couche suivante.
// Alors dL/dsortie = G, et backward(G) doit donner dL/dentrée (et dL/dparamètres).

static double testLoss(Layer &layer, const Matrix &x, const Matrix &g)
{
    Matrix y = layer.forward(x);
    double sum = 0.0;
    for (std::size_t i = 0; i < y.size(); i++)
        sum += static_cast<double>(y.data()[i]) * static_cast<double>(g.data()[i]);
    return sum;
}

static double relativeError(double analytic, double numeric)
{
    return std::fabs(analytic - numeric) / std::max(1.0, std::fabs(analytic) + std::fabs(numeric));
}

// Compare le gradient d'entrée et les gradients de paramètres au gradient numérique.
static bool gradientCheck(Layer &layer, const Matrix &x, const Matrix &g)
{
    const float eps = 1e-2f;
    const double tolerance = 5e-3;

    layer.forward(x);
    Matrix gradInput = layer.backward(g);
    std::vector<Matrix> gradParams;
    for (const Parameter &p : layer.parameters())
        gradParams.push_back(*p.gradient);

    bool ok = true;
    Matrix probe = x;
    for (std::size_t i = 0; i < probe.size(); i++) {
        const float original = probe.data()[i];
        probe.data()[i] = original + eps;
        const double plus = testLoss(layer, probe, g);
        probe.data()[i] = original - eps;
        const double minus = testLoss(layer, probe, g);
        probe.data()[i] = original;
        ok = ok && relativeError(gradInput.data()[i], (plus - minus) / (2.0 * eps)) < tolerance;
    }

    std::vector<Parameter> params = layer.parameters();
    for (std::size_t k = 0; k < params.size(); k++) {
        Matrix &value = *params[k].value;
        for (std::size_t i = 0; i < value.size(); i++) {
            const float original = value.data()[i];
            value.data()[i] = original + eps;
            const double plus = testLoss(layer, x, g);
            value.data()[i] = original - eps;
            const double minus = testLoss(layer, x, g);
            value.data()[i] = original;
            ok = ok && relativeError(gradParams[k].data()[i], (plus - minus) / (2.0 * eps)) < tolerance;
        }
    }
    return ok;
}

static Matrix randomMatrix(std::size_t rows, std::size_t cols, std::mt19937 &gen, bool awayFromZero = false)
{
    std::uniform_real_distribution<float> dist(0.2f, 2.0f);
    std::bernoulli_distribution sign(0.5);
    Matrix m(rows, cols);
    for (std::size_t i = 0; i < m.size(); i++) {
        const float magnitude = dist(gen);
        m.data()[i] = (sign(gen) ? magnitude : -magnitude) * (awayFromZero ? 1.0f : 0.8f);
    }
    return m;
}

int main()
{
    // ------------------------------------------------------------ exemple chiffré (MATHS section 8)
    // 2 entrées -> 2 neurones cachés (ReLU) -> 2 sorties (softmax), 1 position, classe 0.
    {
        std::mt19937 gen(1);
        Dense d1(2, 2, InitStrategy::He, gen);
        Dense d2(2, 2, InitStrategy::He, gen);
        ReLU relu;
        Softmax softmax;
        *d1.parameters()[0].value = Matrix{{0.5f, -1.0f}, {0.3f, 0.8f}};
        *d1.parameters()[1].value = Matrix{{0.1f, -0.2f}};
        *d2.parameters()[0].value = Matrix{{1.0f, -0.5f}, {0.2f, 0.7f}};
        *d2.parameters()[1].value = Matrix{{0.0f, 0.1f}};

        const Matrix x = {{1.0f, 2.0f}};
        Matrix z1 = d1.forward(x);
        CHECK(matrixNear(z1, Matrix{{1.2f, 0.4f}}));
        Matrix a1 = relu.forward(z1);
        CHECK(matrixNear(a1, Matrix{{1.2f, 0.4f}}));
        Matrix z2 = d2.forward(a1);
        CHECK(matrixNear(z2, Matrix{{1.28f, -0.22f}}));
        Matrix p = softmax.forward(z2);
        CHECK(matrixNear(p, Matrix{{0.8176f, 0.1824f}}, 1e-4f));

        // Rétropropagation à partir de dZ2 = P - Y (cas fusionné softmax + cross-entropy).
        const Matrix dz2 = {{p(0, 0) - 1.0f, p(0, 1)}};
        CHECK(matrixNear(dz2, Matrix{{-0.1824f, 0.1824f}}, 1e-4f));
        Matrix da1 = d2.backward(dz2);
        CHECK(matrixNear(*d2.parameters()[0].gradient, Matrix{{-0.2189f, 0.2189f}, {-0.0730f, 0.0730f}}));
        CHECK(matrixNear(*d2.parameters()[1].gradient, Matrix{{-0.1824f, 0.1824f}}));
        CHECK(matrixNear(da1, Matrix{{-0.2736f, 0.0912f}}));
        Matrix dz1 = relu.backward(da1);
        CHECK(matrixNear(dz1, Matrix{{-0.2736f, 0.0912f}}));
        d1.backward(dz1);
        CHECK(matrixNear(*d1.parameters()[0].gradient, Matrix{{-0.2736f, 0.0912f}, {-0.5473f, 0.1824f}}));
        CHECK(matrixNear(*d1.parameters()[1].gradient, Matrix{{-0.2736f, 0.0912f}}));
    }

    // ------------------------------------------------------------ Dense
    {
        std::mt19937 gen(2);
        Dense d(3, 2, InitStrategy::Xavier, gen);
        std::vector<Parameter> params = d.parameters();
        CHECK(params.size() == 2);
        CHECK(params[0].value->rows() == 3 && params[0].value->cols() == 2);
        CHECK(params[1].value->rows() == 1 && params[1].value->cols() == 2);
        CHECK(params[0].gradient->rows() == 3 && params[1].gradient->cols() == 2);
        CHECK(d.type() == "dense");

        // Le biais démarre à zéro, et s'ajoute à chaque ligne du batch.
        *params[0].value = Matrix{{1, 0}, {0, 1}, {1, 1}};
        *params[1].value = Matrix{{10, 20}};
        Matrix out = d.forward(Matrix{{1, 2, 3}, {0, 0, 0}});
        CHECK(matrixNear(out, Matrix{{14, 25}, {10, 20}}));

        // Mauvaise largeur d'entrée, backward sans forward, backward après un forward en prédiction.
        CHECK(throwsType<DimensionError>([&] { d.forward(Matrix(2, 4)); }));
        Dense fresh(3, 2, InitStrategy::He, gen);
        CHECK(throwsType<Error>([&] { fresh.backward(Matrix(1, 2)); }));
        fresh.setTraining(false);
        fresh.forward(Matrix(1, 3));
        CHECK(throwsType<Error>([&] { fresh.backward(Matrix(1, 2)); }));
        CHECK(!fresh.isTraining());

        // Gradient numérique sur un batch de 4 positions (entrée, poids et biais).
        Dense layer(5, 3, InitStrategy::He, gen);
        CHECK(gradientCheck(layer, randomMatrix(4, 5, gen), randomMatrix(4, 3, gen)));
    }

    // ------------------------------------------------------------ activations : valeurs
    {
        ReLU relu;
        CHECK(matrixNear(relu.forward(Matrix{{-1, 0, 2}}), Matrix{{0, 0, 2}}));
        CHECK(relu.type() == "relu");

        Sigmoid sigmoid;
        Matrix s = sigmoid.forward(Matrix{{0.0f, 1000.0f, -1000.0f}});
        CHECK(near(s(0, 0), 0.5f) && near(s(0, 1), 1.0f) && near(s(0, 2), 0.0f));
        CHECK(!std::isnan(s(0, 1)) && !std::isnan(s(0, 2)));

        Tanh tanh_;
        Matrix t = tanh_.forward(Matrix{{0.0f, 20.0f, -20.0f}});
        CHECK(near(t(0, 0), 0.0f) && near(t(0, 1), 1.0f) && near(t(0, 2), -1.0f));

        // Softmax : (0, 1, 2) donne (0.0900, 0.2447, 0.6652) ; (1000, 1001, 1002) doit donner la même chose.
        Softmax softmax;
        Matrix small = softmax.forward(Matrix{{0, 1, 2}});
        CHECK(matrixNear(small, Matrix{{0.0900f, 0.2447f, 0.6652f}}, 1e-4f));
        Matrix big = softmax.forward(Matrix{{1000, 1001, 1002}, {-1000, -1000, -1000}});
        CHECK(matrixNear(Matrix{{big(0, 0), big(0, 1), big(0, 2)}}, small, 1e-4f));
        float sum1 = big(0, 0) + big(0, 1) + big(0, 2);
        float sum2 = big(1, 0) + big(1, 1) + big(1, 2);
        CHECK(near(sum1, 1.0f, 1e-5f) && near(sum2, 1.0f, 1e-5f));
        CHECK(near(big(1, 0), 1.0f / 3.0f, 1e-5f));
        CHECK(throwsType<DimensionError>([&] { softmax.forward(Matrix(2, 0)); }));
    }

    // ------------------------------------------------------------ activations : gradient numérique
    {
        std::mt19937 gen(3);
        ReLU relu;
        CHECK(gradientCheck(relu, randomMatrix(3, 4, gen, true), randomMatrix(3, 4, gen)));
        Sigmoid sigmoid;
        CHECK(gradientCheck(sigmoid, randomMatrix(3, 4, gen), randomMatrix(3, 4, gen)));
        Tanh tanh_;
        CHECK(gradientCheck(tanh_, randomMatrix(3, 4, gen), randomMatrix(3, 4, gen)));
        Softmax softmax;
        CHECK(gradientCheck(softmax, randomMatrix(3, 4, gen), randomMatrix(3, 4, gen)));

        // backward avant forward, ou en mode prédiction : erreur claire
        ReLU fresh;
        CHECK(throwsType<Error>([&] { fresh.backward(Matrix(1, 2)); }));
        Softmax predictOnly;
        predictOnly.setTraining(false);
        predictOnly.forward(Matrix{{1, 2}});
        CHECK(throwsType<Error>([&] { predictOnly.backward(Matrix(1, 2)); }));
        CHECK(throwsType<DimensionError>([&] {
            Softmax sm;
            sm.forward(Matrix(2, 3));
            sm.backward(Matrix(2, 4));
        }));
        CHECK(sigmoid.parameters().empty() && relu.parameters().empty());
    }

    // ------------------------------------------------------------ fabrique d'activations
    {
        CHECK(makeActivation("relu")->type() == "relu");
        CHECK(makeActivation("Sigmoid")->type() == "sigmoid");
        CHECK(makeActivation("TANH")->type() == "tanh");
        CHECK(makeActivation("softmax")->type() == "softmax");
        CHECK(throwsType<FormatError>([] { makeActivation("gelu"); }));
        CHECK(throwsType<FormatError>([] { makeActivation(""); }));
    }

    // ------------------------------------------------------------ sauvegarde / chargement
    {
        std::mt19937 gen(4);
        Dense original(6, 3, InitStrategy::He, gen);
        std::stringstream buffer;
        original.save(buffer);

        Dense loaded;
        loaded.load(buffer);
        const Matrix x = randomMatrix(2, 6, gen);
        CHECK(matrixNear(original.forward(x), loaded.forward(x), 0.0f));

        // Flux tronqué ou biais incohérent : erreur, et la couche déjà chargée reste intacte.
        std::stringstream full;
        original.save(full);
        const std::string bytes = full.str();
        std::stringstream truncated(bytes.substr(0, bytes.size() - 4));
        Dense victim;
        CHECK(throwsType<Error>([&] { victim.load(truncated); }));

        std::stringstream inconsistent;
        Matrix(2, 3).write(inconsistent);
        Matrix(1, 5).write(inconsistent);
        CHECK(throwsType<FormatError>([&] { victim.load(inconsistent); }));

        // Les activations n'ont rien à écrire ni à lire.
        std::stringstream none;
        ReLU relu;
        relu.save(none);
        CHECK(none.str().empty());
        relu.load(none);
    }

    if (failures == 0)
        std::cout << "test_layers : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
