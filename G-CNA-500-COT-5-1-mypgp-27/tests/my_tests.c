/*
** EPITECH PROJECT, 2026
** my_tests.c
** File description:
** Criterion unit tests: hex, buffer, io, command line, usage and errors
*/

#include <criterion/criterion.h>
#include <criterion/redirect.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>

#include "buffer.h"
#include "cli.h"
#include "error.h"
#include "hex.h"
#include "io.h"
#include "usage.h"
#include "unit_helpers.h"

void setup(void)
{
    redirect_all();
}

/* ---------------------------------------------------------------- hex */

Test(hex_to_bytes, two_chars_make_one_byte)
{
    buffer_t buf = hex_to_bytes("4142ff00");
    uint8_t expected[] = { 0x41, 0x42, 0xff, 0x00 };

    cr_assert_eq(buf.len, 4);
    cr_assert_arr_eq(buf.data, expected, 4);
    buffer_free(&buf);
}

Test(hex_to_bytes, uppercase_is_accepted)
{
    buffer_t buf = hex_to_bytes("ABcdEF");
    uint8_t expected[] = { 0xab, 0xcd, 0xef };

    cr_assert_arr_eq(buf.data, expected, 3);
    buffer_free(&buf);
}

Test(hex_to_bytes, empty_string_gives_empty_buffer)
{
    buffer_t buf = hex_to_bytes("");

    cr_assert_eq(buf.len, 0);
    buffer_free(&buf);
}

Test(hex_to_bytes, odd_length_exits_84, .init = setup, .exit_code = 84)
{
    hex_to_bytes("414");
}

Test(hex_to_bytes, invalid_character_exits_84, .init = setup,
    .exit_code = 84)
{
    hex_to_bytes("4g");
}

Test(bytes_to_hex, lowercase_output)
{
    uint8_t bytes[] = { 0x00, 0xab, 0x7f, 0xff };
    char *hex = bytes_to_hex(bytes, 4);

    cr_assert_str_eq(hex, "00ab7fff");
    free(hex);
}

Test(bytes_to_hex, empty_input_gives_empty_string)
{
    char *hex = bytes_to_hex(NULL, 0);

    cr_assert_str_eq(hex, "");
    free(hex);
}

/* ------------------------------------------------------------- buffer */

Test(buffer, new_buffer_is_empty)
{
    buffer_t buf = buffer_new();

    cr_assert_null(buf.data);
    cr_assert_eq(buf.len, 0);
    cr_assert_eq(buf.cap, 0);
}

Test(buffer, push_grows_by_doubling)
{
    buffer_t buf = buffer_new();
    size_t i;

    for (i = 0; i < 100; i++)
        buffer_push(&buf, (uint8_t)i);
    cr_assert_eq(buf.len, 100);
    cr_assert_eq(buf.cap, 128);
    for (i = 0; i < 100; i++)
        cr_assert_eq(buf.data[i], (uint8_t)i);
    buffer_free(&buf);
    cr_assert_null(buf.data);
    cr_assert_eq(buf.len, 0);
}

Test(buffer, append_copies_and_ignores_empty)
{
    buffer_t buf = buffer_new();
    uint8_t chunk[40];

    memset(chunk, 'x', sizeof(chunk));
    buffer_append(&buf, chunk, 0);
    cr_assert_eq(buf.len, 0);
    buffer_append(&buf, chunk, 40);
    buffer_append(&buf, (const uint8_t *)"yz", 2);
    cr_assert_eq(buf.len, 42);
    cr_assert_eq(buf.data[41], 'z');
    cr_assert_geq(buf.cap, 42);
    buffer_free(&buf);
}

/* ----------------------------------------------------------------- io */

Test(io_read_line_buffer, stops_at_first_line_feed, .init = setup)
{
    buffer_t line;

    feed_str("first line\nsecond line\n");
    line = io_read_line_buffer();
    cr_assert_eq(line.len, 10);
    cr_assert_arr_eq(line.data, "first line", 10);
    buffer_free(&line);
}

Test(io_read_line_buffer, empty_input, .init = setup)
{
    buffer_t line;

    feed_str("");
    line = io_read_line_buffer();
    cr_assert_eq(line.len, 0);
    buffer_free(&line);
}

Test(io_read_all, strips_a_single_trailing_line_feed, .init = setup)
{
    buffer_t all;

    feed_str("a\nb\n\n");
    all = io_read_all();
    cr_assert_eq(all.len, 4);
    cr_assert_arr_eq(all.data, "a\nb\n", 4);
    buffer_free(&all);
}

Test(io_read_all, keeps_binary_bytes, .init = setup)
{
    buffer_t all;
    const char data[] = { 'a', '\0', 'b', (char)0xff };

    feed_stdin(data, 4);
    all = io_read_all();
    cr_assert_eq(all.len, 4);
    cr_assert_arr_eq(all.data, data, 4);
    buffer_free(&all);
}

