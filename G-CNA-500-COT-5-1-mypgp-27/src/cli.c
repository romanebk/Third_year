/*
** EPITECH PROJECT, 2026
** cli.c
** File description:
** command line parsing
*/

#include "cli.h"
#include "error.h"

#include <string.h>

static crypto_system_t parse_crypto_system(const char *arg)
{
    if (strcmp(arg, "xor") == 0)
        return CRYPTO_XOR;
    if (strcmp(arg, "aes") == 0)
        return CRYPTO_AES;
    if (strcmp(arg, "rsa") == 0)
        return CRYPTO_RSA;
    if (strcmp(arg, "pgp-xor") == 0)
        return CRYPTO_PGP_XOR;
    if (strcmp(arg, "pgp-aes") == 0)
        return CRYPTO_PGP_AES;
    if (strcmp(arg, "elgamal") == 0)
        return CRYPTO_ELGAMAL;
    my_pgp_die("unknown CRYPTO_SYSTEM (expected xor, aes, rsa, pgp-xor, "
        "pgp-aes or elgamal)");
}

static void set_mode(cli_options_t *opts, crypto_mode_t mode)
{
    if (opts->mode != MODE_NONE)
        my_pgp_die("only one MODE is allowed (-c, -d or -g P Q)");
    opts->mode = mode;
}

static void set_key(cli_options_t *opts, const char *arg)
{
    if (arg[0] == '-' && arg[1] != '\0')
        my_pgp_die("unknown MODE or OPTION (expected -c, -d, -g P Q or -b)");
    if (opts->key != NULL)
        my_pgp_die("unexpected argument");
    opts->key = arg;
}

/*
** Handles the argument at index i and returns the index of the next one:
** -g consumes its two primes, everything else consumes one argument.
*/
static int parse_one(int argc, char **argv, int i, cli_options_t *opts)
{
    if (strcmp(argv[i], "-c") == 0) {
        set_mode(opts, MODE_CIPHER);
    } else if (strcmp(argv[i], "-d") == 0) {
        set_mode(opts, MODE_DECIPHER);
    } else if (strcmp(argv[i], "-g") == 0) {
        if (opts->crypto != CRYPTO_RSA && opts->crypto != CRYPTO_ELGAMAL)
            my_pgp_die("-g MODE is only valid for rsa and elgamal");
        if (i + 2 >= argc)
            my_pgp_die("-g requires two numbers: -g P Q (rsa), -g P X "
                "(elgamal)");
        set_mode(opts, MODE_GENERATE);
        opts->prime_p = argv[i + 1];
        opts->prime_q = argv[i + 2];
        return i + 3;
    } else if (strcmp(argv[i], "-b") == 0) {
        opts->block_mode = true;
    } else {
        set_key(opts, argv[i]);
    }
    return i + 1;
}

/*
** MODE, OPTIONS and key may come in any order after the CRYPTO_SYSTEM:
** `xor -b -c KEY` and `xor -c KEY -b` mean the same as `xor -c -b KEY`.
*/
void parse_args(int argc, char **argv, cli_options_t *opts)
{
    int i = 2;

    if (argc < 3)
        my_pgp_die(
            "missing arguments, expected: CRYPTO_SYSTEM MODE [OPTIONS] [key]");
    opts->mode = MODE_NONE;
    opts->block_mode = false;
    opts->key = NULL;
    opts->prime_p = NULL;
    opts->prime_q = NULL;
    opts->crypto = parse_crypto_system(argv[1]);
    while (i < argc)
        i = parse_one(argc, argv, i, opts);
    if (opts->mode == MODE_NONE)
        my_pgp_die("missing MODE (expected -c, -d or -g P Q)");
    if (opts->mode == MODE_GENERATE && opts->key != NULL)
        my_pgp_die("a key is incompatible with -g MODE");
    if (opts->mode != MODE_GENERATE && opts->key == NULL)
        my_pgp_die("missing key (incompatible with -g MODE only)");
}
