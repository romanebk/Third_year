/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Tests des symétries de l'échiquier (augmentation de données).
** Dépend de : chess/Augment.hpp
*/

#include <cstdlib>
#include <iostream>
#include <random>
#include <string>
#include <vector>

#include "chess/Augment.hpp"
#include "chess/Fen.hpp"

using namespace mytorch::chess;

static int failures = 0;

#define CHECK(cond)                                                       \
    do {                                                                  \
        if (!(cond)) {                                                    \
            std::cerr << "FAIL ligne " << __LINE__ << " : " #cond "\n";   \
            failures++;                                                   \
        }                                                                 \
    } while (0)

// Le miroir gauche-droite d'une position connue, écrit à la main.
static void testMirror()
{
    const std::string fen = "4rk2/1R3R1p/rp3b2/8/5P2/4P3/5PKP/8 b - - 0 36";
    const std::string mirror = "2kr4/p1R3R1/2b3pr/8/2P5/3P4/PKP5/8 b - - 0 36";
    std::vector<float> encoded = encodeString(fen);
    mirrorHorizontally(encoded.data());
    CHECK(encoded == encodeString(mirror));

    // Deux miroirs ramènent à la position de départ.
    mirrorHorizontally(encoded.data());
    CHECK(encoded == encodeString(fen));
}

// L'inversion des couleurs d'une position connue, écrite à la main : les couleurs
// sont échangées, le trait est inversé ET l'échiquier est retourné verticalement
// (la rangée 8 devient la rangée 1), sans quoi les pions attaqueraient à l'envers.
static void testColorSwap()
{
    const std::string fen = "4rk2/1R3R1p/rp3b2/8/5P2/4P3/5PKP/8 b - - 0 36";
    const std::string swapped = "8/5pkp/4p3/5p2/8/RP3B2/1r3r1P/4RK2 w - - 0 36";
    std::vector<float> encoded = encodeString(fen);
    swapColors(encoded.data());
    CHECK(encoded == encodeString(swapped));

    // C'est une involution : deux inversions ramènent à la position de départ.
    swapColors(encoded.data());
    CHECK(encoded == encodeString(fen));
}

// Un échec donné par un PION reste un échec après la symétrie : c'est le cas que
// l'ancienne version (couleurs échangées sans retourner l'échiquier) cassait.
static void testPawnCheckSurvives()
{
    // Pion blanc e5 contre roi noir d6, aux noirs de jouer : échec.
    const std::string whitePawnCheck = "8/8/3k4/4P3/8/8/8/4K3 b - - 0 1";
    // Image exacte : pion noir e4 contre roi blanc d3, aux blancs de jouer : échec
    // (un pion noir attaque vers le bas, donc d3 et f3).
    const std::string blackPawnCheck = "4k3/8/8/8/4p3/3K4/8/8 w - - 0 1";

    std::vector<float> encoded = encodeString(whitePawnCheck);
    swapColors(encoded.data());
    CHECK(encoded == encodeString(blackPawnCheck));

    // Et dans l'autre sens.
    std::vector<float> back = encodeString(blackPawnCheck);
    swapColors(back.data());
    CHECK(back == encodeString(whitePawnCheck));

    // Les deux symétries composées (miroir puis inversion des couleurs) : pion noir d4
    // contre roi blanc e3.
    std::vector<float> both = encodeString(whitePawnCheck);
    applySymmetry(both.data(), Symmetry::MirrorColorSwap);
    CHECK(both == encodeString("3k4/8/8/8/3p4/4K3/8/8 w - - 0 1"));
}

