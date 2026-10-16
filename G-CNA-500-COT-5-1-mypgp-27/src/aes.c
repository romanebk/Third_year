/*
** EPITECH PROJECT, 2026
** aes.c
** File description:
** AES-128/192/256 block cipher (block and stream modes)
*/

#include "aes.h"
#include "my.h"
#include "error.h"
#include "hex.h"
#include "io.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/*
** S-box of AES (FIPS-197, table 5.1): the only nonlinear step of the
** cipher, a multiplicative inverse in GF(2^8) followed by an affine
** transformation. The inverse table lets the decipher use the same code
** shape with the opposite substitution.
*/
static const uint8_t sbox[256] = {
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5,
    0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0,
    0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc,
    0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a,
    0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0,
    0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b,
    0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85,
    0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5,
    0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17,
    0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88,
    0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c,
    0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9,
    0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6,
    0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e,
    0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94,
    0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68,
    0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
};

/*
** SubBytes: each byte of the state is replaced by its image in the
** S-box. Nothing else changes: this is the byte substitution step.
*/
void aes_sub_bytes(uint8_t state[4][4])
{
    size_t row;
    size_t col;

    for (row = 0; row < 4; row++)
        for (col = 0; col < 4; col++)
            state[row][col] = sbox[state[row][col]];
}

/*
** Inverse S-box (FIPS-197, table 6.1): used by InvSubBytes, the first
** step of every deciphering round.
*/
static const uint8_t inv_sbox[256] = {
    0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38,
    0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
    0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87,
    0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
    0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d,
    0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
    0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2,
    0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
    0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16,
    0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
    0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda,
    0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
    0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a,
    0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
    0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02,
    0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
    0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea,
    0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
    0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85,
    0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
    0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89,
    0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
    0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20,
    0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
    0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31,
    0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
    0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d,
    0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
    0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0,
    0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
    0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26,
    0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d
};

/*
** InvSubBytes: the exact opposite of SubBytes, byte per byte.
*/
void aes_inv_sub_bytes(uint8_t state[4][4])
{
    size_t row;
    size_t col;

    for (row = 0; row < 4; row++)
        for (col = 0; col < 4; col++)
            state[row][col] = inv_sbox[state[row][col]];
}

/*
** The state matrix is created COLUMN BY COLUMN (subject, p.5): the byte
** of index i of the block goes to row i % 4, column i / 4. Reading and
** writing the block the other way round (row by row) is the classic
** mistake: it silently transposes the whole cipher.
*/
void aes_state_load(uint8_t state[4][4],
    const uint8_t block[AES_BLOCK_SIZE])
{
    size_t row;
    size_t col;

    for (col = 0; col < 4; col++)
        for (row = 0; row < 4; row++)
            state[row][col] = block[col * 4 + row];
}

/*
** Inverse of aes_state_load: the matrix is flattened back column by
** column, so that load(store(state)) is the identity.
*/
void aes_state_store(uint8_t block[AES_BLOCK_SIZE],
    const uint8_t state[4][4])
{
    size_t row;
    size_t col;

    for (col = 0; col < 4; col++)
        for (row = 0; row < 4; row++)
            block[col * 4 + row] = state[row][col];
}

/*
** ShiftRows: row r is cyclically shifted to the LEFT by r bytes
** (FIPS-197, 5.1.2). Row 0 is untouched, which is why the loop starts
** at 1: the columns are the ones that must stay aligned for MixColumns.
*/
void aes_shift_rows(uint8_t state[4][4])
{
    uint8_t shifted[4];
    size_t row;
    size_t i;

    for (row = 1; row < 4; row++) {
        for (i = 0; i < 4; i++)
            shifted[i] = state[row][(i + row) % 4];
        for (i = 0; i < 4; i++)
            state[row][i] = shifted[i];
    }
}

