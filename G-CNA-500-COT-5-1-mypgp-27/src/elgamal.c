/*
** EPITECH PROJECT, 2026
** elgamal.c
** File description:
** ElGamal cryptosystem over Z/pZ (2nd asymmetric cryptosystem)
*/

#include "elgamal.h"
#include "my.h"
#include "bigint.h"
#include "buffer.h"
#include "error.h"
#include "hex.h"
#include "io.h"
#include "rsa.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define ELGAMAL_GENERATOR 2

static biguint_t parse_number(const char *hex)
{
    buffer_t bytes = hex_to_bytes(hex);
    biguint_t value = biguint_from_bytes_le(bytes.data, bytes.len);

    buffer_free(&bytes);
    return value;
}

static void print_pair(const char *label, const biguint_t *a,
    const biguint_t *b)
{
    char *a_hex = rsa_biguint_to_hex(a);
    char *b_hex = rsa_biguint_to_hex(b);

    my_put_pair(label, a_hex, b_hex);
    free(a_hex);
    free(b_hex);
}

/* P must leave room for 1 <= X <= P - 2, hence P > 3. */
static void check_modulus(const biguint_t *p)
{
    biguint_t three = biguint_from_u64(3);
    int cmp = biguint_cmp(p, &three);

    biguint_free(&three);
    if (cmp <= 0)
        my_pgp_die("elgamal: the prime P must be greater than 3");
}

static void run_elgamal_generate(const cli_options_t *opts)
{
    biguint_t p = parse_number(opts->prime_p);
    biguint_t x = parse_number(opts->prime_q);
    biguint_t g = biguint_from_u64(ELGAMAL_GENERATOR);
    biguint_t two = biguint_from_u64(2);
    biguint_t p_minus_2;
    biguint_t y;

    check_modulus(&p);
    p_minus_2 = biguint_sub(&p, &two);
    if (biguint_is_zero(&x) || biguint_cmp(&x, &p_minus_2) > 0)
        my_pgp_die("elgamal: the private key X must be in [1, P - 2]");
    y = biguint_powmod(&g, &x, &p);
    print_pair("public key: ", &y, &p);
    print_pair("private key: ", &x, &p);
    biguint_free(&p);
    biguint_free(&x);
    biguint_free(&g);
    biguint_free(&two);
    biguint_free(&p_minus_2);
    biguint_free(&y);
}

/*
** Ephemeral key K, uniform enough in [1, P - 2]: 8 extra random bytes
** make the bias of the final modulo negligible.
*/
static biguint_t random_ephemeral(const biguint_t *p)
{
    size_t len = biguint_bit_length(p) / 8 + 9;
    uint8_t *bytes = malloc(len);
    FILE *urandom = fopen("/dev/urandom", "rb");
    biguint_t two = biguint_from_u64(2);
    biguint_t one = biguint_from_u64(1);
    biguint_t range = biguint_sub(p, &two);
    biguint_t raw;
    biguint_t reduced;
    biguint_t k;

    if (bytes == NULL || urandom == NULL
        || fread(bytes, 1, len, urandom) != len)
        my_pgp_die("elgamal: cannot read random bytes from /dev/urandom");
    fclose(urandom);
    raw = biguint_from_bytes_le(bytes, len);
    reduced = biguint_mod(&raw, &range);
    k = biguint_add(&reduced, &one);
    free(bytes);
    biguint_free(&two);
    biguint_free(&one);
    biguint_free(&range);
    biguint_free(&raw);
    biguint_free(&reduced);
    return k;
}

static biguint_t mulmod(const biguint_t *a, const biguint_t *b,
    const biguint_t *mod)
{
    biguint_t prod = biguint_mul(a, b);
    biguint_t result = biguint_mod(&prod, mod);

    biguint_free(&prod);
    return result;
}

