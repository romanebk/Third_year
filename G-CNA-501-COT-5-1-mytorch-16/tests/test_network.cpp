/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests de Loss, Network, Optimizer et Trainer.
** Dépend de : include/mytorch/Trainer.hpp
*/

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <random>

#include "mytorch/Activation.hpp"
#include "mytorch/Dense.hpp"
#include "mytorch/Loss.hpp"
#include "mytorch/Network.hpp"
#include "mytorch/Optimizer.hpp"
#include "mytorch/StackTrainer.hpp"
#include "mytorch/Trainer.hpp"

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

static bool near(double a, double b, double tolerance) { return std::fabs(a - b) <= tolerance; }

// ---------------------------------------------------------------- aides de construction

// Dense(in, hidden) + activation + Dense(hidden, out) + Softmax, tirés avec une graine donnée.
static std::vector<std::unique_ptr<Layer>> buildLayers(std::size_t in, std::size_t hidden, std::size_t out,
                                                       const std::string &activation, unsigned seed)
{
    std::mt19937 gen(seed);
    std::vector<std::unique_ptr<Layer>> layers;
    layers.push_back(std::make_unique<Dense>(in, hidden, InitStrategy::He, gen));
    layers.push_back(makeActivation(activation));
    layers.push_back(std::make_unique<Dense>(hidden, out, InitStrategy::Xavier, gen));
    layers.push_back(makeActivation("softmax"));
    return layers;
}

static Network buildNetwork(std::size_t in, std::size_t hidden, std::size_t out, const std::string &activation,
                            unsigned seed, const TrainSettings &settings = TrainSettings())
{
    NetworkFile file;
    file.inputSize = in;
    file.numClasses = out;
    file.labels.assign(out, "classe");
    file.training = settings;
    file.layers = buildLayers(in, hidden, out, activation, seed);
    return Network(std::move(file));
}

static Matrix randomInputs(std::size_t rows, std::size_t cols, std::mt19937 &gen)
{
    std::uniform_real_distribution<float> dist(-1.0f, 1.0f);
    Matrix m(rows, cols);
    for (std::size_t i = 0; i < m.size(); i++)
        m.data()[i] = dist(gen);
    return m;
}

static Matrix randomTargets(std::size_t rows, std::size_t classes, std::mt19937 &gen)
{
    std::uniform_int_distribution<std::size_t> pick(0, classes - 1);
    Matrix m(rows, classes);
    for (std::size_t i = 0; i < rows; i++)
        m(i, pick(gen)) = 1.0f;
    return m;
}

static double lossOf(Network &net, const Matrix &x, const Matrix &y)
{
    return crossEntropy(net.forward(x), y).value;
}

