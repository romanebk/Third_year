/*
** EPITECH PROJECT, 2026
** usage.c
** File description:
** usage text
*/

#include "usage.h"
#include "my.h"

#include <stdio.h>

void print_usage(void)
{
    my_putstr(
        "USAGE\n"
        "\t./my_pgp CRYPTO_SYSTEM MODE [OPTIONS] [key]\n"
        "\n"
        "DESCRIPTION\n"
        "Cipher or decipher MESSAGE using a given CRYPTO_SYSTEM. "
        "The MESSAGE is read from the standard input.\n"
        "\n"
        "   CRYPTO_SYSTEM\n"
        "\t\"xor\"\t\tcomputation using XOR algorithm\n"
        "\t\"aes\"\t\tcomputation using AES algorithm\n"
        "\t\"rsa\"\t\tcomputation using RSA algorithm\n"
        "\t\"pgp-xor\"\tcomputation using both RSA and XOR algorithm\n"
        "\t\"pgp-aes\"\tcomputation using both RSA and AES algorithm\n"
        "\n"
        "   MODE\n"
        "\t-c\t\tMESSAGE is clear and we want to cipher it\n"
        "\t-d\t\tMESSAGE is ciphered and we want to decipher it\n"
        "\t-g P Q\t\tRSA only: don't read a MESSAGE, but instead generate "
        "a public and private key\n"
        "\tpair from the prime number P and Q\n"
        "\n"
        "   OPTIONS\n"
        "\t-b\t\tfor XOR, AES and PGP, only works on one block. The "
        "MESSAGE and the symmetric\n"
        "\tkey must be the same size\n"
        "\n"
        "   key\t\t\tKey used to cipher/decipher MESSAGE "
        "(incompatible with -g MODE)\n"
        "\n"
        "   ELGAMAL (second asymmetric cryptosystem)\n"
        "\t\"elgamal\"\tcomputation using ElGamal algorithm (generator 2)\n"
        "\t-g P X\t\tgenerate a key pair from the prime number P and the "
        "private key X\n"
        "\t-c Y-P\t\tcipher MESSAGE with the public key Y-P\n"
        "\t-d X-P\t\tdecipher a C1-C2 pair with the private key X-P\n"
        "\n"
        "NOTES\n"
        "\tNumbers and keys are hexadecimal, little endian (lowest byte "
        "first).\n"
        "\tMODE, OPTIONS and key may be given in any order after "
        "CRYPTO_SYSTEM.\n"
        "\tpgp-xor and pgp-aes keys: SYMMETRIC_KEY:RSA_KEY, RSA keys: "
        "EXPONENT-MODULUS.\n"
        "\tOn error, a message is written on stderr and the program "
        "exits with 84.\n"
    );
}
