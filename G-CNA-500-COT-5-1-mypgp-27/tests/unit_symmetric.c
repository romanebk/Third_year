/*
** EPITECH PROJECT, 2026
** unit_symmetric.c
** File description:
** Criterion unit tests: XOR and AES (primitives, vectors, run_* entries)
*/

#include <criterion/criterion.h>
#include <criterion/redirect.h>
#include <stdio.h>
#include <stdlib.h>

#include "aes.h"
#include "buffer.h"
#include "hex.h"
#include "xor.h"
#include "unit_helpers.h"

#define XOR_KEY "576861742069732064656164206d6179206e6576657220646965"
#define XOR_VEC "20070f2700071c6a4449060a490515164e4e12190b190011063c"
#define AES_KEY "57696e74657220697320636f6d696e67"
#define AES_VEC "744ce22c385958348f0df26eceb62eef"

static void sym_setup(void)
{
    redirect_all();
}

/* ------------------------------------------------------ XOR primitives */

Test(xor_block, pairs_message_backwards_with_key)
{
    buffer_t out = buffer_new();
    uint8_t expected[] = { 0x18, 0x1a };

    cr_assert_eq(xor_encrypt_block((const uint8_t *)"XY",
        (const uint8_t *)"AB", 2, &out), 0);
    cr_assert_arr_eq(out.data, expected, 2);
    buffer_free(&out);
}

Test(xor_block, decrypt_is_the_inverse)
{
    buffer_t out = buffer_new();
    uint8_t cipher[] = { 0x18, 0x1a };

    cr_assert_eq(xor_decrypt_block(cipher, (const uint8_t *)"AB", 2, &out),
        0);
    cr_assert_arr_eq(out.data, "XY", 2);
    buffer_free(&out);
}

Test(xor_block, rejects_bad_arguments)
{
    buffer_t out = buffer_new();

    cr_assert_eq(xor_encrypt_block((const uint8_t *)"a", NULL, 1, &out), -1);
    cr_assert_eq(xor_encrypt_block((const uint8_t *)"a",
        (const uint8_t *)"k", 0, &out), -1);
    cr_assert_eq(xor_decrypt_block((const uint8_t *)"a",
        (const uint8_t *)"k", 1, NULL), -1);
    cr_assert_eq(xor_encrypt_stream((const uint8_t *)"a", 1, NULL, 1, &out),
        -1);
    cr_assert_eq(xor_decrypt_stream((const uint8_t *)"a", 1,
        (const uint8_t *)"k", 0, &out), -1);
}

Test(xor_stream, pads_last_chunk_and_roundtrips)
{
    buffer_t cipher = buffer_new();
    buffer_t plain = buffer_new();
    const uint8_t key[] = { 0x01, 0x02, 0x03 };
    uint8_t expected[] = { 'A', 'B', 'C', 'D', 'E', 0 };

    cr_assert_eq(xor_encrypt_stream((const uint8_t *)"ABCDE", 5, key, 3,
        &cipher), 0);
    cr_assert_eq(cipher.len, 6);
    cr_assert_eq(xor_decrypt_stream(cipher.data, cipher.len, key, 3,
        &plain), 0);
    cr_assert_eq(plain.len, 6);
    cr_assert_arr_eq(plain.data, expected, 6);
    buffer_free(&cipher);
    buffer_free(&plain);
}

Test(xor_stream, empty_message_gives_nothing)
{
    buffer_t out = buffer_new();

    cr_assert_eq(xor_encrypt_stream(NULL, 0, (const uint8_t *)"k", 1, &out),
        0);
    cr_assert_eq(out.len, 0);
}

/* --------------------------------------------------------- run_xor */

Test(run_xor, subject_vector_cipher, .init = sym_setup)
{
    cli_options_t opts = make_opts(CRYPTO_XOR, MODE_CIPHER, true, XOR_KEY);

    feed_str("You know nothing, Jon Snow\n");
    cr_assert_eq(run_xor(&opts), 0);
    assert_stdout(XOR_VEC "\n");
}

