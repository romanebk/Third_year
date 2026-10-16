/*
** EPITECH PROJECT, 2026
** xor.c
** File description:
** XOR cipher (block and stream modes)
*/

#include "xor.h"
#include "my.h"
#include "error.h"
#include "hex.h"
#include "io.h"

#include <stdio.h>
#include <stdlib.h>

/*
** Every argument is validated first: an internal mistake (NULL pointer)
** must never reach the loops below and turn into a segmentation fault.
** The data itself is only required to hold `key_len` readable bytes, which
** the block mode and the padded chunks of the stream mode both guarantee.
*/
static int xor_check(const uint8_t *key, size_t key_len, const buffer_t *out)
{
    if (key == NULL || out == NULL || key_len == 0)
        return -1;
    return 0;
}

/*
** c = m ^ k, both numbers in little endian: the message bytes are read
** from the highest address to the lowest one so that the first byte of
** the message becomes the least significant byte of the number.
*/
int xor_encrypt_block(const uint8_t *msg, const uint8_t *key, size_t key_len,
    buffer_t *out)
{
    size_t i;

    if (xor_check(key, key_len, out) != 0)
        return -1;
    for (i = 0; i < key_len; i++)
        buffer_push(out, (uint8_t)(msg[key_len - 1 - i] ^ key[i]));
    return 0;
}

/*
** Deciphering is the same exclusive or, but the resulting number is
** converted back into a byte sequence: the buffer is written from the
** last byte to the first one.
*/
int xor_decrypt_block(const uint8_t *cipher, const uint8_t *key,
    size_t key_len, buffer_t *out)
{
    size_t i;

    if (xor_check(key, key_len, out) != 0)
        return -1;
    for (i = key_len; i-- > 0;)
        buffer_push(out, (uint8_t)(cipher[i] ^ key[i]));
    return 0;
}

/*
** Copies one block out of `data`, padded with zeros when it is shorter
** than `size` (the padding is what calloc already provides).
** Returns NULL when the allocation fails, the caller reports the error.
*/
static uint8_t *zero_padded_chunk(const uint8_t *data, size_t len,
    size_t offset, size_t size)
{
    uint8_t *chunk = calloc(size, 1);
    size_t available = len - offset;
    size_t i;

    if (chunk == NULL)
        return NULL;
    if (available > size)
        available = size;
    for (i = 0; i < available; i++)
        chunk[i] = data[offset + i];
    return chunk;
}

int xor_encrypt_stream(const uint8_t *msg, size_t len, const uint8_t *key,
    size_t key_len, buffer_t *out)
{
    size_t offset;

    if (xor_check(key, key_len, out) != 0)
        return -1;
    for (offset = 0; offset < len; offset += key_len) {
        uint8_t *chunk = zero_padded_chunk(msg, len, offset, key_len);
        int rc;

        if (chunk == NULL)
            return -1;
        rc = xor_encrypt_block(chunk, key, key_len, out);
        free(chunk);
        if (rc != 0)
            return rc;
    }
    return 0;
}

int xor_decrypt_stream(const uint8_t *cipher, size_t len, const uint8_t *key,
    size_t key_len, buffer_t *out)
{
    size_t offset;

    if (xor_check(key, key_len, out) != 0)
        return -1;
    for (offset = 0; offset < len; offset += key_len) {
        uint8_t *chunk = zero_padded_chunk(cipher, len, offset, key_len);
        int rc;

        if (chunk == NULL)
            return -1;
        rc = xor_decrypt_block(chunk, key, key_len, out);
        free(chunk);
        if (rc != 0)
            return rc;
    }
    return 0;
}

/*
** One place for the key validation of the XOR mode, mirroring the AES
** one: an empty key stops the program before any input is read, and the
** buffer is released first so the failure is not reported as a leak.
*/
static void xor_check_key(buffer_t *key)
{
    if (key->len == 0) {
        buffer_free(key);
        my_pgp_die("xor: the key must not be empty");
    }
}

/*
** Ciphering prints a hexadecimal number, deciphering prints bytes: both
** end with a line feed (subject, p.5). Kept identical to the AES output
** so the two crypto systems can be swapped without changing a pipeline.
*/
static void xor_print_result(const buffer_t *result, const cli_options_t *opts)
{
    if (opts->mode == MODE_CIPHER)
        my_put_hex_line(result->data, result->len);
    else
        my_put_message(result->data, result->len);
}

/*
** Reads the standard input, runs the requested direction and prints the
** result: an hexadecimal number when ciphering, raw bytes when
** deciphering (both terminated by a line feed).
*/
int run_xor(const cli_options_t *opts)
{
    buffer_t key;
    buffer_t input;
    buffer_t message = buffer_new();
    buffer_t result = buffer_new();
    int rc = 0;

    if (opts == NULL)
        return -1;
    key = hex_to_bytes(opts->key);
    xor_check_key(&key);
    input = opts->block_mode ? io_read_line_buffer() : io_read_all();
    if (opts->mode == MODE_CIPHER)
        message = input;
    else {
        rc = io_hex_decode(&input, &message);
        buffer_free(&input);
        if (rc == -2) {
            buffer_free(&key);
            my_pgp_die("xor: the message is not a valid hexadecimal number");
        }
        if (rc != 0) {
            buffer_free(&key);
            my_pgp_die("out of memory");
        }
    }
    if (opts->block_mode && message.len != key.len) {
        buffer_free(&key);
        buffer_free(&message);
        my_pgp_die("xor: -b requires the MESSAGE and the key to have "
            "the same size");
    }
    if (opts->mode == MODE_CIPHER)
        rc = opts->block_mode
            ? xor_encrypt_block(message.data, key.data, key.len, &result)
            : xor_encrypt_stream(message.data, message.len, key.data, key.len,
                &result);
    else
        rc = opts->block_mode
            ? xor_decrypt_block(message.data, key.data, key.len, &result)
            : xor_decrypt_stream(message.data, message.len, key.data, key.len,
                &result);
    if (rc != 0) {
        buffer_free(&key);
        buffer_free(&message);
        buffer_free(&result);
        my_pgp_die("out of memory");
    }
    xor_print_result(&result, opts);
    buffer_free(&key);
    buffer_free(&message);
    buffer_free(&result);
    return 0;
}
