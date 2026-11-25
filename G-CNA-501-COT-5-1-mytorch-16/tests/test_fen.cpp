/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests du parseur FEN et de l'encodage 773.
** Dépend de : chess/Fen.hpp
*/

#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

#include "chess/Fen.hpp"

using mytorch::chess::FenError;
using namespace mytorch::chess;

static int failures = 0;

#define CHECK(cond)                                                                 \
    do {                                                                            \
        if (!(cond)) {                                                              \
            std::cerr << "FAIL ligne " << __LINE__ << " : " #cond "\n";             \
            failures++;                                                             \
        }                                                                           \
    } while (0)

template <typename F>
static bool throwsFen(F fn)
{
    try {
        fn();
    } catch (const FenError &) {
        return true;
    }
    return false;
}

static std::size_t countOnes(const std::vector<float> &v, std::size_t from, std::size_t to)
{
    std::size_t count = 0;
    for (std::size_t i = from; i < to && i < v.size(); i++)
        if (v[i] == 1.0f)
            count++;
    return count;
}

static void testParseDocExample()
{
    FenParts p = parseFen("8/8/R2k4/4r1p1/8/5K2/5P2/8 b - - 7 59");
    CHECK(p.board == "8/8/R2k4/4r1p1/8/5K2/5P2/8");
    CHECK(p.sideToMove == 'b');
    CHECK(p.castling == "-");
    CHECK(p.enPassant == "-");
    CHECK(p.halfmoveClock == 7);
    CHECK(p.fullmoveNumber == 59);
    CHECK(p.label.empty());
}

static void testEncodeDocExample()
{
    std::vector<float> v = encodeString("8/8/R2k4/4r1p1/8/5K2/5P2/8 b - - 7 59");
    CHECK(v.size() == kFenEncodedSize);
    CHECK(v.size() == 773);
    CHECK(countOnes(v, 0, 768) == 6);
    CHECK(v[16 * 12 + 3] == 1.0f);  // tour blanche a6
    CHECK(v[19 * 12 + 11] == 1.0f); // roi noir d6
    CHECK(v[28 * 12 + 9] == 1.0f);  // tour noire e5
    CHECK(v[30 * 12 + 6] == 1.0f);  // pion noir g5
    CHECK(v[45 * 12 + 5] == 1.0f);  // roi blanc f3
    CHECK(v[53 * 12] == 1.0f);      // pion blanc f2
    CHECK(v[768] == 0.0f);          // trait aux noirs
}

static void testEncodeStartPosition()
{
    std::vector<float> v = encodeString("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    CHECK(countOnes(v, 0, 768) == 32);
    CHECK(v[768] == 1.0f);
    CHECK(v[769] == 1.0f && v[770] == 1.0f && v[771] == 1.0f && v[772] == 1.0f);
    CHECK(v[56 * 12 + 3] == 1.0f); // tour blanche a1
    CHECK(v[0 * 12 + 9] == 1.0f);  // tour noire a8
}

static void testCastling()
{
    std::vector<float> partial = encodeString("8/8/8/8/8/8/8/8 w Kq - 0 1");
    CHECK(partial[769] == 1.0f);
    CHECK(partial[770] == 0.0f);
    CHECK(partial[771] == 0.0f);
    CHECK(partial[772] == 1.0f);
    std::vector<float> none = encodeString("8/8/8/8/8/8/8/8 w - - 0 1");
    CHECK(none[769] == 0.0f && none[770] == 0.0f && none[771] == 0.0f && none[772] == 0.0f);
}

static void testLabels()
{
    FenParts check = parseLine("8/8/R2k4/4r1p1/8/5K2/5P2/8 b - - 7 59 Check White");
    CHECK(check.label == "Check White");
    CHECK(check.sideToMove == 'b');
    FenParts mate = parseLine("8/8/8/1p1p2p1/q1p5/8/K1k5/8 w - - 4 70 Checkmate Black");
    CHECK(mate.label == "Checkmate Black");
    CHECK(mate.fullmoveNumber == 70);
    FenParts nothing = parseLine("8/5p1p/5K1P/6P1/7k/8/8/6R1 b - - 14 80 Nothing");
    CHECK(nothing.label == "Nothing");
    FenParts none = parseLine("8/8/8/8/8/8/8/8 w - - 0 1");
    CHECK(none.label.empty());
}

static void testErrors()
{
    CHECK(throwsFen([] { parseFen("8/8/8/8/8/8/8/8 w - - 0"); }));
    CHECK(throwsFen([] { parseFen("8/8/8/8/8/8/8 w - - 0 1"); }));
    CHECK(throwsFen([] { parseFen("8/8/8/8/8/8/8/8/8 w - - 0 1"); }));
    CHECK(throwsFen([] { parseFen("8/8/8/8/8/8/8/7 w - - 0 1"); }));
    CHECK(throwsFen([] { parseFen("9/8/8/8/8/8/8/8 w - - 0 1"); }));
    CHECK(throwsFen([] { parseFen("8/8/8/8/8/8/8/X7 w - - 0 1"); }));
    CHECK(throwsFen([] { parseFen("8/8/8/8/8/8/8/8 x - - 0 1"); }));
    CHECK(throwsFen([] { parseFen("8/8/8/8/8/8/8/8 w - - abc 1"); }));
    CHECK(throwsFen([] { parseFen(""); }));
    CHECK(throwsFen([] { parseLine("pas une fente du tout"); }));
}

int main()
{
    testParseDocExample();
    testEncodeDocExample();
    testEncodeStartPosition();
    testCastling();
    testLabels();
    testErrors();

    if (failures == 0)
        std::cout << "test_fen : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