Test(io_hex_decode, decodes_and_skips_blanks)
{
    buffer_t in = buffer_new();
    buffer_t out;
    uint8_t expected[] = { 0x8f, 0x84, 0xab };
    const char *text = " 8f 84\r\nAB\t";

    buffer_append(&in, (const uint8_t *)text, strlen(text));
    cr_assert_eq(io_hex_decode(&in, &out), 0);
    cr_assert_eq(out.len, 3);
    cr_assert_arr_eq(out.data, expected, 3);
    buffer_free(&in);
    buffer_free(&out);
}

Test(io_hex_decode, rejects_invalid_and_odd_input)
{
    buffer_t in = buffer_new();
    buffer_t out;

    buffer_append(&in, (const uint8_t *)"zz", 2);
    cr_assert_eq(io_hex_decode(&in, &out), -2);
    in.len = 0;
    buffer_append(&in, (const uint8_t *)"abc", 3);
    cr_assert_eq(io_hex_decode(&in, &out), -2);
    buffer_free(&in);
}

Test(io_hex_decode, null_arguments)
{
    buffer_t out;
    buffer_t in = buffer_new();

    cr_assert_eq(io_hex_decode(NULL, &out), -1);
    cr_assert_eq(io_hex_decode(&in, NULL), -1);
}

Test(io_hex_decode, empty_input_is_an_empty_number)
{
    buffer_t in = buffer_new();
    buffer_t out;

    cr_assert_eq(io_hex_decode(&in, &out), 0);
    cr_assert_eq(out.len, 0);
    buffer_free(&out);
}

/* -------------------------------------------------------------- usage */

Test(print_usage, prints_the_subject_usage, .init = setup)
{
    print_usage();
    fflush(stdout);
    cr_assert_stdout_eq_str(
        "USAGE\n"
        "\t./my_pgp CRYPTO_SYSTEM MODE [OPTIONS] [key]\n"
        "\n"
        "DESCRIPTION\n"
        "Cipher or decipher MESSAGE using a given CRYPTO_SYSTEM. "
        "The MESSAGE is read from the standard input.\n"
        "\n"
        "   CRYPTO_SYSTEM\n"
        "\t\"xor\"\t\tcomputation using XOR algorithm\n"
        "\t\"aes\"\t\tcomputation using AES algorithm\n"
        "\t\"rsa\"\t\tcomputation using RSA algorithm\n"
        "\t\"pgp-xor\"\tcomputation using both RSA and XOR algorithm\n"
        "\t\"pgp-aes\"\tcomputation using both RSA and AES algorithm\n"
        "\n"
        "   MODE\n"
        "\t-c\t\tMESSAGE is clear and we want to cipher it\n"
        "\t-d\t\tMESSAGE is ciphered and we want to decipher it\n"
        "\t-g P Q\t\tRSA only: don't read a MESSAGE, but instead generate "
        "a public and private key\n"
        "\tpair from the prime number P and Q\n"
        "\n"
        "   OPTIONS\n"
        "\t-b\t\tfor XOR, AES and PGP, only works on one block. The "
        "MESSAGE and the symmetric\n"
        "\tkey must be the same size\n"
        "\n"
        "   key\t\t\tKey used to cipher/decipher MESSAGE "
        "(incompatible with -g MODE)\n"
        "\n"
        "   ELGAMAL (second asymmetric cryptosystem)\n"
        "\t\"elgamal\"\tcomputation using ElGamal algorithm (generator 2)\n"
        "\t-g P X\t\tgenerate a key pair from the prime number P and the "
        "private key X\n"
        "\t-c Y-P\t\tcipher MESSAGE with the public key Y-P\n"
        "\t-d X-P\t\tdecipher a C1-C2 pair with the private key X-P\n"
        "\n"
        "NOTES\n"
        "\tNumbers and keys are hexadecimal, little endian (lowest byte "
        "first).\n"
        "\tMODE, OPTIONS and key may be given in any order after "
        "CRYPTO_SYSTEM.\n"
        "\tpgp-xor and pgp-aes keys: SYMMETRIC_KEY:RSA_KEY, RSA keys: "
        "EXPONENT-MODULUS.\n"
        "\tOn error, a message is written on stderr and the program "
        "exits with 84.\n");
}

/* -------------------------------------------------------------- error */

Test(my_pgp_die, writes_on_stderr_and_exits_84, .init = setup,
    .exit_code = 84)
{
    my_pgp_die("boom");
}

Test(my_pgp_die, message_format_on_stderr, .init = setup)
{
    pid_t pid = fork();
    int status = 0;

    cr_assert_neq(pid, -1);
    if (pid == 0)
        my_pgp_die("boom");
    waitpid(pid, &status, 0);
    cr_assert(WIFEXITED(status));
    cr_assert_eq(WEXITSTATUS(status), 84);
    cr_assert_stderr_eq_str("my_pgp: error: boom\n");
}

/* ---------------------------------------------------------------- cli */

static cli_options_t parse(int argc, char **argv)
{
    cli_options_t opts;

    parse_args(argc, argv, &opts);
    return opts;
}