Test(run_xor, subject_vector_decipher, .init = sym_setup)
{
    cli_options_t opts = make_opts(CRYPTO_XOR, MODE_DECIPHER, true, XOR_KEY);

    feed_str(XOR_VEC "\n");
    cr_assert_eq(run_xor(&opts), 0);
    assert_stdout("You know nothing, Jon Snow\n");
}

Test(run_xor, stream_cipher, .init = sym_setup)
{
    cli_options_t opts = make_opts(CRYPTO_XOR, MODE_CIPHER, false, "4142");

    feed_str("Hello world!!\n");
    cr_assert_eq(run_xor(&opts), 0);
    assert_stdout("240a2d2e612d2e352d3060264163\n");
}

Test(run_xor, stream_decipher_keeps_padding, .init = sym_setup)
{
    cli_options_t opts = make_opts(CRYPTO_XOR, MODE_DECIPHER, false, "4142");

    feed_str("280a\n");
    cr_assert_eq(run_xor(&opts), 0);
    assert_stdout("Hi\n");
}

Test(run_xor, null_options)
{
    cr_assert_eq(run_xor(NULL), -1);
}

Test(run_xor, empty_key, .init = sym_setup, .exit_code = 84)
{
    cli_options_t opts = make_opts(CRYPTO_XOR, MODE_CIPHER, false, "");

    feed_str("x");
    run_xor(&opts);
}

Test(run_xor, block_size_mismatch, .init = sym_setup, .exit_code = 84)
{
    cli_options_t opts = make_opts(CRYPTO_XOR, MODE_CIPHER, true, "4142");

    feed_str("abc\n");
    run_xor(&opts);
}

Test(run_xor, decipher_invalid_hex, .init = sym_setup, .exit_code = 84)
{
    cli_options_t opts = make_opts(CRYPTO_XOR, MODE_DECIPHER, false, "41");

    feed_str("zz\n");
    run_xor(&opts);
}

Test(run_xor, decipher_block_size_mismatch, .init = sym_setup,
    .exit_code = 84)
{
    cli_options_t opts = make_opts(CRYPTO_XOR, MODE_DECIPHER, true, "4142");

    feed_str("41\n");
    run_xor(&opts);
}

/* ------------------------------------------------------ AES primitives */

Test(aes_state, load_and_store_by_columns)
{
    uint8_t block[16];
    uint8_t back[16];
    uint8_t state[4][4];
    size_t i;

    for (i = 0; i < 16; i++)
        block[i] = (uint8_t)i;
    aes_state_load(state, block);
    cr_assert_eq(state[1][0], 1);
    cr_assert_eq(state[0][1], 4);
    cr_assert_eq(state[3][3], 15);
    aes_state_store(back, state);
    cr_assert_arr_eq(back, block, 16);
}

Test(aes_sub_bytes, fips197_sbox_values_and_inverse)
{
    uint8_t state[4][4] = { { 0x53, 0x00 }, { 0xff } };

    aes_sub_bytes(state);
    cr_assert_eq(state[0][0], 0xed);
    cr_assert_eq(state[0][1], 0x63);
    cr_assert_eq(state[1][0], 0x16);
    aes_inv_sub_bytes(state);
    cr_assert_eq(state[0][0], 0x53);
    cr_assert_eq(state[0][1], 0x00);
    cr_assert_eq(state[1][0], 0xff);
}

Test(aes_shift_rows, rotates_row_r_by_r)
{
    uint8_t state[4][4] = {
        { 0, 1, 2, 3 }, { 4, 5, 6, 7 }, { 8, 9, 10, 11 }, { 12, 13, 14, 15 }
    };
    uint8_t row1[4] = { 5, 6, 7, 4 };
    uint8_t row2[4] = { 10, 11, 8, 9 };
    uint8_t row3[4] = { 15, 12, 13, 14 };
    uint8_t row0[4] = { 0, 1, 2, 3 };

    aes_shift_rows(state);
    cr_assert_arr_eq(state[0], row0, 4);
    cr_assert_arr_eq(state[1], row1, 4);
    cr_assert_arr_eq(state[2], row2, 4);
    cr_assert_arr_eq(state[3], row3, 4);
    aes_inv_shift_rows(state);
    cr_assert_eq(state[1][0], 4);
    cr_assert_eq(state[3][0], 12);
}

