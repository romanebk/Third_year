/*
** EPITECH PROJECT, 2026
** padding.c
** File description:
** bonus 2: PKCS#7 padding for the xor and aes stream modes
*/

#include "bonus.h"
#include "aes.h"
#include "error.h"
#include "hex.h"
#include "io.h"
#include "my.h"
#include "xor.h"

#include <stdlib.h>
#include <string.h>

#define PKCS7_MAX_BLOCK 255

/*
** N = block - (len % block) bytes are added, each one worth N: from 1 byte
** of 0x01 up to a whole block of `block` bytes when the message is already
** aligned. That last case is what makes the padding always removable.
*/
int pkcs7_pad(buffer_t *buf, size_t block)
{
    size_t count;
    size_t i;

    if (buf == NULL || block == 0 || block > PKCS7_MAX_BLOCK)
        return -1;
    count = block - buf->len % block;
    for (i = 0; i < count; i++)
        buffer_push(buf, (uint8_t)count);
    return 0;
}

/*
** The last byte tells how many bytes to remove; all of them must carry
** that same value, otherwise the key or the message is wrong.
*/
int pkcs7_unpad(buffer_t *buf, size_t block)
{
    size_t count;
    size_t i;

    if (buf == NULL || block == 0 || block > PKCS7_MAX_BLOCK
        || buf->len == 0 || buf->len % block != 0)
        return -1;
    count = buf->data[buf->len - 1];
    if (count == 0 || count > block)
        return -1;
    for (i = buf->len - count; i < buf->len; i++)
        if (buf->data[i] != count)
            return -1;
    buf->len -= count;
    return 0;
}

/* AES: 16, 24 or 32 bytes of key and blocks of 16; XOR: 1 to 255. */
static size_t block_size(const cli_options_t *opts, buffer_t *key)
{
    if (opts->crypto == CRYPTO_AES) {
        if (key->len != 16 && key->len != 24 && key->len != 32) {
            buffer_free(key);
            my_pgp_die("aes: the key must be 16, 24 or 32 bytes long "
                "(128, 192 or 256 bits)");
        }
        return AES_BLOCK_SIZE;
    }
    if (key->len == 0 || key->len > PKCS7_MAX_BLOCK) {
        buffer_free(key);
        my_pgp_die("bonus: with -p the xor key must be 1 to 255 bytes long");
    }
    return key->len;
}

static int crypt_stream(const cli_options_t *opts, buffer_t *key,
    const buffer_t *in, buffer_t *out)
{
    aes_ctx_t ctx;
    bool cipher = opts->mode == MODE_CIPHER;

    if (opts->crypto == CRYPTO_XOR)
        return cipher
            ? xor_encrypt_stream(in->data, in->len, key->data, key->len, out)
            : xor_decrypt_stream(in->data, in->len, key->data, key->len, out);
    aes_word_swap(key->data, key->len);
    if (aes_key_schedule(&ctx, key->data, key->len) != 0)
        return -1;
    return cipher ? aes_encrypt_stream(&ctx, in->data, in->len, out)
        : aes_decrypt_stream(&ctx, in->data, in->len, out);
}

/* The message to process: raw bytes to cipher, hex number to decipher. */
static buffer_t read_message(const cli_options_t *opts, buffer_t *key)
{
    buffer_t input = io_read_all();
    buffer_t message = buffer_new();
    int rc;

    if (opts->mode == MODE_CIPHER)
        return input;
    rc = io_hex_decode(&input, &message);
    buffer_free(&input);
    if (rc != 0) {
        buffer_free(key);
        my_pgp_die("bonus: the message is not a valid hexadecimal number");
    }
    return message;
}

static void fail(buffer_t *key, buffer_t *message, buffer_t *result,
    const char *why)
{
    buffer_free(key);
    buffer_free(message);
    buffer_free(result);
    my_pgp_die(why);
}

int run_padded(const cli_options_t *opts)
{
    buffer_t key = hex_to_bytes(opts->key);
    size_t block = block_size(opts, &key);
    buffer_t message = read_message(opts, &key);
    buffer_t result = buffer_new();

    if (opts->mode == MODE_CIPHER && pkcs7_pad(&message, block) != 0)
        fail(&key, &message, &result, "bonus: invalid block size");
    if (opts->mode == MODE_DECIPHER
        && (message.len == 0 || message.len % block != 0))
        fail(&key, &message, &result,
            "bonus: a padded message is a whole number of blocks");
    if (crypt_stream(opts, &key, &message, &result) != 0)
        fail(&key, &message, &result, "out of memory");
    if (opts->mode == MODE_DECIPHER && pkcs7_unpad(&result, block) != 0)
        fail(&key, &message, &result,
            "bonus: invalid PKCS#7 padding (wrong key or message)");
    if (opts->mode == MODE_CIPHER)
        my_put_hex_line(result.data, result.len);
    else
        my_put_message(result.data, result.len);
    buffer_free(&key);
    buffer_free(&message);
    buffer_free(&result);
    return 0;
}

bool has_padding_flag(int argc, char **argv)
{
    int i;

    for (i = 2; i < argc; i++)
        if (strcmp(argv[i], "-p") == 0)
            return true;
    return false;
}

/*
** "-p" is taken out and the rest goes through the mandatory parser, so
** every argument error keeps exactly the same message and code 84.
*/
int run_with_padding(int argc, char **argv)
{
    char **args = malloc(sizeof(char *) * (size_t)argc);
    cli_options_t opts;
    int count = 0;
    int i;

    if (args == NULL)
        my_pgp_die("out of memory");
    for (i = 0; i < argc; i++)
        if (i < 2 || strcmp(argv[i], "-p") != 0)
            args[count++] = argv[i];
    if (count != argc - 1) {
        free(args);
        my_pgp_die("bonus: -p must be given only once");
    }
    parse_args(count, args, &opts);
    free(args);
    if (opts.crypto != CRYPTO_XOR && opts.crypto != CRYPTO_AES)
        my_pgp_die("bonus: -p only works with xor and aes");
    if (opts.block_mode)
        my_pgp_die("bonus: -p is a stream mode option, it cannot be "
            "used with -b");
    return run_padded(&opts);
}