/*
** InvShiftRows: the mirror of ShiftRows, each row r is cyclically
** shifted to the RIGHT by r bytes. Doing left and right the same way is
** the second classic mistake: it only shows up on multi-block messages.
*/
void aes_inv_shift_rows(uint8_t state[4][4])
{
    uint8_t shifted[4];
    size_t row;
    size_t i;

    for (row = 1; row < 4; row++) {
        for (i = 0; i < 4; i++)
            shifted[i] = state[row][(i + 4 - row) % 4];
        for (i = 0; i < 4; i++)
            state[row][i] = shifted[i];
    }
}

/*
** AddRoundKey: XOR of the state with one round key. The round key is a
** flat 16 byte sequence read column by column as well, so the byte of
** index i is applied to the cell (i % 4, i / 4). It is the only step
** that actually mixes the key into the data (FIPS-197, 5.1.4).
*/
void aes_add_round_key(uint8_t state[4][4], const uint8_t *round_key)
{
    size_t row;
    size_t col;

    for (col = 0; col < 4; col++)
        for (row = 0; row < 4; row++)
            state[row][col] ^= round_key[col * 4 + row];
}

/*
** Multiplication by x (that is, by 2) in GF(2^8) modulo the AES
** polynomial x^8 + x^4 + x^3 + x + 1 (0x11b): the carry of the high
** bit is folded back with 0x1b.
*/
static uint8_t xtime(uint8_t value)
{
    return (uint8_t)((value << 1) ^ (((value >> 7) & 1) * 0x1b));
}

/*
** MixColumns (FIPS-197, 5.1.3): each column is multiplied by the fixed
** circulant matrix
**     | 02 03 01 01 |
**     | 01 02 03 01 |
**     | 01 01 02 03 |
**     | 03 01 01 02 |
** in GF(2^8): column by column, so the four cells are read together
** and every 2 is an xtime and every 3 an xtime XORed with the byte.
*/
void aes_mix_columns(uint8_t state[4][4])
{
    uint8_t a0;
    uint8_t a1;
    uint8_t a2;
    uint8_t a3;
    size_t col;

    for (col = 0; col < 4; col++) {
        a0 = state[0][col];
        a1 = state[1][col];
        a2 = state[2][col];
        a3 = state[3][col];
        state[0][col] = xtime(a0) ^ (xtime(a1) ^ a1) ^ a2 ^ a3;
        state[1][col] = a0 ^ xtime(a1) ^ (xtime(a2) ^ a2) ^ a3;
        state[2][col] = a0 ^ a1 ^ xtime(a2) ^ (xtime(a3) ^ a3);
        state[3][col] = (xtime(a0) ^ a0) ^ a1 ^ a2 ^ xtime(a3);
    }
}

/*
** Multiplication of two bytes in GF(2^8) modulo 0x11b (Russian peasant
** multiplication): InvMixColumns needs the coefficients 9, 11, 13 and
** 14, which xtime alone cannot produce.
*/
static uint8_t gf_mul(uint8_t a, uint8_t b)
{
    uint8_t product = 0;

    while (b != 0) {
        if ((b & 1) != 0)
            product = (uint8_t)(product ^ a);
        a = (uint8_t)((a << 1) ^ (((a >> 7) & 1) * 0x1b));
        b = (uint8_t)(b >> 1);
    }
    return product;
}

