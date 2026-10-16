/*
** EPITECH PROJECT, 2026
** unit_asymmetric.c
** File description:
** Criterion unit tests: RSA, PGP-XOR, PGP-AES and ElGamal
*/

#include <criterion/criterion.h>
#include <criterion/redirect.h>
#include <stdio.h>
#include <stdlib.h>

#include "bigint.h"
#include "elgamal.h"
#include "pgp_aes.h"
#include "pgp_xor.h"
#include "rsa.h"
#include "unit_helpers.h"

#define PUB "010001-c9f91a9ff3bd6d84005b9cc8448296330bd23480f8cf8b36fd4e" \
    "dd0a8cd925de139a0076b962f4d57f50d6f9e64e7c41587784488f923dd60136c76" \
    "3fd602fb3"
#define PRIV "81b08f4eb6dd8a4dd21728e5194dfc4e349829c9991c8b5e44b31e6cee" \
    "e1e56a11d66ef23389be92ef7a4178470693f509c90b86d4a1e1831056ca0757f3e" \
    "209-c9f91a9ff3bd6d84005b9cc8448296330bd23480f8cf8b36fd4edd0a8cd925d" \
    "e139a0076b962f4d57f50d6f9e64e7c41587784488f923dd60136c763fd602fb3"
#define P256 "4b1da73924978f2e9c1f04170e46820d648edbee12ccf4d4462af89b08" \
    "0c86e1"
#define Q256 "bb3ca1e126f7c8751bd81bc8daa226494efb3d128f72ed9f6cacbe96e1" \
    "4166cb"
#define NIGHT "445b349e7318ad6af16b0bbb718be88ba1c41751f95751cd58857f88f" \
    "e31f970405c6ec3f16d79172543bf4e571b5596d212f3e79cd08ef14abd244e325b80"
#define AES_KEY "57696e74657220697320636f6d696e67"
#define AES_SYM_C "97f2af4c1b712008c1e46935f446756443a8a700f20581d138e4e6" \
    "916afe5c5f9b9d6eaa0a870374b686f1a024f9bbb88c23c766654579339caf55afd1" \
    "49d41d"
#define EG_P "d5da1a8d443812956185f9fe2d8696ea4959d3415967c7a8c5fec34bf7d" \
    "d53e1"

static void asym_setup(void)
{
    redirect_all();
}

static cli_options_t opts_of(crypto_system_t c, crypto_mode_t m, bool b,
    const char *key)
{
    return make_opts(c, m, b, key);
}

/* -------------------------------------------------------- RSA maths */

Test(rsa_math, lambda_e_and_d_of_the_subject_example)
{
    biguint_t p = biguint_from_u64(211);
    biguint_t q = biguint_from_u64(227);
    biguint_t lambda = rsa_carmichael_lambda(&p, &q);
    biguint_t e = rsa_pick_e(&lambda);
    biguint_t d = rsa_compute_d(&e, &lambda);
    char *hex = rsa_biguint_to_hex(&d);

    cr_assert_eq(lambda.limbs[0], 23730);
    cr_assert_eq(e.limbs[0], 257);
    cr_assert_eq(d.limbs[0], 23453);
    cr_assert_str_eq(hex, "9d5b");
    free(hex);
    biguint_free(&p);
    biguint_free(&q);
    biguint_free(&lambda);
    biguint_free(&e);
    biguint_free(&d);
}

Test(rsa_math, biggest_fermat_prime_is_preferred)
{
    biguint_t lambda = biguint_from_u64(1000000);
    biguint_t e;

    lambda.limbs[0] = 1000003;
    e = rsa_pick_e(&lambda);
    cr_assert_eq(e.limbs[0], 65537);
    biguint_free(&e);
    biguint_free(&lambda);
}

Test(rsa_math, no_fermat_prime_fits, .init = asym_setup, .exit_code = 84)
{
    biguint_t lambda = biguint_from_u64(2);

    rsa_pick_e(&lambda);
}

Test(rsa_math, non_invertible_e, .init = asym_setup, .exit_code = 84)
{
    biguint_t e = biguint_from_u64(4);
    biguint_t lambda = biguint_from_u64(8);

    rsa_compute_d(&e, &lambda);
}

Test(rsa_parse_key, reads_exponent_and_modulus)
{
    rsa_key_t key = rsa_parse_key("0101-19bb");

    cr_assert_eq(key.exponent.limbs[0], 257);
    cr_assert_eq(key.modulus.limbs[0], 47897);
    rsa_key_free(&key);
}

