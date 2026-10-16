/*
** EPITECH PROJECT, 2026
** random_prime.c
** File description:
** bonus 1: RSA key pair generated from two random primes
*/

#include "bonus.h"
#include "error.h"
#include "my.h"
#include "rsa.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define FERMAT_E 65537

bool is_random_keygen(int argc, char **argv)
{
    size_t i;

    if (argc < 3 || argc > 4 || strcmp(argv[1], "rsa") != 0
        || strcmp(argv[2], "-g") != 0)
        return false;
    if (argc == 3)
        return true;
    if (argv[3][0] == '\0')
        return false;
    for (i = 0; argv[3][i] != '\0'; i++)
        if (argv[3][i] < '0' || argv[3][i] > '9')
            return false;
    return true;
}

/* Fills `buf` with bytes from the random generator of the kernel. */
static void read_random(uint8_t *buf, size_t len)
{
    FILE *urandom = fopen("/dev/urandom", "rb");
    size_t got = 0;

    if (urandom != NULL) {
        got = fread(buf, 1, len, urandom);
        fclose(urandom);
    }
    if (got != len) {
        free(buf);
        my_pgp_die("bonus: cannot read random bytes from /dev/urandom");
    }
}

/*
** A random odd number of exactly `bits` bits whose two top bits are set:
** a starting point for the search of a prime.
*/
static biguint_t random_candidate(size_t bits)
{
    size_t len = (bits + 7) / 8;
    uint8_t *bytes = malloc(len);
    size_t top = (bits - 1) % 8;
    biguint_t value;

    if (bytes == NULL)
        my_pgp_die("out of memory");
    read_random(bytes, len);
    bytes[len - 1] &= (uint8_t)((1u << (top + 1)) - 1);
    bytes[len - 1] |= (uint8_t)(1u << top);
    if (top > 0)
        bytes[len - 1] |= (uint8_t)(1u << (top - 1));
    else
        bytes[len - 2] |= 0x80;
    bytes[0] |= 1;
    value = biguint_from_bytes_le(bytes, len);
    free(bytes);
    return value;
}

/* p - 1 must not be a multiple of 65537, so that e = 65537 is valid. */
static bool fits_fermat_e(const biguint_t *p)
{
    biguint_t e = biguint_from_u64(FERMAT_E);
    biguint_t rem = biguint_mod(p, &e);
    bool fits = !(rem.n == 1 && rem.limbs[0] == 1);

    biguint_free(&e);
    biguint_free(&rem);
    return fits;
}

/* Remainder of a big number by a small one, limb by limb, no allocation. */
static uint32_t small_rem(const biguint_t *value, uint32_t divisor)
{
    uint64_t rem = 0;
    size_t i;

    for (i = value->n; i-- > 0;)
        rem = ((rem << 32) | value->limbs[i]) % divisor;
    return (uint32_t)rem;
}

/*
** Sieve: about 85 % of the candidates have a prime factor below 2000.
** Dividing by those few hundred small primes is far cheaper than one
** round of Miller-Rabin, which is kept for the survivors only.
*/
static bool has_small_factor(const biguint_t *c)
{
    static const uint32_t limit = 2000;
    uint32_t p;
    uint32_t d;
    bool prime;

    for (p = 3; p < limit; p += 2) {
        prime = true;
        for (d = 3; d * d <= p && prime; d += 2)
            prime = p % d != 0;
        if (prime && small_rem(c, p) == 0)
            return true;
    }
    return false;
}

static bool is_good_prime(const biguint_t *c, size_t bits,
    const biguint_t *avoid)
{
    if (biguint_bit_length(c) != bits)
        return false;
    if (avoid != NULL && biguint_cmp(c, avoid) == 0)
        return false;
    if (has_small_factor(c))
        return false;
    return fits_fermat_e(c) && biguint_is_probably_prime(c);
}

/*
** Starts from a random odd number and walks the odd numbers upwards until
** a prime is found (Miller-Rabin of bigint.c). Walking off the requested
** size, which is very unlikely, simply restarts from a new random number.
*/
biguint_t random_prime(size_t bits, const biguint_t *avoid)
{
    biguint_t two = biguint_from_u64(2);
    biguint_t candidate = random_candidate(bits);
    biguint_t next;

    while (!is_good_prime(&candidate, bits, avoid)) {
        if (biguint_bit_length(&candidate) > bits) {
            biguint_free(&candidate);
            candidate = random_candidate(bits);
            continue;
        }
        next = biguint_add(&candidate, &two);
        biguint_free(&candidate);
        candidate = next;
    }
    biguint_free(&two);
    return candidate;
}

static size_t parse_bits(const char *arg)
{
    unsigned long bits;

    if (arg == NULL)
        return RANDOM_KEY_DEFAULT_BITS;
    if (strlen(arg) > 5)
        my_pgp_die("bonus: the key size must be from 64 to 8192 bits");
    bits = strtoul(arg, NULL, 10);
    if (bits < RANDOM_KEY_MIN_BITS || bits > RANDOM_KEY_MAX_BITS)
        my_pgp_die("bonus: the key size must be from 64 to 8192 bits");
    return (size_t)bits;
}

static void print_prime(const char *label, const biguint_t *value)
{
    char *hex = rsa_biguint_to_hex(value);

    my_putstr(label);
    my_putline(hex);
    free(hex);
}

/*
** Same computation as `rsa -g P Q` once the primes are drawn, so the
** printed primes can be given back to the mandatory -g to check that the
** very same keys come out.
*/
static void print_keys(const biguint_t *p, const biguint_t *q)
{
    biguint_t lambda = rsa_carmichael_lambda(p, q);
    biguint_t e = rsa_pick_e(&lambda);
    biguint_t d = rsa_compute_d(&e, &lambda);
    biguint_t n = biguint_mul(p, q);
    char *e_hex = rsa_biguint_to_hex(&e);
    char *d_hex = rsa_biguint_to_hex(&d);
    char *n_hex = rsa_biguint_to_hex(&n);

    my_put_pair("public key: ", e_hex, n_hex);
    my_put_pair("private key: ", d_hex, n_hex);
    free(e_hex);
    free(d_hex);
    free(n_hex);
    biguint_free(&lambda);
    biguint_free(&e);
    biguint_free(&d);
    biguint_free(&n);
}

int run_random_keygen(const char *bits_arg)
{
    size_t bits = parse_bits(bits_arg);
    biguint_t p = random_prime((bits + 1) / 2, NULL);
    biguint_t q = random_prime(bits / 2, &p);

    print_keys(&p, &q);
    print_prime("prime P: ", &p);
    print_prime("prime Q: ", &q);
    biguint_free(&p);
    biguint_free(&q);
    return 0;
}
