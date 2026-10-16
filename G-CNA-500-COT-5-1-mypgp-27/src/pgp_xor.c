/*
** EPITECH PROJECT, 2026
** pgp_xor.c
** File description:
** Pretty Good Privacy with XOR (hybrid RSA + XOR)
*/

#include "pgp_xor.h"
#include "my.h"
#include "bigint.h"
#include "buffer.h"
#include "error.h"
#include "hex.h"
#include "io.h"
#include "rsa.h"
#include "xor.h"

#include <ctype.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char *dup_substring(const char *start, size_t len)
{
    char *out = malloc(len + 1);

    if (out == NULL)
        my_pgp_die("out of memory");
    memcpy(out, start, len);
    out[len] = '\0';
    return out;
}

/*
** Splits "SYMMETRIC_KEY:RSA_KEY" on the single ':' separator. Both
** parts must be non-empty. The caller frees *sym_hex and *rsa_hex.
*/
static void split_pgp_key(const char *key, char **sym_hex, char **rsa_hex)
{
    const char *colon = strchr(key, ':');

    if (colon == NULL || strchr(colon + 1, ':') != NULL)
        my_pgp_die("pgp: key must have the form "
            "'SYMMETRIC_KEY:RSA_KEY'");
    if (colon == key || *(colon + 1) == '\0')
        my_pgp_die("pgp: key must have the form "
            "'SYMMETRIC_KEY:RSA_KEY'");
    *sym_hex = dup_substring(key, (size_t)(colon - key));
    *rsa_hex = dup_substring(colon + 1, strlen(colon + 1));
}

/*
** Decodes an hexadecimal C string without dying: the caller frees its
** own buffers before turning -1/-2 into an error 84, so error paths
** stay valgrind clean (same contract as io_hex_decode).
*/
static int decode_hex_string(const char *hex, buffer_t *out)
{
    buffer_t in;
    int rc;

    in.data = (uint8_t *)hex;
    in.len = strlen(hex);
    in.cap = 0;
    *out = buffer_new();
    rc = io_hex_decode(&in, out);
    return rc;
}

static void die_key_too_large(buffer_t *sym_key, rsa_key_t *key)
{
    buffer_free(sym_key);
    rsa_key_free(key);
    my_pgp_die("pgp: symmetric key too large for this RSA key");
}

/*
** Pre-validates the "EXP-MOD" RSA part so a malformed RSA key dies
** here (after freeing our own buffers) instead of leaking them
** through the die() buried inside rsa_parse_key().
*/
static void check_rsa_key_text(const char *rsa_hex, buffer_t *sym_key,
    char *rsa_dup)
{
    const char *dash = strchr(rsa_hex, '-');
    buffer_t tmp;
    char *part;

    if (dash == NULL || strchr(dash + 1, '-') != NULL
        || dash == rsa_hex || *(dash + 1) == '\0') {
        buffer_free(sym_key);
        free(rsa_dup);
        my_pgp_die("malformed RSA key, expected EXPONENT-MODULUS");
    }
    part = dup_substring(rsa_hex, (size_t)(dash - rsa_hex));
    if (decode_hex_string(part, &tmp) != 0) {
        free(part);
        buffer_free(sym_key);
        free(rsa_dup);
        my_pgp_die("malformed RSA key, expected EXPONENT-MODULUS");
    }
    buffer_free(&tmp);
    free(part);
    part = dup_substring(dash + 1, strlen(dash + 1));
    if (decode_hex_string(part, &tmp) != 0) {
        free(part);
        buffer_free(sym_key);
        free(rsa_dup);
        my_pgp_die("malformed RSA key, expected EXPONENT-MODULUS");
    }
    buffer_free(&tmp);
    free(part);
}

