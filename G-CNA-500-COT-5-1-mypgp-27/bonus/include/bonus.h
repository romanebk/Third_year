/*
** EPITECH PROJECT, 2026
** bonus.h
** File description:
** bonus: random RSA primes and PKCS#7 padding
*/

#ifndef BONUS_H_
#define BONUS_H_

#include "bigint.h"
#include "buffer.h"
#include "cli.h"

#include <stdbool.h>
#include <stddef.h>

/*
** ------------------------------------------------ bonus 1: random primes
**
**     ./my_pgp rsa -g          key of 2048 bits from two random primes
**     ./my_pgp rsa -g BITS     key of BITS bits (decimal, 64 to 8192)
**
** Both forms are errors in the mandatory program (-g needs P and Q), so
** they never change the meaning of an existing command.
*/
#define RANDOM_KEY_DEFAULT_BITS 2048
#define RANDOM_KEY_MIN_BITS 64
#define RANDOM_KEY_MAX_BITS 8192

/* True when argv is `rsa -g` or `rsa -g BITS`. */
bool is_random_keygen(int argc, char **argv);

/*
** A random prime of exactly `bits` bits, its two top bits set (so that
** the product of two of them has exactly the sum of their sizes), with
** p - 1 not divisible by 65537 (so that e = 65537 always fits), and
** different from `avoid` when it is not NULL.
*/
biguint_t random_prime(size_t bits, const biguint_t *avoid);

/* Prints the key pair, then the two primes that produced it. */
int run_random_keygen(const char *bits_arg);

/*
** ----------------------------------------------- bonus 2: PKCS#7 padding
**
**     ./my_pgp xor -c -p KEY      ./my_pgp aes -c -p KEY   (and -d)
**
** Stream mode only. The last block is completed with N bytes of value N
** (1 <= N <= block size, a full block of padding when the message is
** already aligned), so the padding is removed exactly when deciphering.
** The block is 16 bytes for AES and the size of the key for XOR.
*/

/* Appends the padding; returns 0, or -1 if the block size is not 1-255. */
int pkcs7_pad(buffer_t *buf, size_t block);

/* Checks and removes the padding; returns 0, or -1 if it is invalid. */
int pkcs7_unpad(buffer_t *buf, size_t block);

/* `xor` / `aes` with -p: returns 0, errors end with 84. */
int run_padded(const cli_options_t *opts);

/* True when "-p" is one of the arguments. */
bool has_padding_flag(int argc, char **argv);

/* Removes "-p" from the arguments and runs the padded cipher. */
int run_with_padding(int argc, char **argv);

void print_bonus_usage(void);

#endif /* !BONUS_H_ */