/*
** InvMixColumns: the column is multiplied by the inverse matrix
**     | 0e 0b 0d 09 |
**     | 09 0e 0b 0d |
**     | 0d 09 0e 0b |
**     | 0b 0d 09 0e |
** and nothing else in the decipher round differs from the encipher one.
*/
void aes_inv_mix_columns(uint8_t state[4][4])
{
    uint8_t a0;
    uint8_t a1;
    uint8_t a2;
    uint8_t a3;
    size_t col;

    for (col = 0; col < 4; col++) {
        a0 = state[0][col];
        a1 = state[1][col];
        a2 = state[2][col];
        a3 = state[3][col];
        state[0][col] = gf_mul(a0, 14) ^ gf_mul(a1, 11)
            ^ gf_mul(a2, 13) ^ gf_mul(a3, 9);
        state[1][col] = gf_mul(a0, 9) ^ gf_mul(a1, 14)
            ^ gf_mul(a2, 11) ^ gf_mul(a3, 13);
        state[2][col] = gf_mul(a0, 13) ^ gf_mul(a1, 9)
            ^ gf_mul(a2, 14) ^ gf_mul(a3, 11);
        state[3][col] = gf_mul(a0, 11) ^ gf_mul(a1, 13)
            ^ gf_mul(a2, 9) ^ gf_mul(a3, 14);
    }
}

/*
** The subject handles numbers as LITTLE ENDIAN, one 32-bit word at a
** time, while the AES specification (and every reference implementation)
** works on big endian words. Swapping the four bytes of every word on
** the way in and on the way out is what makes the official test vector
** of the subject match a textbook FIPS-197 cipher.
*/
void aes_word_swap(uint8_t *bytes, size_t len)
{
    uint8_t tmp;
    size_t i;

    for (i = 0; i + 3 < len; i += 4) {
        tmp = bytes[i];
        bytes[i] = bytes[i + 3];
        bytes[i + 3] = tmp;
        tmp = bytes[i + 1];
        bytes[i + 1] = bytes[i + 2];
        bytes[i + 2] = tmp;
    }
}

/*
** Round constants: byte i of the expanded key uses Rcon[i] = x^(i-1)
** in GF(2^8), written as a whole word with the three other bytes zero.
*/
static const uint8_t rcon[10] = {
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36
};

/*
** RotWord (FIPS-197, 5.2): cyclic shift to the LEFT of one 32-bit word.
** Together with SubWord and the round constant this is the only place
** where the expansion stops being a plain copy.
*/
static void rot_word(uint8_t word[4])
{
    uint8_t first = word[0];

    word[0] = word[1];
    word[1] = word[2];
    word[2] = word[3];
    word[3] = first;
}

/* SubWord: the S-box substitution applied to the four bytes of a word. */
static void sub_word(uint8_t word[4])
{
    size_t i;

    for (i = 0; i < 4; i++)
        word[i] = sbox[word[i]];
}

/*
** Key schedule for AES-128/192/256 (FIPS-197, 5.2). Nk = key_len / 4
** words of key material (4, 6 or 8) and the number of rounds is
** Nr = Nk + 6 (10, 12 or 14), so the expanded key holds 4 * (Nr + 1)
** words: 44, 52 or 60. Each new word is the previous one XORed with the
** word Nk places back, after a RotWord, a SubWord and the round constant
** at every key round boundary. AES-256 has one extra rule: the word just
** before a boundary goes through a bare SubWord. Returns -1 when the key
** size is not 16, 24 or 32 bytes.
*/
int aes_key_schedule(aes_ctx_t *ctx, const uint8_t *key, size_t key_len)
{
    uint8_t temp[4];
    size_t nk = key_len / 4;
    size_t words;
    size_t i;
    size_t j;

    if (key == NULL || ctx == NULL)
        return -1;
    if (key_len < AES_MIN_KEY_SIZE || key_len > AES_MAX_KEY_SIZE
        || key_len % 4 != 0)
        return -1;
    words = 4 * (nk + 6 + 1);
    ctx->rounds = nk + 6;
    memcpy(ctx->round_keys, key, key_len);
    for (i = nk; i < words; i++) {
        memcpy(temp, ctx->round_keys + (i - 1) * 4, 4);
        if (i % nk == 0) {
            rot_word(temp);
            sub_word(temp);
            temp[0] = (uint8_t)(temp[0] ^ rcon[i / nk - 1]);
        } else if (nk > 6 && i % nk == 4) {
            sub_word(temp);
        }
        for (j = 0; j < 4; j++)
            ctx->round_keys[i * 4 + j] =
                (uint8_t)(ctx->round_keys[(i - nk) * 4 + j] ^ temp[j]);
    }
    return 0;
}