int main()
{
    // ------------------------------------------------------------ Loss : valeurs
    {
        // Exemple chiffré de MATHS_ET_IMPLEMENTATION.md : p = (0.8176, 0.1824), classe 0.
        Softmax softmax;
        Matrix p = softmax.forward(Matrix{{1.28f, -0.22f}});
        LossResult r = crossEntropy(p, Matrix{{1.0f, 0.0f}});
        CHECK(near(r.value, 0.2014, 1e-4));
        CHECK(r.gradient.rows() == 1 && r.gradient.cols() == 2);
        CHECK(near(r.gradient(0, 0), -1.0 / 0.8176, 1e-3)); // dL/dp0 = -y/p
        CHECK(r.gradient(0, 1) == 0.0f);

        // Moyenne sur le lot : le gradient est divisé par N.
        Matrix p2 = Matrix{{0.5f, 0.5f}, {0.25f, 0.75f}};
        LossResult r2 = crossEntropy(p2, Matrix{{1.0f, 0.0f}, {0.0f, 1.0f}});
        CHECK(near(r2.value, (std::log(2.0) + std::log(1.0 / 0.75)) / 2.0, 1e-6));
        CHECK(near(r2.gradient(0, 0), -1.0 / 0.5 / 2.0, 1e-6));
        CHECK(near(r2.gradient(1, 1), -1.0 / 0.75 / 2.0, 1e-5));

        // Protégée contre log(0) : valeur finie même si la bonne classe a la probabilité 0.
        LossResult zero = crossEntropy(Matrix{{0.0f, 1.0f}}, Matrix{{1.0f, 0.0f}});
        CHECK(std::isfinite(zero.value) && zero.value > 20.0);
        CHECK(std::isfinite(zero.gradient(0, 0)));

        // Lot vide et tailles différentes.
        LossResult empty = crossEntropy(Matrix(0, 3), Matrix(0, 3));
        CHECK(empty.value == 0.0 && empty.gradient.rows() == 0);
        CHECK(throwsType<DimensionError>([] { crossEntropy(Matrix(2, 3), Matrix(2, 2)); }));
        CHECK(throwsType<DimensionError>([] { crossEntropy(Matrix(2, 3), Matrix(3, 3)); }));
    }

    // ------------------------------------------------------------ Loss : dérivée numérique
    {
        std::mt19937 gen(5);
        Softmax softmax;
        Matrix p = softmax.forward(randomInputs(3, 4, gen));
        Matrix y = randomTargets(3, 4, gen);
        LossResult r = crossEntropy(p, y);
        const float eps = 1e-3f;
        bool ok = true;
        for (std::size_t i = 0; i < p.size(); i++) {
            Matrix plus = p, minus = p;
            plus.data()[i] += eps;
            minus.data()[i] -= eps;
            const double numeric = (crossEntropy(plus, y).value - crossEntropy(minus, y).value) / (2.0 * eps);
            ok = ok && std::fabs(numeric - r.gradient.data()[i]) < 5e-3 + 0.02 * std::fabs(numeric);
        }
        CHECK(ok);

        // Chaîné avec le vrai jacobien de Softmax : dL/dz = (p - y) / N.
        Softmax chained;
        Matrix z = randomInputs(3, 4, gen);
        Matrix probabilities = chained.forward(z);
        Matrix dz = chained.backward(crossEntropy(probabilities, y).gradient);
        bool same = true;
        for (std::size_t i = 0; i < dz.size(); i++)
            same = same && near(dz.data()[i], (probabilities.data()[i] - y.data()[i]) / 3.0, 1e-5);
        CHECK(same);
    }

    // ------------------------------------------------------------ Network : structure
    {
        CHECK(throwsType<FormatError>([] { Network net{NetworkFile()}; }));

        Network net = buildNetwork(3, 4, 2, "tanh", 1);
        CHECK(net.layers().size() == 4);
        CHECK(net.parameters().size() == 4); // W et b de chaque Dense
        CHECK(net.file().numClasses == 2);

        std::mt19937 gen(2);
        Matrix x = randomInputs(5, 3, gen);
        Matrix a = net.forward(x);
        Matrix b = net.predict(x);
        CHECK(a.rows() == 5 && a.cols() == 2);
        bool equal = true;
        for (std::size_t i = 0; i < a.size(); i++)
            equal = equal && a.data()[i] == b.data()[i];
        CHECK(equal);
        // Les sorties d'un softmax somment à 1.
        CHECK(near(b(0, 0) + b(0, 1), 1.0, 1e-5));

        // backward() après predict() : rien n'a été mémorisé, l'erreur doit être claire.
        net.predict(x);
        CHECK(throwsType<Error>([&] { net.backward(Matrix(5, 2)); }));
        net.forward(x);
        CHECK(net.backward(Matrix(5, 2, 0.1f)).rows() == 5);
    }

    // ------------------------------------------------------------ Network : save / load
    {
        TrainSettings settings;
        settings.epochs = 7;
        settings.learningRate = 0.123f;
        settings.momentum = 0.5f;
        Network net = buildNetwork(3, 4, 2, "relu", 3, settings);
        const std::string path = "/tmp/mytorch_test_network.nn";
        net.save(path);
        Network loaded = Network::load(path);
        std::remove(path.c_str());

        std::mt19937 gen(4);
        Matrix x = randomInputs(6, 3, gen);
        Matrix a = net.predict(x);
        Matrix b = loaded.predict(x);
        bool identical = a.rows() == b.rows() && a.cols() == b.cols();
        for (std::size_t i = 0; identical && i < a.size(); i++)
            identical = a.data()[i] == b.data()[i];
        CHECK(identical);
        CHECK(loaded.settings().epochs == 7 && near(loaded.settings().learningRate, 0.123, 1e-6));
        CHECK(throwsType<Error>([] { Network::load("/tmp/mytorch_does_not_exist.nn"); }));
    }

    // ------------------------------------------------------------ Network : gradient numérique complet
    // Perte (entropie croisée) de bout en bout contre les différences finies, pour chaque paramètre.
    for (const std::string activation : {"tanh", "sigmoid", "relu"}) {
        Network net = buildNetwork(3, 5, 2, activation, 10);
        std::mt19937 gen(11);
        Matrix x = randomInputs(6, 3, gen);
        Matrix y = randomTargets(6, 2, gen);

        LossResult loss = crossEntropy(net.forward(x), y);
        net.backward(loss.gradient);
        std::vector<Parameter> params = net.parameters();
        std::vector<Matrix> analytic;
        for (const Parameter &p : params)
            analytic.push_back(*p.gradient);

        const float eps = 1e-3f;
        bool ok = true;
        double worst = 0.0;
        for (std::size_t k = 0; k < params.size(); k++) {
            for (std::size_t i = 0; i < params[k].value->size(); i++) {
                const float original = params[k].value->data()[i];
                params[k].value->data()[i] = original + eps;
                const double plus = lossOf(net, x, y);
                params[k].value->data()[i] = original - eps;
                const double minus = lossOf(net, x, y);
                params[k].value->data()[i] = original;
                const double numeric = (plus - minus) / (2.0 * eps);
                const double error = std::fabs(numeric - analytic[k].data()[i]);
                worst = std::max(worst, error);
                ok = ok && error < 2e-3 + 0.02 * std::fabs(numeric);
            }
        }
        if (!ok)
            std::cerr << "gradient faux avec l'activation " << activation << " (pire écart " << worst << ")\n";
        CHECK(ok);
    }

    // ------------------------------------------------------------ Optimizer : calcul à la main
    {
        TrainSettings settings;
        settings.learningRate = 0.1f;
        settings.momentum = 0.9f;
        settings.l2 = 0.01f;
        NetworkFile file;
        file.inputSize = 1;
        file.numClasses = 1;
        file.labels = {"x"};
        std::mt19937 gen(1);
        file.layers.push_back(std::make_unique<Dense>(1, 1, InitStrategy::He, gen));
        Network net(std::move(file));
        std::vector<Parameter> params = net.parameters();
        Matrix &w = *params[0].value;
        Matrix &b = *params[1].value;
        w(0, 0) = 1.0f;
        b(0, 0) = 0.5f;
        (*params[0].gradient)(0, 0) = 2.0f;
        (*params[1].gradient)(0, 0) = 1.0f;

        Optimizer optimizer(net, settings);
        optimizer.step();
        // v = 2 ; w = 1 - 0.1·(2 + 0.01·1) = 0.799 ;  v = 1 ; b = 0.5 - 0.1·(1 + 0.01·0.5) = 0.3995
        CHECK(near(w(0, 0), 0.799, 1e-6));
        CHECK(near(b(0, 0), 0.3995, 1e-6));
        optimizer.step(); // mêmes gradients
        // v = 0.9·2 + 2 = 3.8 ; w = 0.799 - 0.1·(3.8 + 0.01·0.799) = 0.799 - 0.380799 = 0.418201
        CHECK(near(w(0, 0), 0.418201, 1e-6));
        // v = 0.9·1 + 1 = 1.9 ; b = 0.3995 - 0.1·(1.9 + 0.01·0.3995) = 0.2091005
        CHECK(near(b(0, 0), 0.2091005, 1e-6));

        // zeroGradients remet les gradients à zéro, sans toucher aux poids.
        const float wBefore = w(0, 0);
        optimizer.zeroGradients();
        CHECK((*params[0].gradient)(0, 0) == 0.0f && (*params[1].gradient)(0, 0) == 0.0f);
        CHECK(w(0, 0) == wBefore);

        // Avec un learning rate à zéro, un pas ne change plus aucun poids.
        optimizer.setLearningRate(0.0f);
        CHECK(optimizer.learningRate() == 0.0f);
        optimizer.step();
        CHECK(w(0, 0) == wBefore);
    }

    // ------------------------------------------------------------ Trainer : XOR appris
    {
        TrainSettings settings;
        settings.learningRate = 0.1f;
        settings.momentum = 0.9f;
        Network net = buildNetwork(2, 8, 2, "tanh", 7, settings);
        Optimizer optimizer(net, settings);
        Trainer trainer(net, optimizer, settings);

        const Matrix x = {{0, 0}, {0, 1}, {1, 0}, {1, 1}};
        const Matrix y = {{1, 0}, {0, 1}, {0, 1}, {1, 0}}; // classe 1 si les entrées diffèrent
        const double first = trainer.trainBatch(x, y);
        double last = first;
        for (int step = 0; step < 1500; step++)
            last = trainer.trainEpoch(x, y);
        CHECK(last < first);
        CHECK(last < 0.05);
        std::vector<std::size_t> predicted = trainer.predict(x).argmaxRows();
        CHECK(predicted[0] == 0 && predicted[1] == 1 && predicted[2] == 1 && predicted[3] == 0);
    }

    // ------------------------------------------------------------ Trainer = StackTrainer de repli
    // Même réseau, mêmes lots : les pertes et les poids doivent rester identiques.
    {
        TrainSettings settings;
        settings.learningRate = 0.05f;
        settings.momentum = 0.9f;
        settings.l2 = 0.001f;

        Network net = buildNetwork(6, 10, 3, "relu", 21, settings);
        std::vector<std::unique_ptr<Layer>> reference = buildLayers(6, 10, 3, "relu", 21);
        Optimizer optimizer(net, settings);
        Trainer trainer(net, optimizer, settings);
        StackTrainer fallback(settings);

        std::mt19937 gen(22);
        double worstLoss = 0.0;
        for (int step = 0; step < 30; step++) {
            Matrix x = randomInputs(8, 6, gen);
            Matrix y = randomTargets(8, 3, gen);
            const double a = trainer.trainBatch(x, y);
            const double b = fallback.trainEpoch(reference, x, y);
            worstLoss = std::max(worstLoss, std::fabs(a - b));
        }
        CHECK(worstLoss < 1e-4);

        std::vector<Parameter> mine = net.parameters();
        std::vector<Parameter> theirs;
        for (auto &layer : reference)
            for (const Parameter &p : layer->parameters())
                theirs.push_back(p);
        CHECK(mine.size() == theirs.size());
        double worstWeight = 0.0;
        for (std::size_t k = 0; k < mine.size() && k < theirs.size(); k++)
            for (std::size_t i = 0; i < mine[k].value->size(); i++)
                worstWeight = std::max(worstWeight, static_cast<double>(std::fabs(mine[k].value->data()[i] -
                                                                                  theirs[k].value->data()[i])));
        if (worstWeight >= 1e-4)
            std::cerr << "écart de poids avec StackTrainer : " << worstWeight << "\n";
        CHECK(worstWeight < 1e-4);
    }

    if (failures == 0)
        std::cout << "test_network : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
