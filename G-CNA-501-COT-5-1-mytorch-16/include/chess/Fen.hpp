/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Lecture d'une position au format FEN et encodage pour le réseau.
** Dépend de : chess/Errors.hpp
*/

#pragma once

#include <string>
#include <vector>

#include "chess/Errors.hpp"

namespace mytorch {
namespace chess {

static constexpr std::size_t kBoardSquares = 64;
static constexpr std::size_t kPieceTypes = 12;
static constexpr std::size_t kFenEncodedSize = kBoardSquares * kPieceTypes + 1 + 4; // 768 + 1 (trait) + 4 (roques) = 773

// Représente les 6 champs d'un FEN
struct FenParts {
    std::string board;         // champ 1 : pièces rangée 8 -> 1
    char sideToMove = 'w';     // champ 2 : 'w' ou 'b'
    std::string castling = "-"; // champ 3 : KQkq / -
    std::string enPassant = "-"; // champ 4
    int halfmoveClock = 0;     // champ 5
    int fullmoveNumber = 1;    // champ 6
    std::string label;         // présent uniquement dans les fichiers d'entraînement (ex: "Check", "Checkmate Black", "Nothing")
};

// Sépare un champ FEN seul ou une ligne complète du dataset (FEN + étiquette)
FenParts parseFen(const std::string &fen);
FenParts parseLine(const std::string &line);

// Encode une position en vecteur de 773 valeurs (floats 0.0f / 1.0f)
std::vector<float> encode(const FenParts &parts);

// Raccourci : accepte soit un FEN seul, soit une ligne "FEN ... label"
std::vector<float> encodeString(const std::string &fenOrLine);

} // namespace chess
} // namespace mytorch