static int run_pgp_xor_cipher(const cli_options_t *opts)
{
    char *sym_hex;
    char *rsa_hex;
    buffer_t sym_key;
    rsa_key_t key;
    biguint_t m_sym;
    biguint_t c_sym;
    char *sym_line;
    char *c_hex;
    buffer_t input;
    buffer_t result = buffer_new();
    int rc;

    split_pgp_key(opts->key, &sym_hex, &rsa_hex);
    if (decode_hex_string(sym_hex, &sym_key) != 0) {
        free(sym_hex);
        free(rsa_hex);
        my_pgp_die("pgp: symmetric key is not valid hexadecimal");
    }
    free(sym_hex);
    if (sym_key.len == 0) {
        buffer_free(&sym_key);
        free(rsa_hex);
        my_pgp_die("pgp: symmetric key must not be empty");
    }
    check_rsa_key_text(rsa_hex, &sym_key, rsa_hex);
    key = rsa_parse_key(rsa_hex);
    free(rsa_hex);
    if (biguint_is_zero(&key.exponent) || biguint_is_zero(&key.modulus)) {
        buffer_free(&sym_key);
        rsa_key_free(&key);
        my_pgp_die("pgp: invalid RSA key (e and n must be non-zero)");
    }
    m_sym = biguint_from_bytes_le(sym_key.data, sym_key.len);
    if (biguint_cmp(&m_sym, &key.modulus) >= 0) {
        biguint_free(&m_sym);
        die_key_too_large(&sym_key, &key);
    }
    c_sym = biguint_powmod(&m_sym, &key.exponent, &key.modulus);
    biguint_free(&m_sym);
    sym_line = rsa_biguint_to_hex(&c_sym);
    biguint_free(&c_sym);
    input = opts->block_mode ? io_read_line_buffer() : io_read_all();
    if (opts->block_mode && input.len != sym_key.len) {
        free(sym_line);
        buffer_free(&sym_key);
        buffer_free(&input);
        buffer_free(&result);
        rsa_key_free(&key);
        my_pgp_die("pgp: -b requires the MESSAGE and the key to "
            "have the same size");
    }
    my_putline(sym_line);
    free(sym_line);
    if (opts->block_mode)
        rc = xor_encrypt_block(input.data, sym_key.data, sym_key.len,
            &result);
    else
        rc = xor_encrypt_stream(input.data, input.len, sym_key.data,
            sym_key.len, &result);
    if (rc != 0) {
        buffer_free(&sym_key);
        buffer_free(&input);
        buffer_free(&result);
        rsa_key_free(&key);
        my_pgp_die("out of memory");
    }
    c_hex = bytes_to_hex(result.data, result.len);
    my_putline(c_hex);
    free(c_hex);
    buffer_free(&sym_key);
    buffer_free(&input);
    buffer_free(&result);
    rsa_key_free(&key);
    return 0;
}

/* Drops whitespace so multi-line or spaced hex input is accepted. */
static void strip_whitespace(buffer_t *buf)
{
    size_t read;
    size_t write = 0;

    for (read = 0; read < buf->len; read++)
        if (!isspace(buf->data[read]))
            buf->data[write++] = buf->data[read];
    buf->len = write;
}

/*
** A deciphered stream "looks right" when it is text followed by the zero
** padding of its last block: printable characters, tabs and line breaks,
** then nothing but zeros.
*/
static bool is_clean_text(const buffer_t *out)
{
    size_t len = out->len;
    size_t i;

    while (len > 0 && out->data[len - 1] == 0)
        len--;
    for (i = 0; i < len; i++)
        if (!isprint(out->data[i]) && out->data[i] != '\t'
            && out->data[i] != '\n' && out->data[i] != '\r')
            return false;
    return true;
}

/* Deciphers the stream with `key` padded with zeros up to `len` bytes. */
static bool stream_is_clean_with(const uint8_t *key, size_t key_len,
    size_t len, const buffer_t *message)
{
    uint8_t *padded = calloc(len, 1);
    buffer_t out = buffer_new();
    bool clean;

    if (padded == NULL)
        return false;
    memcpy(padded, key, key_len);
    clean = xor_decrypt_stream(message->data, message->len, padded, len,
        &out) == 0 && is_clean_text(&out);
    buffer_free(&out);
    free(padded);
    return clean;
}

/*
** In stream mode the ciphered message is only a multiple of the key size.
** The smallest fitting size is kept whenever it deciphers into clean text
** (always the case unless the key ended with zero bytes); otherwise the
** larger fitting sizes are tried, and the first clean one wins.
*/
static size_t stream_key_length(const uint8_t *key, size_t key_len,
    const buffer_t *message)
{
    size_t msg_len = message->len;
    size_t first = key_len;
    size_t len;

    while (first < msg_len && msg_len % first != 0)
        first++;
    if (stream_is_clean_with(key, key_len, first, message))
        return first;
    for (len = first + 1; len <= msg_len; len++)
        if (msg_len % len == 0
            && stream_is_clean_with(key, key_len, len, message))
            return len;
    return first;
}