static void run_elgamal_cipher(const rsa_key_t *key)
{
    const biguint_t *y = &key->exponent;
    const biguint_t *p = &key->modulus;
    buffer_t line = io_read_line_buffer();
    biguint_t m = biguint_from_bytes_le(line.data, line.len);
    biguint_t g = biguint_from_u64(ELGAMAL_GENERATOR);
    biguint_t k;
    biguint_t c1;
    biguint_t s;
    biguint_t c2;

    buffer_free(&line);
    if (biguint_cmp(&m, p) >= 0)
        my_pgp_die("message too large for this key");
    k = random_ephemeral(p);
    c1 = biguint_powmod(&g, &k, p);
    s = biguint_powmod(y, &k, p);
    c2 = mulmod(&m, &s, p);
    print_pair("", &c1, &c2);
    biguint_free(&m);
    biguint_free(&g);
    biguint_free(&k);
    biguint_free(&c1);
    biguint_free(&s);
    biguint_free(&c2);
}

/*
** Both the keys ("Y-P", "X-P") and the ciphered pair ("C1-C2") are two
** numbers joined by a dash, the shape rsa_parse_key() already reads.
*/
static rsa_key_t parse_pair(const char *text, const char *what)
{
    const char *dash = strchr(text, '-');

    if (dash == NULL || dash == text || dash[1] == '\0'
        || strchr(dash + 1, '-') != NULL) {
        my_puterr("my_pgp: error: elgamal: malformed ");
        my_puterr(what);
        my_puterr("\n");
        exit(84);
    }
    return rsa_parse_key(text);
}

/* The ciphered pair "C1-C2" without the blanks around or inside it. */
static char *read_cipher_pair(void)
{
    buffer_t line = io_read_line_buffer();
    size_t write = 0;
    size_t read;

    for (read = 0; read < line.len; read++)
        if (!isspace(line.data[read]))
            line.data[write++] = line.data[read];
    line.len = write;
    buffer_push(&line, 0);
    return (char *)line.data;
}

/* M = C2 * C1^(P - 1 - X) mod P, since C1^(P - 1) = 1 (Fermat). */
static void run_elgamal_decipher(const rsa_key_t *key)
{
    char *text = read_cipher_pair();
    rsa_key_t pair = parse_pair(text, "ciphered pair, expected C1-C2");
    biguint_t one = biguint_from_u64(1);
    biguint_t p_minus_1 = biguint_sub(&key->modulus, &one);
    biguint_t exp;
    biguint_t s_inv;
    biguint_t m;
    uint8_t *bytes;
    size_t len;

    free(text);
    if (biguint_cmp(&key->exponent, &p_minus_1) >= 0
        || biguint_cmp(&pair.exponent, &key->modulus) >= 0
        || biguint_cmp(&pair.modulus, &key->modulus) >= 0)
        my_pgp_die("elgamal: ciphered pair or key out of range");
    exp = biguint_sub(&p_minus_1, &key->exponent);
    s_inv = biguint_powmod(&pair.exponent, &exp, &key->modulus);
    m = mulmod(&pair.modulus, &s_inv, &key->modulus);
    if (!biguint_is_zero(&m)) {
        bytes = biguint_to_bytes_le(&m, &len);
        my_putbytes(bytes, len);
        free(bytes);
    }
    my_putchar('\n');
    rsa_key_free(&pair);
    biguint_free(&one);
    biguint_free(&p_minus_1);
    biguint_free(&exp);
    biguint_free(&s_inv);
    biguint_free(&m);
}

void run_elgamal(const cli_options_t *opts)
{
    rsa_key_t key;

    if (opts->mode == MODE_GENERATE) {
        run_elgamal_generate(opts);
        return;
    }
    key = parse_pair(opts->key, "key, expected Y-P (-c) or X-P (-d)");
    check_modulus(&key.modulus);
    if (opts->mode == MODE_CIPHER)
        run_elgamal_cipher(&key);
    else
        run_elgamal_decipher(&key);
    rsa_key_free(&key);
}
