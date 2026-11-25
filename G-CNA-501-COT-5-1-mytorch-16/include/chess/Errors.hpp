/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Erreurs spécifiques au module d'échecs (FEN, labels).
** Dépend de : mytorch/Errors.hpp
*/

#pragma once

#include "mytorch/Errors.hpp"

namespace mytorch {
namespace chess {

// Position FEN mal formée ou étiquette de dataset invalide.
// Cette erreur appartient au module d'échecs : le cœur mytorch ne doit pas
// connaître le format FEN.
class FenError : public Error {
public:
    using Error::Error;
};

} // namespace chess
} // namespace mytorch
