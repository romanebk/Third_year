/*
** EPITECH PROJECT, 2026
** my_torch
** File description:
** Gestion centralisée des erreurs du projet.
** Dépend de : -
*/

#pragma once

#include <stdexcept>
#include <string>

namespace mytorch {

// Code de sortie du programme en cas d'erreur (exigé par le sujet).
constexpr int kErrorExitCode = 84;

// Base de toutes les erreurs du projet. what() renvoie le message à écrire sur stderr.
class Error : public std::runtime_error {
public:
    explicit Error(const std::string &message) : std::runtime_error(message) {}
};

// Fichier introuvable, illisible ou impossible à écrire.
class FileError : public Error {
public:
    using Error::Error;
};

// Contenu invalide dans un fichier .nn ou .conf (magic, version, taille, valeur).
class FormatError : public Error {
public:
    using Error::Error;
};

// Arguments de la ligne de commande invalides.
class ArgumentError : public Error {
public:
    using Error::Error;
};

// Dimensions de matrices incompatibles pour une opération.
class DimensionError : public Error {
public:
    using Error::Error;
};

} // namespace mytorch
