/*
** EPITECH PROJECT, 2026
** rsa.c
** File description:
** RSA cryptosystem (-g, -c, -d)
*/

#include "rsa.h"
#include "my.h"
#include "error.h"
#include "hex.h"
#include "io.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const uint64_t FERMAT_PRIMES[] = { 3, 5, 17, 257, 65537 };
#define FERMAT_COUNT (sizeof(FERMAT_PRIMES) / sizeof(FERMAT_PRIMES[0]))

biguint_t rsa_carmichael_lambda(const biguint_t *p, const biguint_t *q)
{
    biguint_t one = biguint_from_u64(1);
    biguint_t p1 = biguint_sub(p, &one);
    biguint_t q1 = biguint_sub(q, &one);
    biguint_t g = biguint_gcd(&p1, &q1);
    biguint_t prod = biguint_mul(&p1, &q1);
    biguint_t lambda = biguint_div(&prod, &g);

    biguint_free(&one);
    biguint_free(&p1);
    biguint_free(&q1);
    biguint_free(&g);
    biguint_free(&prod);
    return lambda;
}

biguint_t rsa_pick_e(const biguint_t *lambda)
{
    biguint_t one = biguint_from_u64(1);
    biguint_t candidate;
    biguint_t g;
    size_t i;

    for (i = FERMAT_COUNT; i-- > 0;) {
        candidate = biguint_from_u64(FERMAT_PRIMES[i]);
        if (biguint_cmp(&candidate, lambda) < 0) {
            g = biguint_gcd(&candidate, lambda);
            if (biguint_cmp(&g, &one) == 0) {
                biguint_free(&g);
                biguint_free(&one);
                return candidate;
            }
            biguint_free(&g);
        }
        biguint_free(&candidate);
    }
    biguint_free(&one);
    my_pgp_die("no Fermat prime is coprime with lambda(n) for these primes");
}

biguint_t rsa_compute_d(const biguint_t *e, const biguint_t *lambda)
{
    biguint_t d;

    if (!biguint_modinv(e, lambda, &d))
        my_pgp_die("failed to compute the RSA private exponent");
    return d;
}

static char *dup_substring(const char *start, size_t len)
{
    char *out = malloc(len + 1);

    if (out == NULL)
        my_pgp_die("out of memory");
    memcpy(out, start, len);
    out[len] = '\0';
    return out;
}

rsa_key_t rsa_parse_key(const char *key)
{
    const char *dash = strchr(key, '-');
    rsa_key_t result;
    char *exp_str;
    buffer_t exp_bytes;
    buffer_t mod_bytes;

    if (dash == NULL)
        my_pgp_die("malformed RSA key, expected EXPONENT-MODULUS");
    exp_str = dup_substring(key, (size_t)(dash - key));
    exp_bytes = hex_to_bytes(exp_str);
    mod_bytes = hex_to_bytes(dash + 1);
    result.exponent = biguint_from_bytes_le(exp_bytes.data, exp_bytes.len);
    result.modulus = biguint_from_bytes_le(mod_bytes.data, mod_bytes.len);
    buffer_free(&exp_bytes);
    buffer_free(&mod_bytes);
    free(exp_str);
    return result;
}

void rsa_key_free(rsa_key_t *key)
{
    biguint_free(&key->exponent);
    biguint_free(&key->modulus);
}

char *rsa_biguint_to_hex(const biguint_t *value)
{
    size_t len;
    uint8_t *bytes = biguint_to_bytes_le(value, &len);
    char *hex = bytes_to_hex(bytes, len);

    free(bytes);
    return hex;
}

/*
** The primes are not tested (subject, p.6), but 0 and 1 would make
** P - 1 or the gcd of the formula meaningless (an abort, not an error):
** they are refused like any other invalid argument.
*/
static void rsa_check_numbers(biguint_t *p, biguint_t *q)
{
    biguint_t two = biguint_from_u64(2);
    bool valid = biguint_cmp(p, &two) >= 0 && biguint_cmp(q, &two) >= 0;

    biguint_free(&two);
    if (!valid) {
        biguint_free(p);
        biguint_free(q);
        my_pgp_die("rsa: P and Q must be prime numbers (at least 2)");
    }
}

