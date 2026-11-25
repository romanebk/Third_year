/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Correspondance entre étiquettes texte et indices de classes.
** Dépend de : chess/Errors.hpp
*/

#pragma once

#include <cstddef>
#include <string>
#include <vector>

#include "chess/Errors.hpp"

namespace mytorch {
namespace chess {

static constexpr std::size_t kNumClassesBasic = 3;
static constexpr std::size_t kNumClassesFull = 5;

// Le mode "full" distingue 5 classes (avec la couleur), le mode "basic" 3 classes.
// Il est passé explicitement partout : pas d'état global caché.
enum class LabelMode {
    Basic,
    Full
};

// Nombre de classes pour un mode donné
std::size_t numClasses(LabelMode mode);

// Liste des libellés dans l'ordre utilisé par le réseau, pour un mode donné
const std::vector<std::string> &getClassNames(LabelMode mode);

// Convertit un label texte (tel qu'il apparaît dans le dataset) vers son index
std::size_t labelToIndex(const std::string &label, LabelMode mode);

// Convertit un index vers son label texte
std::string indexToLabel(std::size_t index, LabelMode mode);

} // namespace chess
} // namespace mytorch