Test(parse_args, xor_cipher_block)
{
    char *argv[] = { "./my_pgp", "xor", "-c", "-b", "4142", NULL };
    cli_options_t opts = parse(5, argv);

    cr_assert_eq(opts.crypto, CRYPTO_XOR);
    cr_assert_eq(opts.mode, MODE_CIPHER);
    cr_assert(opts.block_mode);
    cr_assert_str_eq(opts.key, "4142");
}

Test(parse_args, every_crypto_system)
{
    const char *names[] = { "xor", "aes", "rsa", "pgp-xor", "pgp-aes",
        "elgamal" };
    crypto_system_t ids[] = { CRYPTO_XOR, CRYPTO_AES, CRYPTO_RSA,
        CRYPTO_PGP_XOR, CRYPTO_PGP_AES, CRYPTO_ELGAMAL };
    char *argv[] = { "./my_pgp", NULL, "-d", "00", NULL };
    size_t i;

    for (i = 0; i < 6; i++) {
        argv[1] = (char *)names[i];
        cr_assert_eq(parse(4, argv).crypto, ids[i]);
        cr_assert_eq(parse(4, argv).mode, MODE_DECIPHER);
        cr_assert_not(parse(4, argv).block_mode);
    }
}

Test(parse_args, free_order_of_arguments)
{
    char *a1[] = { "./my_pgp", "aes", "-b", "-c", "KEY", NULL };
    char *a2[] = { "./my_pgp", "aes", "-c", "KEY", "-b", NULL };
    char *a3[] = { "./my_pgp", "aes", "KEY", "-d", NULL };

    cr_assert(parse(5, a1).block_mode);
    cr_assert_str_eq(parse(5, a1).key, "KEY");
    cr_assert(parse(5, a2).block_mode);
    cr_assert_eq(parse(5, a2).mode, MODE_CIPHER);
    cr_assert_eq(parse(4, a3).mode, MODE_DECIPHER);
}

Test(parse_args, rsa_and_elgamal_generate)
{
    char *a1[] = { "./my_pgp", "rsa", "-g", "d3", "e3", NULL };
    char *a2[] = { "./my_pgp", "elgamal", "-b", "-g", "e3", "05", NULL };
    cli_options_t opts = parse(5, a1);

    cr_assert_eq(opts.mode, MODE_GENERATE);
    cr_assert_str_eq(opts.prime_p, "d3");
    cr_assert_str_eq(opts.prime_q, "e3");
    cr_assert_null(opts.key);
    opts = parse(6, a2);
    cr_assert_eq(opts.crypto, CRYPTO_ELGAMAL);
    cr_assert_str_eq(opts.prime_q, "05");
}

Test(parse_args, no_arguments, .init = setup, .exit_code = 84)
{
    char *argv[] = { "./my_pgp", NULL };

    parse(1, argv);
}

Test(parse_args, crypto_system_only, .init = setup, .exit_code = 84)
{
    char *argv[] = { "./my_pgp", "xor", NULL };

    parse(2, argv);
}

Test(parse_args, unknown_crypto_system, .init = setup, .exit_code = 84)
{
    char *argv[] = { "./my_pgp", "des", "-c", "00", NULL };

    parse(4, argv);
}

Test(parse_args, unknown_option, .init = setup, .exit_code = 84)
{
    char *argv[] = { "./my_pgp", "xor", "-x", "00", NULL };

    parse(4, argv);
}

Test(parse_args, two_modes, .init = setup, .exit_code = 84)
{
    char *argv[] = { "./my_pgp", "xor", "-c", "-d", "00", NULL };

    parse(5, argv);
}

Test(parse_args, two_keys, .init = setup, .exit_code = 84)
{
    char *argv[] = { "./my_pgp", "xor", "-c", "00", "11", NULL };

    parse(5, argv);
}

Test(parse_args, missing_key, .init = setup, .exit_code = 84)
{
    char *argv[] = { "./my_pgp", "xor", "-c", "-b", NULL };

    parse(4, argv);
}

Test(parse_args, missing_mode, .init = setup, .exit_code = 84)
{
    char *argv[] = { "./my_pgp", "xor", "-b", "00", NULL };

    parse(4, argv);
}

Test(parse_args, generate_for_xor_is_refused, .init = setup,
    .exit_code = 84)
{
    char *argv[] = { "./my_pgp", "xor", "-g", "d3", "e3", NULL };

    parse(5, argv);
}

Test(parse_args, generate_needs_two_numbers, .init = setup,
    .exit_code = 84)
{
    char *argv[] = { "./my_pgp", "rsa", "-g", "d3", NULL };

    parse(4, argv);
}

Test(parse_args, generate_with_a_key, .init = setup, .exit_code = 84)
{
    char *argv[] = { "./my_pgp", "rsa", "-g", "d3", "e3", "0101-19bb",
        NULL };

    parse(6, argv);
}

Test(parse_args, generate_then_cipher, .init = setup, .exit_code = 84)
{
    char *argv[] = { "./my_pgp", "rsa", "-g", "d3", "e3", "-c", NULL };

    parse(6, argv);
}
