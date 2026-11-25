#!/bin/bash
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Lance tous les tests (raccourci vers la cible make).
## Dépend de : Makefile
##

set -u

cd "$(dirname "$0")/.." || exit 84
exec make tests
