/*
** EPITECH PROJECT, 2026
** cli.h
** File description:
** command line parsing
*/

#ifndef CLI_H_
#define CLI_H_

#include <stdbool.h>

typedef enum {
    CRYPTO_XOR,
    CRYPTO_AES,
    CRYPTO_RSA,
    CRYPTO_PGP_XOR,
    CRYPTO_PGP_AES,
    CRYPTO_ELGAMAL
} crypto_system_t;

typedef enum {
    MODE_CIPHER,
    MODE_DECIPHER,
    MODE_GENERATE,
    MODE_NONE
} crypto_mode_t;

typedef struct {
    crypto_system_t crypto;
    crypto_mode_t mode;
    bool block_mode;
    const char *key;
    const char *prime_p;
    const char *prime_q;
} cli_options_t;

void parse_args(int argc, char **argv, cli_options_t *opts);

#endif /* !CLI_H_ */