/*
** Textbook enciphering of one block (FIPS-197, 5.1): an initial round
** key, then Nr times SubBytes + ShiftRows + MixColumns + AddRoundKey,
** and a last round without MixColumns (it would only cost an inverse
** without adding security). The block is the 16 byte flat sequence of
** the state, loaded and stored column by column.
*/
void aes_encrypt_block(const aes_ctx_t *ctx, uint8_t block[AES_BLOCK_SIZE])
{
    uint8_t state[4][4];
    size_t round;

    aes_state_load(state, block);
    aes_add_round_key(state, ctx->round_keys);
    for (round = 1; round < ctx->rounds; round++) {
        aes_sub_bytes(state);
        aes_shift_rows(state);
        aes_mix_columns(state);
        aes_add_round_key(state, ctx->round_keys + round * AES_BLOCK_SIZE);
    }
    aes_sub_bytes(state);
    aes_shift_rows(state);
    aes_add_round_key(state,
        ctx->round_keys + ctx->rounds * AES_BLOCK_SIZE);
    aes_state_store(block, state);
}

/*
** Textbook deciphering of one block (FIPS-197, 5.3): every enciphering
** step runs in the opposite order with its inverse, and the very first
** step is the XOR with the LAST round key because that is where the
** enciphering ended.
*/
void aes_decrypt_block(const aes_ctx_t *ctx, uint8_t block[AES_BLOCK_SIZE])
{
    uint8_t state[4][4];
    size_t round;

    aes_state_load(state, block);
    aes_add_round_key(state,
        ctx->round_keys + ctx->rounds * AES_BLOCK_SIZE);
    for (round = ctx->rounds; round > 1; round--) {
        aes_inv_shift_rows(state);
        aes_inv_sub_bytes(state);
        aes_add_round_key(state, ctx->round_keys + (round - 1)
            * AES_BLOCK_SIZE);
        aes_inv_mix_columns(state);
    }
    aes_inv_shift_rows(state);
    aes_inv_sub_bytes(state);
    aes_add_round_key(state, ctx->round_keys);
    aes_state_store(block, state);
}

/*
** Successive 16 byte blocks (subject, p.5): the message is read block by
** block, the last one is padded with zeros when it is too small, and
** every ciphered block is converted back to the little endian nomenclature
** before it leaves the core. A message shorter than one block therefore
** still yields exactly one block, and an empty message yields nothing.
*/
int aes_encrypt_stream(const aes_ctx_t *ctx, const uint8_t *msg, size_t len,
    buffer_t *out)
{
    uint8_t block[AES_BLOCK_SIZE];
    size_t offset;
    size_t available;

    if (ctx == NULL || out == NULL || (msg == NULL && len > 0))
        return -1;
    for (offset = 0; offset < len; offset += AES_BLOCK_SIZE) {
        available = len - offset;
        if (available > AES_BLOCK_SIZE)
            available = AES_BLOCK_SIZE;
        memset(block, 0, sizeof(block));
        memcpy(block, msg + offset, available);
        aes_encrypt_block(ctx, block);
        aes_word_swap(block, AES_BLOCK_SIZE);
        buffer_append(out, block, AES_BLOCK_SIZE);
    }
    return 0;
}