Test(aes_mix_columns, fips197_column_example_and_inverse)
{
    uint8_t state[4][4] = { { 0xdb }, { 0x13 }, { 0x53 }, { 0x45 } };

    aes_mix_columns(state);
    cr_assert_eq(state[0][0], 0x8e);
    cr_assert_eq(state[1][0], 0x4d);
    cr_assert_eq(state[2][0], 0xa1);
    cr_assert_eq(state[3][0], 0xbc);
    aes_inv_mix_columns(state);
    cr_assert_eq(state[0][0], 0xdb);
    cr_assert_eq(state[1][0], 0x13);
    cr_assert_eq(state[2][0], 0x53);
    cr_assert_eq(state[3][0], 0x45);
}

Test(aes_add_round_key, xors_column_by_column)
{
    uint8_t state[4][4] = { { 0 } };
    uint8_t key[16];
    size_t i;

    for (i = 0; i < 16; i++)
        key[i] = (uint8_t)(i + 1);
    aes_add_round_key(state, key);
    cr_assert_eq(state[0][0], 1);
    cr_assert_eq(state[1][0], 2);
    cr_assert_eq(state[0][1], 5);
}

Test(aes_word_swap, reverses_every_word)
{
    uint8_t bytes[] = { 1, 2, 3, 4, 5, 6, 7, 8, 9 };
    uint8_t expected[] = { 4, 3, 2, 1, 8, 7, 6, 5, 9 };

    aes_word_swap(bytes, 9);
    cr_assert_arr_eq(bytes, expected, 9);
}

Test(aes_key_schedule, fips197_aes128_expansion)
{
    aes_ctx_t ctx;
    const uint8_t key[16] = {
        0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6,
        0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c
    };
    const uint8_t w4[4] = { 0xa0, 0xfa, 0xfe, 0x17 };
    const uint8_t w43[4] = { 0xb6, 0x63, 0x0c, 0xa6 };

    cr_assert_eq(aes_key_schedule(&ctx, key, 16), 0);
    cr_assert_eq(ctx.rounds, 10);
    cr_assert_arr_eq(ctx.round_keys + 16, w4, 4);
    cr_assert_arr_eq(ctx.round_keys + 172, w43, 4);
}

Test(aes_key_schedule, round_counts_and_errors)
{
    aes_ctx_t ctx;
    uint8_t key[32] = { 0 };

    cr_assert_eq(aes_key_schedule(&ctx, key, 24), 0);
    cr_assert_eq(ctx.rounds, 12);
    cr_assert_eq(aes_key_schedule(&ctx, key, 32), 0);
    cr_assert_eq(ctx.rounds, 14);
    cr_assert_eq(aes_key_schedule(&ctx, key, 18), -1);
    cr_assert_eq(aes_key_schedule(&ctx, key, 12), -1);
    cr_assert_eq(aes_key_schedule(&ctx, key, 0), -1);
    cr_assert_eq(aes_key_schedule(NULL, key, 16), -1);
    cr_assert_eq(aes_key_schedule(&ctx, NULL, 16), -1);
}

/* FIPS-197 appendix C: plaintext 00112233...ff, key 000102... */
static void check_fips(size_t key_len, const char *expected_hex)
{
    aes_ctx_t ctx;
    uint8_t key[32];
    uint8_t block[16];
    uint8_t plain[16];
    buffer_t expected = hex_to_bytes(expected_hex);
    size_t i;

    for (i = 0; i < key_len; i++)
        key[i] = (uint8_t)i;
    for (i = 0; i < 16; i++)
        plain[i] = (uint8_t)(i * 0x11);
    memcpy(block, plain, 16);
    cr_assert_eq(aes_key_schedule(&ctx, key, key_len), 0);
    aes_encrypt_block(&ctx, block);
    cr_assert_arr_eq(block, expected.data, 16);
    aes_decrypt_block(&ctx, block);
    cr_assert_arr_eq(block, plain, 16);
    buffer_free(&expected);
}

Test(aes_block, fips197_aes128)
{
    check_fips(16, "69c4e0d86a7b0430d8cdb78070b4c55a");
}

