/*
** EPITECH PROJECT, 2026
** pgp_aes.c
** File description:
** Pretty Good Privacy with AES (hybrid RSA + AES)
*/

#include "pgp_aes.h"
#include "my.h"
#include "aes.h"
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

static void check_sym_key_size(buffer_t *sym_key, char *rsa_hex)
{
    if (sym_key->len != 16 && sym_key->len != 24 && sym_key->len != 32) {
        buffer_free(sym_key);
        free(rsa_hex);
        my_pgp_die("pgp: symmetric key must be 16, 24 or 32 bytes long");
    }
}

/*
** Builds the AES context from the symmetric key. The word swap is
** done in place: the key buffer is ours and is only freed afterwards.
** Returns 0, or -1 when the key size is not 16, 24 or 32 bytes (the
** caller frees everything and leaves with 84).
*/
static int build_aes_ctx(aes_ctx_t *ctx, buffer_t *sym_key)
{
    aes_word_swap(sym_key->data, sym_key->len);
    return aes_key_schedule(ctx, sym_key->data, sym_key->len);
}

static int run_pgp_aes_cipher(const cli_options_t *opts)
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
    aes_ctx_t ctx;
    int rc;

    split_pgp_key(opts->key, &sym_hex, &rsa_hex);
    if (decode_hex_string(sym_hex, &sym_key) != 0) {
        free(sym_hex);
        free(rsa_hex);
        my_pgp_die("pgp: symmetric key is not valid hexadecimal");
    }
    free(sym_hex);
    check_sym_key_size(&sym_key, rsa_hex);
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
    if (opts->block_mode && input.len != AES_BLOCK_SIZE) {
        free(sym_line);
        buffer_free(&sym_key);
        buffer_free(&input);
        buffer_free(&result);
        rsa_key_free(&key);
        my_pgp_die("pgp: -b requires the MESSAGE to be exactly one "
            "AES block (16 bytes)");
    }
    my_putline(sym_line);
    free(sym_line);
    build_aes_ctx(&ctx, &sym_key);
    /*
    ** Same shared path as run_aes: the stream primitives own the
    ** little-endian word swap (after cipher, before decipher) and the
    ** zero padding, so -b yields exactly the `aes` subject vector.
    */
    rc = aes_encrypt_stream(&ctx, input.data, input.len, &result);
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
** The RSA unwrap yields the minimal big-endian... little-endian byte
** string of the key: a key whose highest byte is zero comes back one
** byte short. Zero bytes are restored up to the next valid AES size
** (16/24/32), which recovers the original key in every case except a
** degenerate key with several trailing zero bytes.
*/
static uint8_t *pad_unwrapped_key(uint8_t *raw, size_t raw_len,
    size_t *out_len, buffer_t *message, buffer_t *result)
{
    size_t full = 16;
    uint8_t *key;

    if (raw_len > 16 && raw_len <= 24)
        full = 24;
    else if (raw_len > 24 && raw_len <= 32)
        full = 32;
    else if (raw_len > 32) {
        free(raw);
        buffer_free(message);
        buffer_free(result);
        my_pgp_die("pgp: deciphered symmetric key is too long");
    }
    key = calloc(full, 1);
    if (key == NULL) {
        free(raw);
        buffer_free(message);
        buffer_free(result);
        my_pgp_die("out of memory");
    }
    memcpy(key, raw, raw_len);
    free(raw);
    *out_len = full;
    return key;
}

static int run_pgp_aes_decipher(const cli_options_t *opts)
{
    char *sym_hex;
    char *rsa_hex;
    buffer_t c_sym_bytes;
    rsa_key_t key;
    biguint_t c_sym;
    biguint_t sym;
    uint8_t *raw_key;
    uint8_t *sym_key;
    size_t raw_len;
    size_t sym_len;
    buffer_t input;
    buffer_t message = buffer_new();
    buffer_t result = buffer_new();
    aes_ctx_t ctx;
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
    raw_key = biguint_to_bytes_le(&sym, &raw_len);
    biguint_free(&sym);
    sym_key = pad_unwrapped_key(raw_key, raw_len, &sym_len, &message,
        &result);
    aes_word_swap(sym_key, sym_len);
    if (aes_key_schedule(&ctx, sym_key, sym_len) != 0) {
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
    if (opts->block_mode && message.len != AES_BLOCK_SIZE) {
        free(sym_key);
        buffer_free(&message);
        buffer_free(&result);
        my_pgp_die("pgp: -b requires the MESSAGE to be exactly one "
            "AES block (16 bytes)");
    }
    rc = aes_decrypt_stream(&ctx, message.data, message.len, &result);
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

int run_pgp_aes(const cli_options_t *opts)
{
    if (opts == NULL)
        return -1;
    if (opts->mode == MODE_GENERATE)
        my_pgp_die("-g MODE is only valid for the rsa CRYPTO_SYSTEM");
    if (opts->mode == MODE_CIPHER)
        return run_pgp_aes_cipher(opts);
    return run_pgp_aes_decipher(opts);
}
