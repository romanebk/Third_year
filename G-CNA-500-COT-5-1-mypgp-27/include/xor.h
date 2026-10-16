/*
** EPITECH PROJECT, 2026
** xor.h
** File description:
** XOR cipher (block and stream modes)
*/

#ifndef XOR_H_
#define XOR_H_

#include "buffer.h"
#include "cli.h"

#include <stddef.h>
#include <stdint.h>

/*
** The message and the key are two hexadecimal NUMBERS, and numbers follow
** the project nomenclature: little endian, the low byte on the left.
** The bytes of the message are therefore concatenated into a little-endian
** number before the exclusive or, which reads, on the byte array:
**
**     encrypt:  c[i] = m[len - 1 - i] ^ k[i]
**     decrypt:  m[i] = reverse(c ^ k)[i]
**
** Each function writes into *out (appended) and returns 0, or -1 when an
** allocation failed: the caller then frees everything and leaves with 84.
** The size of a block is the size of the key (subject, p.3).
**
** Official vector of the subject (p.4), used as the reference test:
**
**     key   576861742069732064656164206d6179206e6576657220646965
**     input You know nothing, Jon Snow
**     out   20070f2700071c6a4449060a490515164e4e12190b190011063c
*/

/* One block: `key_len` bytes in, `key_len` bytes out. */
int xor_encrypt_block(const uint8_t *msg, const uint8_t *key, size_t key_len,
    buffer_t *out);
int xor_decrypt_block(const uint8_t *cipher, const uint8_t *key,
    size_t key_len, buffer_t *out);

/*
** Successive blocks of the size of the key; the last one is padded with
** zeros when it is too small (subject, p.4).
*/
int xor_encrypt_stream(const uint8_t *msg, size_t len, const uint8_t *key,
    size_t key_len, buffer_t *out);
int xor_decrypt_stream(const uint8_t *cipher, size_t len, const uint8_t *key,
    size_t key_len, buffer_t *out);

/* Entry point for `./my_pgp xor`, returns 0 or -1. */
int run_xor(const cli_options_t *opts);

#endif /* !XOR_H_ */