Test(rsa_parse_key, missing_dash, .init = asym_setup, .exit_code = 84)
{
    rsa_parse_key("010119bb");
}

/* ---------------------------------------------------------- run_rsa */

Test(run_rsa, keygen_small_subject_example, .init = asym_setup)
{
    cli_options_t opts = make_gen(CRYPTO_RSA, "d3", "e3");

    run_rsa(&opts);
    assert_stdout("public key: 0101-19bb\nprivate key: 9d5b-19bb\n");
}

Test(run_rsa, keygen_256_bits_subject_example, .init = asym_setup)
{
    cli_options_t opts = make_gen(CRYPTO_RSA, P256, Q256);

    run_rsa(&opts);
    assert_stdout("public key: " PUB "\nprivate key: " PRIV "\n");
}

Test(run_rsa, keygen_equal_primes_is_not_refused, .init = asym_setup)
{
    cli_options_t opts = make_gen(CRYPTO_RSA, "d3", "d3");

    run_rsa(&opts);
    assert_stdout("public key: 11-e9ad\nprivate key: ad-e9ad\n");
}

Test(run_rsa, keygen_invalid_hex, .init = asym_setup, .exit_code = 84)
{
    cli_options_t opts = make_gen(CRYPTO_RSA, "zz", "e3");

    run_rsa(&opts);
}

Test(run_rsa, keygen_zero_prime_is_an_error_not_a_crash,
    .init = asym_setup, .exit_code = 84)
{
    cli_options_t opts = make_gen(CRYPTO_RSA, "00", "e3");

    run_rsa(&opts);
}

Test(run_rsa, keygen_empty_prime, .init = asym_setup, .exit_code = 84)
{
    cli_options_t opts = make_gen(CRYPTO_RSA, "e3", "");

    run_rsa(&opts);
}

Test(run_rsa, keygen_ones, .init = asym_setup, .exit_code = 84)
{
    cli_options_t opts = make_gen(CRYPTO_RSA, "01", "01");

    run_rsa(&opts);
}

Test(run_rsa, cipher_wf, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_RSA, MODE_CIPHER, false, "0101-19bb");

    feed_str("WF\n");
    run_rsa(&opts);
    assert_stdout("8f84\n");
}

Test(run_rsa, decipher_wf_with_blanks, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_RSA, MODE_DECIPHER, false,
        "9d5b-19bb");

    feed_str(" 8F84\r\n");
    run_rsa(&opts);
    assert_stdout("WF\n");
}

Test(run_rsa, cipher_subject_256_bits, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_RSA, MODE_CIPHER, true, PUB);

    feed_str("The night is dark and full of terrors\n");
    run_rsa(&opts);
    assert_stdout(NIGHT "\n");
}

Test(run_rsa, decipher_subject_256_bits, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_RSA, MODE_DECIPHER, false, PRIV);

    feed_str(NIGHT "\n");
    run_rsa(&opts);
    assert_stdout("The night is dark and full of terrors\n");
}

Test(run_rsa, empty_message_and_zero, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_RSA, MODE_CIPHER, false, "0101-19bb");

    feed_str("");
    run_rsa(&opts);
    assert_stdout("00\n");
}

Test(run_rsa, decipher_zero_prints_an_empty_line, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_RSA, MODE_DECIPHER, false,
        "9d5b-19bb");

    feed_str("00\n");
    run_rsa(&opts);
    assert_stdout("\n");
}

Test(run_rsa, message_too_large, .init = asym_setup, .exit_code = 84)
{
    cli_options_t opts = opts_of(CRYPTO_RSA, MODE_CIPHER, false, "0101-19bb");

    feed_str("far too long for this key\n");
    run_rsa(&opts);
}

Test(run_rsa, zero_modulus, .init = asym_setup, .exit_code = 84)
{
    cli_options_t opts = opts_of(CRYPTO_RSA, MODE_CIPHER, false, "0101-00");

    feed_str("A\n");
    run_rsa(&opts);
}

Test(run_rsa, decipher_invalid_hex, .init = asym_setup, .exit_code = 84)
{
    cli_options_t opts = opts_of(CRYPTO_RSA, MODE_DECIPHER, false,
        "9d5b-19bb");

    feed_str("xyz\n");
    run_rsa(&opts);
}

