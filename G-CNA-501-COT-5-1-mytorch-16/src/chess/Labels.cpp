/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Labels.hpp
** Dépend de : include/chess/Labels.hpp
*/

#include "chess/Labels.hpp"

#include "mytorch/StringUtils.hpp"

namespace mytorch {
namespace chess {

namespace {

const std::vector<std::string> kLabelsFull = {
    "Nothing",
    "Check White",
    "Check Black",
    "Checkmate White",
    "Checkmate Black"
};

const std::vector<std::string> kLabelsBasic = {
    "Nothing",
    "Check",
    "Checkmate"
};

std::string toBasicLabel(const std::string &label)
{
    if (label == "Nothing")
        return "Nothing";
    if (label == "Check White" || label == "Check Black" || label == "Check")
        return "Check";
    if (label == "Checkmate White" || label == "Checkmate Black" || label == "Checkmate")
        return "Checkmate";
    throw FenError("Labels: étiquette inconnue '" + label + "'");
}

} // namespace

std::size_t numClasses(LabelMode mode)
{
    return mode == LabelMode::Full ? kNumClassesFull : kNumClassesBasic;
}

const std::vector<std::string> &getClassNames(LabelMode mode)
{
    return mode == LabelMode::Full ? kLabelsFull : kLabelsBasic;
}

std::size_t labelToIndex(const std::string &label, LabelMode mode)
{
    std::string cleaned = mytorch::trim(label);
    if (cleaned.empty())
        throw FenError("Labels: étiquette vide");
    std::string target = mode == LabelMode::Full ? cleaned : toBasicLabel(cleaned);
    const std::vector<std::string> &names = getClassNames(mode);
    for (std::size_t i = 0; i < names.size(); i++) {
        if (names[i] == target)
            return i;
    }
    throw FenError("Labels: étiquette inconnue '" + label + "'");
}

std::string indexToLabel(std::size_t index, LabelMode mode)
{
    const std::vector<std::string> &names = getClassNames(mode);
    if (index >= names.size())
        throw FenError("Labels: index de classe invalide");
    return names[index];
}

} // namespace chess
} // namespace mytorch
