/*
** EPITECH PROJECT, 2026
** error.c
** File description:
** error handling
*/

#include "error.h"
#include "my.h"

#include <stdio.h>
#include <stdlib.h>

void my_pgp_die(const char *message)
{
    my_puterr("my_pgp: error: ");
    my_puterr(message);
    my_puterr("\n");
    exit(84);
}