/*
** Mirror of the enciphering stream: the little endian nomenclature is
** undone first (the hex given on the input is a number per block), then
** the textbook inverse cipher runs. A last block that is not full is
** padded with zeros exactly like the enciphering side, so both sides
** always see whole 16 byte blocks.
*/
int aes_decrypt_stream(const aes_ctx_t *ctx, const uint8_t *cipher, size_t len,
    buffer_t *out)
{
    uint8_t block[AES_BLOCK_SIZE];
    size_t offset;
    size_t available;

    if (ctx == NULL || out == NULL || (cipher == NULL && len > 0))
        return -1;
    for (offset = 0; offset < len; offset += AES_BLOCK_SIZE) {
        available = len - offset;
        if (available > AES_BLOCK_SIZE)
            available = AES_BLOCK_SIZE;
        memset(block, 0, sizeof(block));
        memcpy(block, cipher + offset, available);
        aes_word_swap(block, AES_BLOCK_SIZE);
        aes_decrypt_block(ctx, block);
        buffer_append(out, block, AES_BLOCK_SIZE);
    }
    return 0;
}

/*
** Every key problem is reported in one place, before anything is read
** from the standard input: an empty key or a key that is not 16, 24 or
** 32 bytes long stops the program with 84, and the buffer is released
** first so that the failure does not show up as a leak.
*/
static void aes_check_key(buffer_t *key)
{
    if (key->len == 0) {
        buffer_free(key);
        my_pgp_die("aes: the key must not be empty");
    }
    if (key->len != 16 && key->len != 24 && key->len != 32) {
        buffer_free(key);
        my_pgp_die("aes: the key must be 16, 24 or 32 bytes long "
            "(128, 192 or 256 bits)");
    }
}

/*
** Ciphering prints a hexadecimal number, deciphering prints bytes: both
** end with a line feed so that a shell command substitution always sees
** a complete line (subject, p.5).
*/
static void aes_print_result(const buffer_t *result, const cli_options_t *opts)
{
    if (opts->mode == MODE_CIPHER)
        my_put_hex_line(result->data, result->len);
    else
        my_put_message(result->data, result->len);
}

/*
** Entry point for `./my_pgp aes`. Everything is validated before the
** first block is touched, and every buffer is released before the error
** path terminates the process with 84, so a failure never shows up as a
** leak in valgrind.
*/
int run_aes(const cli_options_t *opts)
{
    aes_ctx_t ctx;
    buffer_t key;
    buffer_t input;
    buffer_t message = buffer_new();
    buffer_t result = buffer_new();
    int rc;

    if (opts == NULL)
        return -1;
    key = hex_to_bytes(opts->key);
    aes_check_key(&key);
    input = opts->block_mode ? io_read_line_buffer() : io_read_all();
    if (opts->mode == MODE_CIPHER)
        message = input;
    else {
        rc = io_hex_decode(&input, &message);
        buffer_free(&input);
        if (rc == -2) {
            buffer_free(&key);
            my_pgp_die("aes: the message is not a valid hexadecimal number");
        }
        if (rc != 0) {
            buffer_free(&key);
            my_pgp_die("out of memory");
        }
    }
    if (opts->block_mode && message.len != AES_BLOCK_SIZE) {
        buffer_free(&key);
        buffer_free(&message);
        my_pgp_die("aes: -b requires the message to be exactly one "
            "AES block (16 bytes)");
    }
    aes_word_swap(key.data, key.len);
    if (aes_key_schedule(&ctx, key.data, key.len) != 0) {
        buffer_free(&key);
        buffer_free(&message);
        buffer_free(&result);
        my_pgp_die("aes: the key could not be expanded");
    }
    /*
    ** Block mode and stream mode share the same code: -b only forces the
    ** message to be exactly one 16 byte block, which the stream already
    ** is (nothing to pad, one round of work).
    */
    if (opts->mode == MODE_CIPHER)
        rc = aes_encrypt_stream(&ctx, message.data, message.len, &result);
    else
        rc = aes_decrypt_stream(&ctx, message.data, message.len, &result);
    if (rc != 0) {
        buffer_free(&key);
        buffer_free(&message);
        buffer_free(&result);
        my_pgp_die("aes: the message could not be processed");
    }
    aes_print_result(&result, opts);
    buffer_free(&key);
    buffer_free(&message);
    buffer_free(&result);
    return 0;
}
