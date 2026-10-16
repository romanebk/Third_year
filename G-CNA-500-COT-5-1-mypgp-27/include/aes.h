/*
** EPITECH PROJECT, 2026
** aes.h
** File description:
** AES-128/192/256 block cipher (block and stream modes)
*/

#ifndef AES_H_
#define AES_H_

#include "buffer.h"
#include "cli.h"

#include <stddef.h>
#include <stdint.h>

#define AES_BLOCK_SIZE 16
#define AES_MAX_ROUNDS 14
#define AES_ROUND_KEYS_SIZE ((AES_MAX_ROUNDS + 1) * AES_BLOCK_SIZE)
#define AES_MIN_KEY_SIZE 16
#define AES_MAX_KEY_SIZE 32

/*
** Expanded key: the schedule of AES-128 needs 11 round keys of 16 bytes,
** AES-192 needs 13 and AES-256 needs 15, hence 15 * 16 = 240 bytes.
** `rounds` (Nr) is 10, 12 or 14 and is deduced from the key size.
*/
typedef struct {
    uint8_t round_keys[AES_ROUND_KEYS_SIZE];
    size_t rounds;
} aes_ctx_t;

/*
** The AES state is a 4x4 matrix of bytes filled COLUMN BY COLUMN: the
** byte of index i sits at row i % 4 and column i / 4 (FIPS-197, 3.4).
** The primitives below are exposed on purpose: each round step stays a
** small function that can be explained and tested on its own.
*/
void aes_state_load(uint8_t state[4][4],
    const uint8_t block[AES_BLOCK_SIZE]);
void aes_state_store(uint8_t block[AES_BLOCK_SIZE],
    const uint8_t state[4][4]);

void aes_add_round_key(uint8_t state[4][4], const uint8_t *round_key);
void aes_sub_bytes(uint8_t state[4][4]);
void aes_inv_sub_bytes(uint8_t state[4][4]);
void aes_shift_rows(uint8_t state[4][4]);
void aes_inv_shift_rows(uint8_t state[4][4]);
void aes_mix_columns(uint8_t state[4][4]);
void aes_inv_mix_columns(uint8_t state[4][4]);

/*
** Numbers are little endian, one 32-bit word at a time (nomenclature of
** the subject): each word of a key or of a ciphered block is byte-swapped
** on the way in and on the way out of the AES core, which is written for
** big endian words. `len` must be a multiple of 4.
*/
void aes_word_swap(uint8_t *bytes, size_t len);

/*
** Builds the expanded key. Returns 0, or -1 when `key_len` is not 16, 24
** or 32 bytes (the caller turns that into an error 84).
*/
int aes_key_schedule(aes_ctx_t *ctx, const uint8_t *key, size_t key_len);

/* One AES block in place: textbook FIPS-197 cipher / inverse cipher. */
void aes_encrypt_block(const aes_ctx_t *ctx, uint8_t block[AES_BLOCK_SIZE]);
void aes_decrypt_block(const aes_ctx_t *ctx, uint8_t block[AES_BLOCK_SIZE]);

/*
** Successive 16 byte blocks; the last one is padded with zeros when it is
** too small (subject, p.5). Returns 0 or -1 (allocation failure).
*/
int aes_encrypt_stream(const aes_ctx_t *ctx, const uint8_t *msg, size_t len,
    buffer_t *out);
int aes_decrypt_stream(const aes_ctx_t *ctx, const uint8_t *cipher, size_t len,
    buffer_t *out);

/*
** Entry point for `./my_pgp aes`, returns 0 or -1.
**
** -b always means one AES block of 16 bytes, whatever the key size: the
** rule "MESSAGE and key must be the same size" of the subject holds for
** the 128 bit key, but AES itself only ever encrypts 16 bytes, so a
** message of any other size stops the program with 84.
*/
int run_aes(const cli_options_t *opts);

#endif /* !AES_H_ */