/* ---------------------------------------------------------- PGP-XOR */

Test(run_pgp_xor, block_cipher, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_XOR, MODE_CIPHER, true,
        "4142:0101-19bb");

    feed_str("Hi\n");
    cr_assert_eq(run_pgp_xor(&opts), 0);
    assert_stdout("3422\n280a\n");
}

Test(run_pgp_xor, block_decipher, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_XOR, MODE_DECIPHER, true,
        "3422:9d5b-19bb");

    feed_str("280a\n");
    cr_assert_eq(run_pgp_xor(&opts), 0);
    assert_stdout("Hi\n");
}

Test(run_pgp_xor, block_key_ending_with_zero, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_XOR, MODE_DECIPHER, true,
        "1c09:9d5b-19bb");

    feed_str("2848\n");
    cr_assert_eq(run_pgp_xor(&opts), 0);
    assert_stdout("Hi\n");
}

Test(run_pgp_xor, stream_subject_key, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_XOR, MODE_CIPHER, false,
        "576861742069732064656164206d6179206e6576657220646965:" PUB);

    feed_str("You know nothing, Jon Snow\n");
    cr_assert_eq(run_pgp_xor(&opts), 0);
    assert_stdout("8e157dad5de9b552327bbc0979312c6ae634d8f1d868c0a5a0910c7f"
        "87475c78061bd110bf36d908ecbb7549bbfc29f3431eae5789bbac30fbf27c75e7"
        "b4433e\n20070f2700071c6a4449060a490515164e4e12190b190011063c\n");
}

Test(run_pgp_xor, stream_key_ending_with_zero, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_XOR, MODE_DECIPHER, false,
        "9bbaaf7f154afe0279b08156ab9e820d2443dcb92b6ca8a7bd06fc691c629017e7"
        "ff1a9b5ae6eb987b6d509f95b0176d1edda88f12a7f5d561608cbcb0f1549c:"
        PRIV);

    char out[32] = { 0 };
    size_t len;

    feed_str("2d2e26482e35636f41262f72\n");
    cr_assert_eq(run_pgp_xor(&opts), 0);
    fflush(stdout);
    len = fread(out, 1, sizeof(out), cr_get_redirected_stdout());
    cr_assert_eq(len, 13);
    cr_assert_arr_eq(out, "Hello world\0\n", 13);
}

/* Binary message, key ending with 0: no size gives clean text. */
Test(run_pgp_xor, stream_ambiguous_binary_falls_back, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_XOR, MODE_DECIPHER, false,
        "9bbaaf7f154afe0279b08156ab9e820d2443dcb92b6ca8a7bd06fc691c629017e7"
        "ff1a9b5ae6eb987b6d509f95b0176d1edda88f12a7f5d561608cbcb0f1549c:"
        PRIV);

    feed_str("4541410149454505414e4809\n");
    cr_assert_eq(run_pgp_xor(&opts), 0);
}

Test(run_pgp_xor, null_options)
{
    cr_assert_eq(run_pgp_xor(NULL), -1);
}

static void pgp_xor_fails(crypto_mode_t mode, bool block, const char *key,
    const char *input)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_XOR, mode, block, key);

    feed_str(input);
    run_pgp_xor(&opts);
}

Test(run_pgp_xor, generate_mode, .init = asym_setup, .exit_code = 84)
{
    cli_options_t opts = make_gen(CRYPTO_PGP_XOR, "d3", "e3");

    run_pgp_xor(&opts);
}

Test(run_pgp_xor, no_colon, .init = asym_setup, .exit_code = 84)
{
    pgp_xor_fails(MODE_CIPHER, false, "4142", "Hi");
}

Test(run_pgp_xor, two_colons, .init = asym_setup, .exit_code = 84)
{
    pgp_xor_fails(MODE_CIPHER, false, "41:42:0101-19bb", "Hi");
}

Test(run_pgp_xor, empty_symmetric_key, .init = asym_setup, .exit_code = 84)
{
    pgp_xor_fails(MODE_CIPHER, false, ":0101-19bb", "Hi");
}

Test(run_pgp_xor, empty_rsa_key, .init = asym_setup, .exit_code = 84)
{
    pgp_xor_fails(MODE_CIPHER, false, "4142:", "Hi");
}

Test(run_pgp_xor, invalid_symmetric_hex, .init = asym_setup,
    .exit_code = 84)
{
    pgp_xor_fails(MODE_CIPHER, false, "zz:0101-19bb", "Hi");
}

