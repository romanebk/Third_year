/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de chess/Augment.hpp
** Dépend de : include/chess/Augment.hpp
*/

#include "chess/Augment.hpp"

#include <algorithm>
#include <utility>

namespace mytorch {
namespace chess {

namespace {

// Les 768 premières valeurs sont 64 cases de kPieceTypes valeurs, rangée 8 -> 1
// puis colonne a -> h. Les 5 suivantes sont le trait puis K, Q, k, q.
constexpr std::size_t kSquaresOffset = 0;
constexpr std::size_t kCastlingOffset = kBoardSquares * kPieceTypes + 1;

float *squareAt(float *encoded, std::size_t square)
{
    return encoded + kSquaresOffset + square * kPieceTypes;
}

} // namespace

void mirrorHorizontally(float *encoded)
{
    // Le miroir est une permutation de cases à l'intérieur de chaque rangée :
    // on échange les blocs de kPieceTypes valeurs des colonnes symétriques.
    for (std::size_t rank = 0; rank < 8; rank++) {
        for (std::size_t file = 0; file < 4; file++) {
            float *left = squareAt(encoded, rank * 8 + file);
            float *right = squareAt(encoded, rank * 8 + (7 - file));
            for (std::size_t piece = 0; piece < kPieceTypes; piece++)
                std::swap(left[piece], right[piece]);
        }
    }
    // Le grand roque devient petit roque et réciproquement.
    float *castling = encoded + kCastlingOffset;
    std::swap(castling[0], castling[1]);
    std::swap(castling[2], castling[3]);
}

void swapColors(float *encoded)
{
    // Les 6 premiers canaux d'une case sont blancs (P N B R Q K), les 6 suivants
    // noirs (p n b r q k) : échanger les deux moitiés inverse la couleur.
    for (std::size_t square = 0; square < kBoardSquares; square++) {
        float *values = squareAt(encoded, square);
        for (std::size_t piece = 0; piece < kPieceTypes / 2; piece++)
            std::swap(values[piece], values[piece + kPieceTypes / 2]);
    }
    // Un pion blanc attaque vers le haut et un pion noir vers le bas : pour que la
    // position obtenue ait la même classe que l'originale, y compris quand un pion
    // donne l'échec, l'échiquier doit aussi être retourné verticalement
    // (rangée 8 <-> rangée 1, la colonne ne change pas).
    for (std::size_t rank = 0; rank < 4; rank++) {
        for (std::size_t file = 0; file < 8; file++) {
            float *top = squareAt(encoded, rank * 8 + file);
            float *bottom = squareAt(encoded, (7 - rank) * 8 + file);
            for (std::size_t piece = 0; piece < kPieceTypes; piece++)
                std::swap(top[piece], bottom[piece]);
        }
    }
    // Le trait change de camp.
    float *sideToMove = encoded + kBoardSquares * kPieceTypes;
    *sideToMove = (*sideToMove > 0.5f) ? 0.0f : 1.0f;
    // Les droits de roque des blancs deviennent ceux des noirs.
    float *castling = encoded + kCastlingOffset;
    std::swap(castling[0], castling[2]);
    std::swap(castling[1], castling[3]);
}

void applySymmetry(float *encoded, Symmetry symmetry)
{
    if (symmetry == Symmetry::Mirror || symmetry == Symmetry::MirrorColorSwap)
        mirrorHorizontally(encoded);
    if (flipsColors(symmetry))
        swapColors(encoded);
}

bool flipsColors(Symmetry symmetry)
{
    return symmetry == Symmetry::ColorSwap || symmetry == Symmetry::MirrorColorSwap;
}

void swapTargetColors(float *targets, std::size_t row, std::size_t stride, LabelMode mode)
{
    if (mode != LabelMode::Full)
        return;
    float *values = targets + row * stride;
    std::swap(values[1], values[2]); // Check White <-> Check Black
    std::swap(values[3], values[4]); // Checkmate White <-> Checkmate Black
}

Symmetry randomSymmetry(std::mt19937 &gen)
{
    std::uniform_int_distribution<int> pick(0, 3);
    return static_cast<Symmetry>(pick(gen));
}

} // namespace chess
} // namespace mytorch