// Les droits de roque suivent la symétrie.
static void testCastlingRights()
{
    std::vector<float> encoded = encodeString("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    mirrorHorizontally(encoded.data());
    CHECK(encoded == encodeString("r2k3r/8/8/8/8/8/8/R2K3R w KQkq - 0 1"));

    std::vector<float> onlyKingside = encodeString("r3k2r/8/8/8/8/8/8/R3K2R w Kk - 0 1");
    mirrorHorizontally(onlyKingside.data());
    CHECK(onlyKingside == encodeString("r2k3r/8/8/8/8/8/8/R2K3R w Qq - 0 1"));

    // Position de départ des tours et des rois : l'échiquier retourné et aux couleurs
    // inversées est identique, seul le trait change.
    std::vector<float> colors = encodeString("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    swapColors(colors.data());
    CHECK(colors == encodeString("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1"));

    // Droits partiels : K (blanc, petit roque) et q (noir, grand roque) deviennent k et Q.
    std::vector<float> partial = encodeString("r3k2r/8/8/8/8/8/8/R3K2R w Kq - 0 1");
    swapColors(partial.data());
    CHECK(partial == encodeString("r3k2r/8/8/8/8/8/8/R3K2R b Qk - 0 1"));
}

// Les quatre symétries préservent la structure de l'encodage : 32 pièces,
// un seul 1 par case occupée, et les champs trait/roque restent binaires.
static void testStructure()
{
    const std::string fen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 5";
    std::vector<float> reference = encodeString(fen);
    for (int i = 0; i < 4; i++) {
        std::vector<float> encoded = reference;
        applySymmetry(encoded.data(), static_cast<Symmetry>(i));
        CHECK(encoded.size() == kFenEncodedSize);
        std::size_t pieces = 0;
        for (std::size_t square = 0; square < kBoardSquares; square++) {
            std::size_t occupied = 0;
            for (std::size_t piece = 0; piece < kPieceTypes; piece++)
                if (encoded[square * kPieceTypes + piece] == 1.0f)
                    occupied++;
            CHECK(occupied <= 1);
            pieces += occupied;
        }
        CHECK(pieces == 32);
        float side = encoded[kBoardSquares * kPieceTypes];
        CHECK(side == 0.0f || side == 1.0f);
        for (std::size_t i = kBoardSquares * kPieceTypes + 1; i < kFenEncodedSize; i++)
            CHECK(encoded[i] == 0.0f || encoded[i] == 1.0f);
    }
}

// Une position et ses symétries ont la même classe en mode basic ; en mode full
// l'inversion des couleurs échange les classes qui nomment une couleur.
static void testLabels()
{
    CHECK(flipsColors(Symmetry::Identity) == false);
    CHECK(flipsColors(Symmetry::Mirror) == false);
    CHECK(flipsColors(Symmetry::ColorSwap) == true);
    CHECK(flipsColors(Symmetry::MirrorColorSwap) == true);

    // mode basic : rien ne bouge, la couleur n'est pas une classe
    float basic[3] = {0.0f, 1.0f, 0.0f};
    swapTargetColors(basic, 0, 3, LabelMode::Basic);
    CHECK(basic[1] == 1.0f && basic[2] == 0.0f);

    // mode full : Check White (1) <-> Check Black (2)
    float full[5] = {0.0f, 1.0f, 0.0f, 0.0f, 0.0f};
    swapTargetColors(full, 0, 5, LabelMode::Full);
    CHECK(full[1] == 0.0f && full[2] == 1.0f);

    // mode full : Checkmate White (3) <-> Checkmate Black (4)
    float mate[5] = {0.0f, 0.0f, 0.0f, 0.0f, 1.0f};
    swapTargetColors(mate, 0, 5, LabelMode::Full);
    CHECK(mate[3] == 1.0f && mate[4] == 0.0f);

    // Nothing n'est jamais concerné
    float nothing[5] = {1.0f, 0.0f, 0.0f, 0.0f, 0.0f};
    swapTargetColors(nothing, 0, 5, LabelMode::Full);
    CHECK(nothing[0] == 1.0f);
}

// Le tirage couvre les quatre symétries et reste reproductible à graine égale.
static void testRandom()
{
    std::mt19937 genA(42);
    std::mt19937 genB(42);
    bool seen[4] = {false, false, false, false};
    for (int i = 0; i < 200; i++) {
        Symmetry a = randomSymmetry(genA);
        Symmetry b = randomSymmetry(genB);
        CHECK(a == b);
        CHECK(static_cast<int>(a) >= 0 && static_cast<int>(a) <= 3);
        seen[static_cast<int>(a)] = true;
    }
    for (bool value : seen)
        CHECK(value);
}

int main()
{
    testMirror();
    testColorSwap();
    testPawnCheckSurvives();
    testCastlingRights();
    testStructure();
    testLabels();
    testRandom();

    if (failures == 0)
        std::cout << "test_augment : tous les tests passent\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