Test(run_pgp_xor, rsa_key_without_dash, .init = asym_setup, .exit_code = 84)
{
    pgp_xor_fails(MODE_CIPHER, false, "4142:010119bb", "Hi");
}

Test(run_pgp_xor, rsa_exponent_not_hex, .init = asym_setup,
    .exit_code = 84)
{
    pgp_xor_fails(MODE_CIPHER, false, "4142:zz-19bb", "Hi");
}

Test(run_pgp_xor, rsa_modulus_not_hex, .init = asym_setup,
    .exit_code = 84)
{
    pgp_xor_fails(MODE_CIPHER, false, "4142:0101-1g", "Hi");
}

Test(run_pgp_xor, zero_exponent, .init = asym_setup, .exit_code = 84)
{
    pgp_xor_fails(MODE_CIPHER, false, "4142:00-19bb", "Hi");
}

Test(run_pgp_xor, symmetric_key_too_large, .init = asym_setup,
    .exit_code = 84)
{
    pgp_xor_fails(MODE_CIPHER, false, "ffffff:0101-19bb", "Hi");
}

Test(run_pgp_xor, block_size_mismatch, .init = asym_setup,
    .exit_code = 84)
{
    pgp_xor_fails(MODE_CIPHER, true, "4142:0101-19bb", "abc\n");
}

Test(run_pgp_xor, decipher_invalid_symmetric_hex, .init = asym_setup,
    .exit_code = 84)
{
    pgp_xor_fails(MODE_DECIPHER, false, "zz:9d5b-19bb", "280a");
}

Test(run_pgp_xor, decipher_zero_modulus, .init = asym_setup,
    .exit_code = 84)
{
    pgp_xor_fails(MODE_DECIPHER, false, "3422:9d5b-00", "280a");
}

Test(run_pgp_xor, decipher_key_too_large, .init = asym_setup,
    .exit_code = 84)
{
    pgp_xor_fails(MODE_DECIPHER, false, "ffffff:9d5b-19bb", "280a");
}

Test(run_pgp_xor, decipher_invalid_message, .init = asym_setup,
    .exit_code = 84)
{
    pgp_xor_fails(MODE_DECIPHER, false, "3422:9d5b-19bb", "nothex");
}

Test(run_pgp_xor, decipher_block_message_too_short, .init = asym_setup,
    .exit_code = 84)
{
    pgp_xor_fails(MODE_DECIPHER, true, "3422:9d5b-19bb", "28\n");
}

/* ---------------------------------------------------------- PGP-AES */

Test(run_pgp_aes, subject_block_cipher, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_AES, MODE_CIPHER, true,
        AES_KEY ":" PUB);

    feed_str("All men must die\n");
    cr_assert_eq(run_pgp_aes(&opts), 0);
    assert_stdout(AES_SYM_C "\n744ce22c385958348f0df26eceb62eef\n");
}

Test(run_pgp_aes, subject_block_decipher, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_AES, MODE_DECIPHER, true,
        AES_SYM_C ":" PRIV);

    feed_str("744ce22c385958348f0df26eceb62eef\n");
    cr_assert_eq(run_pgp_aes(&opts), 0);
    assert_stdout("All men must die\n");
}

Test(run_pgp_aes, key_128_ending_with_zero, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_AES, MODE_DECIPHER, true,
        "400e04d141e65d8b8bede1fbcdea5731229bf1b875832d0d72841645f05e23b3"
        "d3fc6406bc684f01140ee08cf31dfe7976a416a1359cf3c77a2f9a9b7ab17734:"
        PRIV);

    feed_str("68134afd5714fdf9a1235318694bcba9\n");
    cr_assert_eq(run_pgp_aes(&opts), 0);
    assert_stdout("All men must die\n");
}

Test(run_pgp_aes, key_192_ending_with_zero, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_AES, MODE_DECIPHER, true,
        "2e25d9191f9c530643cf8821871818e087c90df8cafe716e98e84b9974862ba2"
        "ab70bf7566b02c46efca55304da129d99709c441db2ed6ccf747011922f33b09:"
        PRIV);

    feed_str("a9044eb60e69ec67888b515081a8febb\n");
    cr_assert_eq(run_pgp_aes(&opts), 0);
    assert_stdout("All men must die\n");
}