/*
** The RSA unwrap yields the minimal little-endian byte string of the
** symmetric key: a key whose highest bytes are zero comes back short.
** The ciphered message gives the real size back: in block mode it is
** the size of the key, in stream mode a multiple of it (see
** stream_key_length). Returns 0, or -1 when no size fits (the caller
** frees everything and leaves with 84).
*/
static int restore_key_length(uint8_t **key, size_t *key_len,
    const buffer_t *message, bool block_mode)
{
    size_t full = block_mode ? message->len
        : stream_key_length(*key, *key_len, message);
    uint8_t *padded;

    if (full < *key_len)
        return -1;
    if (full == *key_len)
        return 0;
    padded = calloc(full, 1);
    if (padded == NULL)
        return -1;
    memcpy(padded, *key, *key_len);
    free(*key);
    *key = padded;
    *key_len = full;
    return 0;
}

static int run_pgp_xor_decipher(const cli_options_t *opts)
{
    char *sym_hex;
    char *rsa_hex;
    buffer_t c_sym_bytes;
    rsa_key_t key;
    biguint_t c_sym;
    biguint_t sym;
    uint8_t *sym_key;
    size_t sym_len;
    buffer_t input;
    buffer_t message = buffer_new();
    buffer_t result = buffer_new();
    int rc;

    split_pgp_key(opts->key, &sym_hex, &rsa_hex);
    if (decode_hex_string(sym_hex, &c_sym_bytes) != 0) {
        free(sym_hex);
        free(rsa_hex);
        my_pgp_die("pgp: invalid ciphered symmetric key");
    }
    free(sym_hex);
    check_rsa_key_text(rsa_hex, &c_sym_bytes, rsa_hex);
    key = rsa_parse_key(rsa_hex);
    free(rsa_hex);
    if (biguint_is_zero(&key.exponent) || biguint_is_zero(&key.modulus)) {
        buffer_free(&c_sym_bytes);
        rsa_key_free(&key);
        my_pgp_die("pgp: invalid RSA key (d and n must be non-zero)");
    }
    c_sym = biguint_from_bytes_le(c_sym_bytes.data, c_sym_bytes.len);
    buffer_free(&c_sym_bytes);
    if (biguint_cmp(&c_sym, &key.modulus) >= 0) {
        biguint_free(&c_sym);
        rsa_key_free(&key);
        buffer_free(&message);
        buffer_free(&result);
        my_pgp_die("pgp: ciphered symmetric key too large for "
            "this RSA key");
    }
    sym = biguint_powmod(&c_sym, &key.exponent, &key.modulus);
    biguint_free(&c_sym);
    rsa_key_free(&key);
    sym_key = biguint_to_bytes_le(&sym, &sym_len);
    biguint_free(&sym);
    if (sym_len == 0) {
        free(sym_key);
        buffer_free(&message);
        buffer_free(&result);
        my_pgp_die("pgp: deciphered symmetric key is empty");
    }
    input = opts->block_mode ? io_read_line_buffer() : io_read_all();
    strip_whitespace(&input);
    rc = io_hex_decode(&input, &message);
    buffer_free(&input);
    if (rc == -2) {
        free(sym_key);
        buffer_free(&message);
        buffer_free(&result);
        my_pgp_die("pgp: the message is not a valid hexadecimal number");
    }
    if (rc != 0) {
        free(sym_key);
        buffer_free(&message);
        buffer_free(&result);
        my_pgp_die("out of memory");
    }
    if (restore_key_length(&sym_key, &sym_len, &message,
        opts->block_mode) != 0) {
        free(sym_key);
        buffer_free(&message);
        buffer_free(&result);
        my_pgp_die("pgp: -b requires the MESSAGE and the key to "
            "have the same size");
    }
    if (opts->block_mode)
        rc = xor_decrypt_block(message.data, sym_key, sym_len, &result);
    else
        rc = xor_decrypt_stream(message.data, message.len, sym_key,
            sym_len, &result);
    if (rc != 0) {
        free(sym_key);
        buffer_free(&message);
        buffer_free(&result);
        my_pgp_die("out of memory");
    }
    my_put_message(result.data, result.len);
    free(sym_key);
    buffer_free(&message);
    buffer_free(&result);
    return 0;
}

int run_pgp_xor(const cli_options_t *opts)
{
    if (opts == NULL)
        return -1;
    if (opts->mode == MODE_GENERATE)
        my_pgp_die("-g MODE is only valid for the rsa CRYPTO_SYSTEM");
    if (opts->mode == MODE_CIPHER)
        return run_pgp_xor_cipher(opts);
    return run_pgp_xor_decipher(opts);
}
