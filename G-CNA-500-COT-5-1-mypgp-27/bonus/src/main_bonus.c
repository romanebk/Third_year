/*
** EPITECH PROJECT, 2026
** main_bonus.c
** File description:
** entry point of the bonus binary: the mandatory program plus the bonus
*/

#include "aes.h"
#include "bonus.h"
#include "cli.h"
#include "elgamal.h"
#include "error.h"
#include "my.h"
#include "pgp_aes.h"
#include "pgp_xor.h"
#include "rsa.h"
#include "usage.h"
#include "xor.h"

#include <string.h>

void print_bonus_usage(void)
{
    my_putstr(
        "\n"
        "BONUS\n"
        "\trsa -g [BITS]\tgenerate a key pair of BITS bits (64 to 8192, "
        "default 2048)\n"
        "\t\t\tfrom two random primes, printed after the keys\n"
        "\t-p\t\txor and aes, stream mode only: PKCS#7 padding instead "
        "of zeros\n");
}

/* Same dispatch as the mandatory main (src/main.c). */
static int run_mandatory(int argc, char **argv)
{
    cli_options_t opts;
    int status = 0;

    parse_args(argc, argv, &opts);
    if (opts.crypto == CRYPTO_XOR)
        status = run_xor(&opts);
    if (opts.crypto == CRYPTO_AES)
        status = run_aes(&opts);
    if (opts.crypto == CRYPTO_RSA)
        run_rsa(&opts);
    if (opts.crypto == CRYPTO_PGP_XOR)
        status = run_pgp_xor(&opts);
    if (opts.crypto == CRYPTO_PGP_AES)
        status = run_pgp_aes(&opts);
    if (opts.crypto == CRYPTO_ELGAMAL)
        run_elgamal(&opts);
    if (status != 0)
        my_pgp_die("the cryptographic computation failed");
    return 0;
}

/*
** The bonus only takes commands that the mandatory program refuses
** (`rsa -g` without P and Q, the unknown option -p): every command of the
** subject keeps exactly the same output and the same return code.
*/
int main(int argc, char **argv)
{
    if (argc > 1 && strcmp(argv[1], "-h") == 0) {
        print_usage();
        print_bonus_usage();
        return 0;
    }
    if (is_random_keygen(argc, argv))
        return run_random_keygen(argc == 4 ? argv[3] : NULL);
    if (has_padding_flag(argc, argv))
        return run_with_padding(argc, argv);
    return run_mandatory(argc, argv);
}
