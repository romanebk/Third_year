#!/usr/bin/env python3
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Audit de l'augmentation par inversion des couleurs : l'étiquette est-elle conservée ?
## Dépend de : dataset/ (fichier FEN + étiquette)
##
## Usage : ./scripts/audit_augmentation.py FICHIER_DE_POSITIONS
##
## Le script contient son propre détecteur d'échec (aucun code du projet). Il est
## d'abord validé contre les étiquettes du dataset, puis il mesure ce que deviennent
## les étiquettes après deux transformations :
##   A. l'ANCIENNE inversion des couleurs de src/chess/Augment.cpp (avant le 27/10/2026) :
##      couleurs échangées et trait inversé, SANS retourner l'échiquier ;
##   B. l'inversion actuelle de Augment.cpp, la symétrie exacte : couleurs échangées,
##      trait inversé ET échiquier retourné verticalement (rangée 8 <-> rangée 1).
## Les deux transformations sont réécrites dans ce script : il ne teste pas le code C++
## lui-même (cela, c'est le rôle de tests/test_augment.cpp).
## Un pion attaque vers le haut s'il est blanc et vers le bas s'il est noir : sans
## retournement, un échec donné par un pion cesse d'être un échec.
##

import sys

KNIGHT = [(-2, -1), (-2, 1), (-1, -2), (-1, 2), (1, -2), (1, 2), (2, -1), (2, 1)]
KING = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
DIAGONALS = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
STRAIGHTS = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def parse_board(board_field):
    """Plateau 8 x 8 (rangée 8 en premier) à partir du champ « pièces » d'une FEN."""
    rows = []
    for rank in board_field.split("/"):
        row = []
        for symbol in rank:
            if symbol.isdigit():
                row.extend(["."] * int(symbol))
            else:
                row.append(symbol)
        rows.append(row)
    return rows


def attackers(rows, white_king):
    """Types des pièces adverses qui attaquent le roi du camp demandé (True = blanc).

    Renvoie None si ce roi est absent du plateau.
    """
    king = "K" if white_king else "k"
    found_at = None
    for r in range(8):
        for c in range(8):
            if rows[r][c] == king:
                found_at = (r, c)
    if found_at is None:
        return None
    kr, kc = found_at
    is_enemy = (lambda p: p.islower()) if white_king else (lambda p: p.isupper())
    found = []

    def at(r, c):
        return rows[r][c] if 0 <= r < 8 and 0 <= c < 8 else None

    # Un pion noir attaque vers le bas (rangée + 1), un pion blanc vers le haut.
    pawn = "p" if white_king else "P"
    pawn_row = kr - 1 if white_king else kr + 1
    for dc in (-1, 1):
        if at(pawn_row, kc + dc) == pawn:
            found.append("pawn")
    knight = "n" if white_king else "N"
    for dr, dc in KNIGHT:
        if at(kr + dr, kc + dc) == knight:
            found.append("knight")
    other_king = "k" if white_king else "K"
    for dr, dc in KING:
        if at(kr + dr, kc + dc) == other_king:
            found.append("king")
    for directions, kinds in ((DIAGONALS, "bq"), (STRAIGHTS, "rq")):
        for dr, dc in directions:
            r, c = kr + dr, kc + dc
            while 0 <= r < 8 and 0 <= c < 8:
                piece = rows[r][c]
                if piece != ".":
                    if is_enemy(piece) and piece.lower() in kinds:
                        found.append("slider")
                    break
                r += dr
                c += dc
    return found


def transform(rows, flip_ranks):
    """Échange les couleurs ; retourne aussi l'échiquier verticalement si demandé."""
    swapped = []
    for row in rows:
        swapped.append([(p.lower() if p.isupper() else p.upper()) if p != "." else "." for p in row])
    if flip_ranks:
        swapped.reverse()
    return swapped


def percent(part, whole):
    return 100.0 * part / whole if whole else 0.0


def audit(path):
    checks = 0          # positions étiquetées Check / Checkmate
    nothings = 0        # positions étiquetées Nothing
    checks_attacked = 0
    nothings_attacked = 0
    pawn_checks = 0
    kept = {"A": 0, "B": 0}
    pawn_kept = {"A": 0, "B": 0}
    nothing_to_check = {"A": 0, "B": 0}
    total = 0

    with open(path) as handle:
        for line in handle:
            parts = line.split()
            if len(parts) < 7:
                continue
            board, side, label = parts[0], parts[1], parts[6]
            total += 1
            rows = parse_board(board)
            white_to_move = side == "w"
            before = attackers(rows, white_to_move)
            if before is None:
                continue
            is_check = label in ("Check", "Checkmate")
            if is_check:
                checks += 1
                checks_attacked += 1 if before else 0
                if "pawn" in before:
                    pawn_checks += 1
            else:
                nothings += 1
                nothings_attacked += 1 if before else 0
            for name, flip in (("A", False), ("B", True)):
                after = attackers(transform(rows, flip), not white_to_move)
                if after is None:
                    continue
                if is_check and after:
                    kept[name] += 1
                    if "pawn" in before:
                        pawn_kept[name] += 1
                elif not is_check and after:
                    nothing_to_check[name] += 1

    print("positions lues : %d (Check/Checkmate : %d, Nothing : %d)" % (total, checks, nothings))
    print("-- validation du détecteur contre les étiquettes --")
    print("  Check/Checkmate dont le roi du trait est attaqué : %.2f %%" % percent(checks_attacked, checks))
    print("  Nothing dont le roi du trait est attaqué         : %.2f %%" % percent(nothings_attacked, nothings))
    print("-- échecs et mats auxquels un PION participe : %.2f %% (%d positions)"
          % (percent(pawn_checks, checks), pawn_checks))
    titles = {
        "A": "A. ancienne version : couleurs échangées SANS retourner l'échiquier",
        "B": "B. version actuelle : couleurs échangées ET échiquier retourné (symétrie exacte)",
    }
    for name in ("A", "B"):
        print("-- %s --" % titles[name])
        print("  Check/Checkmate qui restent un échec            : %.2f %%" % percent(kept[name], checks))
        print("  dont les échecs avec un pion                    : %.2f %%" % percent(pawn_kept[name], pawn_checks))
        print("  Nothing qui deviennent un échec (étiquette fausse) : %.2f %%"
              % percent(nothing_to_check[name], nothings))
    return 0


def main(argv):
    if len(argv) != 2:
        print("USAGE: ./scripts/audit_augmentation.py FICHIER_DE_POSITIONS", file=sys.stderr)
        return 84
    try:
        return audit(argv[1])
    except OSError as error:
        print("Error: %s" % error, file=sys.stderr)
        return 84


if __name__ == "__main__":
    sys.exit(main(sys.argv))
