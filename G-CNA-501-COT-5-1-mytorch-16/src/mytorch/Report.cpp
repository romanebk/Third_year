/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Report.hpp
** Dépend de : include/analyzer/Report.hpp
*/

#include "mytorch/Report.hpp"

#include <fstream>
#include <iomanip>
#include <sstream>

#include "mytorch/Errors.hpp"

namespace mytorch {

namespace {

void openForWriting(std::ofstream &out, const std::string &path)
{
    out.open(path, std::ios::trunc);
    if (!out.is_open())
        throw FileError("Report: impossible d'écrire le fichier '" + path + "'");
}

std::string formatDouble(double value)
{
    std::ostringstream stream;
    stream << std::fixed << std::setprecision(6) << value;
    return stream.str();
}

} // namespace

void writeLearningCurves(const std::string &path, const std::vector<EpochReport> &epochs)
{
    std::ofstream out;
    openForWriting(out, path);
    out << "epoch,loss,train_accuracy,validation_accuracy,validation_f1\n";
    for (const auto &epoch : epochs) {
        out << epoch.epoch << ','
            << formatDouble(epoch.loss) << ','
            << formatDouble(epoch.trainAccuracy) << ','
            << formatDouble(epoch.validationAccuracy) << ','
            << formatDouble(epoch.validationF1) << '\n';
    }
    if (!out)
        throw FileError("Report: écriture impossible dans '" + path + "'");
}

void writeConfusionMatrix(const std::string &path, const ClassificationReport &report)
{
    std::ofstream out;
    openForWriting(out, path);
    out << "real\\predicted";
    for (const auto &metrics : report.perClass)
        out << ',' << metrics.label;
    out << '\n';
    for (std::size_t i = 0; i < report.perClass.size(); i++) {
        out << report.perClass[i].label;
        for (std::size_t j = 0; j < report.perClass.size(); j++)
            out << ',' << report.confusion.at(i, j);
        out << '\n';
    }
    if (!out)
        throw FileError("Report: écriture impossible dans '" + path + "'");
}

void writeClassMetrics(const std::string &path, const ClassificationReport &report)
{
    std::ofstream out;
    openForWriting(out, path);
    out << "class,precision,recall,f1,support\n";
    for (const auto &metrics : report.perClass) {
        out << metrics.label << ','
            << formatDouble(metrics.precision) << ','
            << formatDouble(metrics.recall) << ','
            << formatDouble(metrics.f1) << ','
            << formatDouble(metrics.support) << '\n';
    }
    if (!out)
        throw FileError("Report: écriture impossible dans '" + path + "'");
}

} // namespace mytorch
