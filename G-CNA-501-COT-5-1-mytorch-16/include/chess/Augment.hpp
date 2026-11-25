/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Augmentation de données par les symétries de l'échiquier.
** Dépend de : chess/Fen.hpp, chess/Labels.hpp
*/

#pragma once

#include <cstddef>
#include <random>

#include "chess/Fen.hpp"
#include "chess/Labels.hpp"

namespace mytorch {
namespace chess {

// Symétries exactes du jeu d'échecs utilisées pour l'augmentation de données : elles
// conservent la classe d'une position (Nothing, Check ou Checkmate).
//
// Le miroir gauche-droite (colonne a <-> h) est exact. L'inversion des couleurs
// (blancs <-> noirs) l'est aussi, à condition de retourner en même temps l'échiquier
// verticalement (rangée 8 <-> rangée 1) : un pion blanc attaque vers le haut et un
// pion noir vers le bas, donc échanger les couleurs sans retourner l'échiquier
// ferait perdre leur échec aux positions où un pion donne l'échec (4,9 % des
// échecs). C'était le comportement avant le 27/10/2026 ; la mesure est dans
// docs/DESIGN_CHOICES.md §18 et scripts/audit_augmentation.py. Les deux symétries
// peuvent se composer, d'où quatre cas.
enum class Symmetry {
    Identity = 0,
    Mirror = 1,
    ColorSwap = 2,
    MirrorColorSwap = 3
};

// Applique une symétrie à un vecteur encodé de kFenEncodedSize valeurs.
// `encoded` doit être modifiable et de taille kFenEncodedSize.
void applySymmetry(float *encoded, Symmetry symmetry);

// Miroir gauche-droite : la case (rangée, colonne) devient (rangée, 7 - colonne).
// Les droits de roque suivent : K <-> Q et k <-> q.
void mirrorHorizontally(float *encoded);

// Inversion des couleurs : chaque pièce blanche devient la pièce noire de même
// type (et réciproquement), l'échiquier est retourné verticalement, le trait est
// inversé, et les droits de roque échangent KQ avec kq.
void swapColors(float *encoded);

// Vrai si la symétrie inverse les couleurs (il faut alors échanger les classes
// qui nomment une couleur, cf. swapTargetColors).
bool flipsColors(Symmetry symmetry);

// Échange les classes « Check White » <-> « Check Black » et
// « Checkmate White » <-> « Checkmate Black » de la ligne `row` d'une matrice
// de cibles one-hot (N x C). Ne fait rien en mode basic, où la couleur n'est
// pas une classe.
void swapTargetColors(float *targets, std::size_t row, std::size_t stride, LabelMode mode);

// Tire une symétrie uniformément parmi les quatre.
Symmetry randomSymmetry(std::mt19937 &gen);

} // namespace chess
} // namespace mytorch
