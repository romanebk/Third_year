/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Implémentation de Fen.hpp
** Dépend de : include/chess/Fen.hpp
*/

#include "chess/Fen.hpp"

#include <cctype>
#include <sstream>
#include <vector>

namespace mytorch {
namespace chess {

namespace {

// Ordre des 12 types de pièces : blancs d'abord (P N B R Q K), puis noirs (p n b r q k).
const std::string kPieceOrder = "PNBRQKpnbrqk";

int pieceIndex(char c)
{
    size_t pos = kPieceOrder.find(c);
    if (pos == std::string::npos)
        throw FenError(std::string("Fen: pièce inconnue '") + c + "'");
    return static_cast<int>(pos);
}

// Une rangée est valide si les cases qu'elle décrit font exactement 8.
void validateRank(const std::string &rank)
{
    int count = 0;
    for (char c : rank) {
        if (c >= '1' && c <= '8')
            count += c - '0';
        else if (kPieceOrder.find(c) != std::string::npos)
            count += 1;
        else
            throw FenError(std::string("Fen: caractère invalide dans le plateau '") + c + "'");
    }
    if (count != 8)
        throw FenError("Fen: chaque rangée doit représenter exactement 8 cases");
}

// Le plateau est valide s'il contient 8 rangées séparées par '/', chacune de 8 cases.
void validateBoardString(const std::string &board)
{
    if (board.empty())
        throw FenError("Fen: champ pièces vide");
    std::stringstream ss(board);
    std::string rank;
    int rankCount = 0;
    while (std::getline(ss, rank, '/')) {
        if (rankCount >= 8)
            throw FenError("Fen: un FEN doit contenir exactement 8 rangées séparées par '/'");
        validateRank(rank);
        rankCount++;
    }
    if (rankCount != 8)
        throw FenError("Fen: un FEN doit contenir exactement 8 rangées séparées par '/'");
}

// Remplit les 768 premières valeurs : une case occupée met un seul 1, les autres 0.
// Le plateau est lu rangée 8 -> 1 puis colonne a -> h, comme dans la FEN.
void encodeBoard(const std::string &board, std::vector<float> &out)
{
    std::vector<std::string> ranks;
    std::stringstream ss(board);
    std::string rankStr;
    while (std::getline(ss, rankStr, '/'))
        ranks.push_back(rankStr);
    if (ranks.size() != 8)
        throw FenError("Fen: impossible d'encoder le plateau");
    size_t square = 0;
    for (const std::string &rank : ranks) {
        for (char ch : rank) {
            if (ch >= '1' && ch <= '8') {
                square += static_cast<size_t>(ch - '0');
                continue;
            }
            if (square >= kBoardSquares)
                throw FenError("Fen: plateau trop grand pour 64 cases");
            size_t base = square * kPieceTypes + static_cast<size_t>(pieceIndex(ch));
            out[base] = 1.0f;
            square += 1;
        }
    }
}

// Remplit les 5 dernières valeurs : le trait, puis les droits de roque K, Q, k, q.
void encodeSideAndCastling(const FenParts &parts, std::vector<float> &out)
{
    size_t idx = kBoardSquares * kPieceTypes;
    out[idx++] = (parts.sideToMove == 'w') ? 1.0f : 0.0f;
    const std::string &cst = parts.castling;
    out[idx++] = (cst.find('K') != std::string::npos) ? 1.0f : 0.0f;
    out[idx++] = (cst.find('Q') != std::string::npos) ? 1.0f : 0.0f;
    out[idx++] = (cst.find('k') != std::string::npos) ? 1.0f : 0.0f;
    out[idx++] = (cst.find('q') != std::string::npos) ? 1.0f : 0.0f;
}

} // namespace

FenParts parseFen(const std::string &fen)
{
    std::stringstream ss(fen);
    FenParts parts;
    std::string board, side, castling, enPassant, halfmove, fullmove;
    if (!(ss >> board >> side >> castling >> enPassant >> halfmove >> fullmove))
        throw FenError("Fen: format invalide (attendu 6 champs)");
    if (side != "w" && side != "b")
        throw FenError("Fen: trait invalide (doit être 'w' ou 'b')");
    try {
        parts.halfmoveClock = std::stoi(halfmove);
        parts.fullmoveNumber = std::stoi(fullmove);
    } catch (...) {
        throw FenError("Fen: compteurs de coups invalides");
    }
    parts.board = board;
    parts.sideToMove = side[0];
    parts.castling = castling;
    parts.enPassant = enPassant;
    validateBoardString(parts.board);
    return parts;
}

FenParts parseLine(const std::string &line)
{
    std::stringstream ss(line);
    std::string board, side, castling, enPassant, halfmove, fullmove;
    if (!(ss >> board >> side >> castling >> enPassant >> halfmove >> fullmove))
        throw FenError("Fen: ligne invalide (FEN incomplet)");
    std::string rest;
    std::string token;
    while (ss >> token) {
        if (!rest.empty())
            rest += " ";
        rest += token;
    }
    std::string fenOnly = board + " " + side + " " + castling + " " + enPassant + " " + halfmove + " " + fullmove;
    FenParts parts = parseFen(fenOnly);
    parts.label = rest;
    return parts;
}

std::vector<float> encode(const FenParts &parts)
{
    std::vector<float> out(kFenEncodedSize, 0.0f);
    encodeBoard(parts.board, out);
    encodeSideAndCastling(parts, out);
    return out;
}

std::vector<float> encodeString(const std::string &fenOrLine)
{
    FenParts parts = parseLine(fenOrLine);
    return encode(parts);
}

} // namespace chess
} // namespace mytorch