Test(run_pgp_aes, key_256_ending_with_zero, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_AES, MODE_DECIPHER, true,
        "41d5b7d3f48735801dd17c7391a3943198977c79b77a9887f9bb3e46e608915b"
        "b0975267837ee9308008e5bdbffc06d36714d414fb05939933f496b0036b475e:"
        PRIV);

    feed_str("09e84563c8c4418af77e9ba68ba25da7\n");
    cr_assert_eq(run_pgp_aes(&opts), 0);
    assert_stdout("All men must die\n");
}

Test(run_pgp_aes, null_options)
{
    cr_assert_eq(run_pgp_aes(NULL), -1);
}

static void pgp_aes_fails(crypto_mode_t mode, bool block, const char *key,
    const char *input)
{
    cli_options_t opts = opts_of(CRYPTO_PGP_AES, mode, block, key);

    feed_str(input);
    run_pgp_aes(&opts);
}

Test(run_pgp_aes, generate_mode, .init = asym_setup, .exit_code = 84)
{
    cli_options_t opts = make_gen(CRYPTO_PGP_AES, "d3", "e3");

    run_pgp_aes(&opts);
}

Test(run_pgp_aes, no_colon, .init = asym_setup, .exit_code = 84)
{
    pgp_aes_fails(MODE_CIPHER, false, AES_KEY, "x");
}

Test(run_pgp_aes, two_colons, .init = asym_setup, .exit_code = 84)
{
    pgp_aes_fails(MODE_CIPHER, false, "a:b:" PUB, "x");
}

Test(run_pgp_aes, empty_side, .init = asym_setup, .exit_code = 84)
{
    pgp_aes_fails(MODE_CIPHER, false, AES_KEY ":", "x");
}

Test(run_pgp_aes, invalid_symmetric_hex, .init = asym_setup,
    .exit_code = 84)
{
    pgp_aes_fails(MODE_CIPHER, false, "zz:" PUB, "x");
}

Test(run_pgp_aes, wrong_aes_key_size, .init = asym_setup, .exit_code = 84)
{
    pgp_aes_fails(MODE_CIPHER, false, "4142:" PUB, "x");
}

Test(run_pgp_aes, rsa_key_without_dash, .init = asym_setup,
    .exit_code = 84)
{
    pgp_aes_fails(MODE_CIPHER, false, AES_KEY ":010001", "x");
}

Test(run_pgp_aes, rsa_exponent_not_hex, .init = asym_setup,
    .exit_code = 84)
{
    pgp_aes_fails(MODE_CIPHER, false, AES_KEY ":xx-19bb", "x");
}

Test(run_pgp_aes, rsa_modulus_not_hex, .init = asym_setup,
    .exit_code = 84)
{
    pgp_aes_fails(MODE_CIPHER, false, AES_KEY ":0101-xx", "x");
}

Test(run_pgp_aes, zero_modulus, .init = asym_setup, .exit_code = 84)
{
    pgp_aes_fails(MODE_CIPHER, false, AES_KEY ":0101-00", "x");
}

Test(run_pgp_aes, key_too_large_for_rsa, .init = asym_setup,
    .exit_code = 84)
{
    pgp_aes_fails(MODE_CIPHER, false, AES_KEY ":0101-19bb", "x");
}

Test(run_pgp_aes, block_not_16_bytes, .init = asym_setup, .exit_code = 84)
{
    pgp_aes_fails(MODE_CIPHER, true, AES_KEY ":" PUB, "short\n");
}

Test(run_pgp_aes, decipher_invalid_symmetric_hex, .init = asym_setup,
    .exit_code = 84)
{
    pgp_aes_fails(MODE_DECIPHER, false, "zz:" PRIV, "00");
}

Test(run_pgp_aes, decipher_zero_exponent, .init = asym_setup,
    .exit_code = 84)
{
    pgp_aes_fails(MODE_DECIPHER, false, "01:00-19bb", "00");
}

Test(run_pgp_aes, decipher_key_too_large, .init = asym_setup,
    .exit_code = 84)
{
    pgp_aes_fails(MODE_DECIPHER, false, "ffffff:9d5b-19bb", "00");
}

Test(run_pgp_aes, decipher_unwrapped_key_too_long, .init = asym_setup,
    .exit_code = 84)
{
    pgp_aes_fails(MODE_DECIPHER, false, "0102030405060708090a0b0c0d0e0f10"
        "1112131415161718191a1b1c1d1e1f2021:" PRIV, "00");
}