Test(aes_block, fips197_aes192)
{
    check_fips(24, "dda97ca4864cdfe06eaf70a0ec0d7191");
}

Test(aes_block, fips197_aes256)
{
    check_fips(32, "8ea2b7ca516745bfeafc49904b496089");
}

Test(aes_stream, roundtrip_with_padding_and_errors)
{
    aes_ctx_t ctx;
    uint8_t key[16] = { 7 };
    buffer_t cipher = buffer_new();
    buffer_t plain = buffer_new();
    const char *msg = "twenty bytes long !!";

    cr_assert_eq(aes_key_schedule(&ctx, key, 16), 0);
    cr_assert_eq(aes_encrypt_stream(&ctx, (const uint8_t *)msg, 20,
        &cipher), 0);
    cr_assert_eq(cipher.len, 32);
    cr_assert_eq(aes_decrypt_stream(&ctx, cipher.data, 32, &plain), 0);
    cr_assert_eq(plain.len, 32);
    cr_assert_arr_eq(plain.data, msg, 20);
    cr_assert_eq(plain.data[31], 0);
    cr_assert_eq(aes_encrypt_stream(NULL, NULL, 0, &cipher), -1);
    cr_assert_eq(aes_decrypt_stream(&ctx, NULL, 4, &plain), -1);
    cr_assert_eq(aes_decrypt_stream(&ctx, cipher.data, 32, NULL), -1);
    buffer_free(&cipher);
    buffer_free(&plain);
}

/* --------------------------------------------------------- run_aes */

Test(run_aes, subject_vector_cipher, .init = sym_setup)
{
    cli_options_t opts = make_opts(CRYPTO_AES, MODE_CIPHER, true, AES_KEY);

    feed_str("All men must die\n");
    cr_assert_eq(run_aes(&opts), 0);
    assert_stdout(AES_VEC "\n");
}

Test(run_aes, subject_vector_decipher, .init = sym_setup)
{
    cli_options_t opts = make_opts(CRYPTO_AES, MODE_DECIPHER, true, AES_KEY);

    feed_str(AES_VEC "\n");
    cr_assert_eq(run_aes(&opts), 0);
    assert_stdout("All men must die\n");
}

Test(run_aes, stream_aes192, .init = sym_setup)
{
    cli_options_t opts = make_opts(CRYPTO_AES, MODE_CIPHER, false,
        "000102030405060708090a0b0c0d0e0f1011121314151617");

    feed_str("hello");
    cr_assert_eq(run_aes(&opts), 0);
    assert_stdout("0e073b7d8e81b57a9bf3ef86b946677d\n");
}

Test(run_aes, stream_aes256, .init = sym_setup)
{
    cli_options_t opts = make_opts(CRYPTO_AES, MODE_CIPHER, false,
        "000102030405060708090a0b0c0d0e0f"
        "101112131415161718191a1b1c1d1e1f");

    feed_str("hello");
    cr_assert_eq(run_aes(&opts), 0);
    assert_stdout("cfcbe188f70048fa6dafb9b715163c37\n");
}

Test(run_aes, null_options)
{
    cr_assert_eq(run_aes(NULL), -1);
}

Test(run_aes, empty_key, .init = sym_setup, .exit_code = 84)
{
    cli_options_t opts = make_opts(CRYPTO_AES, MODE_CIPHER, false, "");

    feed_str("x");
    run_aes(&opts);
}

Test(run_aes, key_of_invalid_size, .init = sym_setup, .exit_code = 84)
{
    cli_options_t opts = make_opts(CRYPTO_AES, MODE_CIPHER, false, "4142");

    feed_str("x");
    run_aes(&opts);
}

Test(run_aes, block_not_16_bytes, .init = sym_setup, .exit_code = 84)
{
    cli_options_t opts = make_opts(CRYPTO_AES, MODE_CIPHER, true, AES_KEY);

    feed_str("too short\n");
    run_aes(&opts);
}

Test(run_aes, decipher_invalid_hex, .init = sym_setup, .exit_code = 84)
{
    cli_options_t opts = make_opts(CRYPTO_AES, MODE_DECIPHER, false,
        AES_KEY);

    feed_str("not hex\n");
    run_aes(&opts);
}