static void run_rsa_generate(const cli_options_t *opts)
{
    buffer_t p_bytes = hex_to_bytes(opts->prime_p);
    buffer_t q_bytes = hex_to_bytes(opts->prime_q);
    biguint_t p = biguint_from_bytes_le(p_bytes.data, p_bytes.len);
    biguint_t q = biguint_from_bytes_le(q_bytes.data, q_bytes.len);
    biguint_t lambda;
    biguint_t e;
    biguint_t d;
    biguint_t n;
    char *e_hex;
    char *d_hex;
    char *n_hex;

    buffer_free(&p_bytes);
    buffer_free(&q_bytes);
    rsa_check_numbers(&p, &q);
    lambda = rsa_carmichael_lambda(&p, &q);
    e = rsa_pick_e(&lambda);
    d = rsa_compute_d(&e, &lambda);
    n = biguint_mul(&p, &q);
    e_hex = rsa_biguint_to_hex(&e);
    d_hex = rsa_biguint_to_hex(&d);
    n_hex = rsa_biguint_to_hex(&n);

    my_put_pair("public key: ", e_hex, n_hex);
    my_put_pair("private key: ", d_hex, n_hex);
    free(e_hex);
    free(d_hex);
    free(n_hex);
    biguint_free(&p);
    biguint_free(&q);
    biguint_free(&lambda);
    biguint_free(&e);
    biguint_free(&d);
    biguint_free(&n);
}

/*
** The ciphered number may come from a file edited by hand: blanks and a
** CR before the line feed are not part of the number, so they are
** dropped before decoding.
*/
static void strip_blanks(buffer_t *buf)
{
    size_t read;
    size_t write = 0;

    for (read = 0; read < buf->len; read++)
        if (!isspace(buf->data[read]))
            buf->data[write++] = buf->data[read];
    buf->len = write;
}

/*
** Ciphering reads raw bytes (embedded NUL bytes included, hence the
** buffer rather than a C string), deciphering reads a hexadecimal number.
*/
static biguint_t message_to_biguint(bool cipher_mode, buffer_t *line)
{
    buffer_t bytes = buffer_new();
    biguint_t m;
    int rc;

    if (cipher_mode)
        return biguint_from_bytes_le(line->data, line->len);
    strip_blanks(line);
    rc = io_hex_decode(line, &bytes);
    if (rc != 0) {
        buffer_free(line);
        my_pgp_die(rc == -2 ? "rsa: the message is not a valid hexadecimal "
            "number" : "out of memory");
    }
    m = biguint_from_bytes_le(bytes.data, bytes.len);
    buffer_free(&bytes);
    return m;
}

/*
** A deciphered value of zero is the empty message: nothing but the line
** feed is printed, not a NUL byte.
*/
static void print_result(const biguint_t *result, bool cipher_mode)
{
    uint8_t *out_bytes;
    size_t out_len;
    char *hex;

    if (cipher_mode) {
        hex = rsa_biguint_to_hex(result);
        my_putline(hex);
        free(hex);
        return;
    }
    if (!biguint_is_zero(result)) {
        out_bytes = biguint_to_bytes_le(result, &out_len);
        my_putbytes(out_bytes, out_len);
        free(out_bytes);
    }
    my_putchar('\n');
}

static void run_rsa_crypt(const cli_options_t *opts, bool cipher_mode)
{
    rsa_key_t key = rsa_parse_key(opts->key);
    buffer_t line = io_read_line_buffer();
    biguint_t m = message_to_biguint(cipher_mode, &line);
    biguint_t result;

    buffer_free(&line);
    if (biguint_is_zero(&key.modulus) || biguint_cmp(&m, &key.modulus) >= 0)
        my_pgp_die("message too large for this key");
    result = biguint_powmod(&m, &key.exponent, &key.modulus);
    print_result(&result, cipher_mode);
    biguint_free(&m);
    biguint_free(&result);
    rsa_key_free(&key);
}

void run_rsa(const cli_options_t *opts)
{
    if (opts->mode == MODE_GENERATE) {
        run_rsa_generate(opts);
        return;
    }
    run_rsa_crypt(opts, opts->mode == MODE_CIPHER);
}