Test(run_pgp_aes, decipher_invalid_message, .init = asym_setup,
    .exit_code = 84)
{
    pgp_aes_fails(MODE_DECIPHER, false, AES_SYM_C ":" PRIV, "nothex");
}

Test(run_pgp_aes, decipher_block_not_16_bytes, .init = asym_setup,
    .exit_code = 84)
{
    pgp_aes_fails(MODE_DECIPHER, true, AES_SYM_C ":" PRIV, "744ce22c\n");
}

/* ---------------------------------------------------------- ElGamal */

Test(run_elgamal, keygen_small, .init = asym_setup)
{
    cli_options_t opts = make_gen(CRYPTO_ELGAMAL, "e3", "05");

    run_elgamal(&opts);
    assert_stdout("public key: 20-e3\nprivate key: 05-e3\n");
}

Test(run_elgamal, decipher_hand_computed_pair, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_ELGAMAL, MODE_DECIPHER, false,
        "05-e3");

    feed_str(" 80-27\r\n");
    run_elgamal(&opts);
    assert_stdout("A\n");
}

Test(run_elgamal, decipher_256_bits_vector, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_ELGAMAL, MODE_DECIPHER, false,
        AES_KEY "-" EG_P);

    feed_str("91c5adc3f0dec06e93c3eb3b2365740ce784ecf2a25f1a38f23ae3f1dbd7"
        "a823-31c86a0f0c0961ce53532ac6c5135b288918dca16b17ef148c0cc8974cd3"
        "6c9e\n");
    run_elgamal(&opts);
    assert_stdout("All men must die\n");
}

Test(run_elgamal, decipher_zero_pair, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_ELGAMAL, MODE_DECIPHER, false,
        "05-e3");

    feed_str("00-00\n");
    run_elgamal(&opts);
    assert_stdout("\n");
}

Test(run_elgamal, cipher_prints_a_pair, .init = asym_setup)
{
    cli_options_t opts = opts_of(CRYPTO_ELGAMAL, MODE_CIPHER, false,
        "20-e3");
    char line[64] = { 0 };
    FILE *out;

    feed_str("A\n");
    run_elgamal(&opts);
    fflush(stdout);
    out = cr_get_redirected_stdout();
    cr_assert_not_null(fgets(line, sizeof(line), out));
    cr_assert_not_null(strchr(line, '-'));
    cr_assert_eq(line[strlen(line) - 1], '\n');
}

static void elgamal_fails(crypto_mode_t mode, const char *key,
    const char *input)
{
    cli_options_t opts = opts_of(CRYPTO_ELGAMAL, mode, false, key);

    feed_str(input);
    run_elgamal(&opts);
}

Test(run_elgamal, keygen_prime_too_small, .init = asym_setup,
    .exit_code = 84)
{
    cli_options_t opts = make_gen(CRYPTO_ELGAMAL, "03", "01");

    run_elgamal(&opts);
}

Test(run_elgamal, keygen_private_key_zero, .init = asym_setup,
    .exit_code = 84)
{
    cli_options_t opts = make_gen(CRYPTO_ELGAMAL, "e3", "00");

    run_elgamal(&opts);
}

Test(run_elgamal, keygen_private_key_too_big, .init = asym_setup,
    .exit_code = 84)
{
    cli_options_t opts = make_gen(CRYPTO_ELGAMAL, "e3", "e2");

    run_elgamal(&opts);
}

Test(run_elgamal, malformed_key, .init = asym_setup, .exit_code = 84)
{
    elgamal_fails(MODE_CIPHER, "20e3", "A\n");
}

Test(run_elgamal, key_with_tiny_prime, .init = asym_setup, .exit_code = 84)
{
    elgamal_fails(MODE_CIPHER, "01-03", "A\n");
}

Test(run_elgamal, message_too_large, .init = asym_setup, .exit_code = 84)
{
    elgamal_fails(MODE_CIPHER, "20-e3", "too long for the key\n");
}

Test(run_elgamal, malformed_pair, .init = asym_setup, .exit_code = 84)
{
    elgamal_fails(MODE_DECIPHER, "05-e3", "8027\n");
}

Test(run_elgamal, pair_out_of_range, .init = asym_setup, .exit_code = 84)
{
    elgamal_fails(MODE_DECIPHER, "05-e3", "ff-01\n");
}
