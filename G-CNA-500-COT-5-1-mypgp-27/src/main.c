/*
** EPITECH PROJECT, 2026
** main.c
** File description:
** entry point
*/

#include "aes.h"
#include "cli.h"
#include "elgamal.h"
#include "error.h"
#include "pgp_aes.h"
#include "pgp_xor.h"
#include "rsa.h"
#include "usage.h"
#include "xor.h"

#include <string.h>

int main(int argc, char **argv)
{
    cli_options_t opts;
    int status = 0;

    if (argc > 1 && strcmp(argv[1], "-h") == 0) {
        print_usage();
        return 0;
    }
    parse_args(argc, argv, &opts);
    switch (opts.crypto) {
    case CRYPTO_XOR:
        status = run_xor(&opts);
        break;
    case CRYPTO_AES:
        status = run_aes(&opts);
        break;
    case CRYPTO_RSA:
        run_rsa(&opts);
        break;
    case CRYPTO_PGP_XOR:
        status = run_pgp_xor(&opts);
        break;
    case CRYPTO_PGP_AES:
        status = run_pgp_aes(&opts);
        break;
    case CRYPTO_ELGAMAL:
        run_elgamal(&opts);
        break;
    default:
        my_pgp_die("crypto system not implemented yet");
    }
    if (status != 0)
        my_pgp_die("the cryptographic computation failed");
    return 0;
}
