/*
** EPITECH PROJECT, 2026
** unit_my_put.c
** File description:
** Criterion unit tests for the small output helpers (my_putstr...)
*/

#include <criterion/criterion.h>
#include <criterion/redirect.h>
#include <stdio.h>
#include <unistd.h>

#include "my.h"

static void redirect_std(void)
{
    cr_redirect_stdout();
    cr_redirect_stderr();
}

Test(my_strlen, counts_characters)
{
    cr_assert_eq(my_strlen("Hello"), 5);
    cr_assert_eq(my_strlen(""), 0);
    cr_assert_eq(my_strlen(NULL), 0);
}

Test(my_putchar, one_character, .init = redirect_std)
{
    cr_assert_eq(my_putchar('A'), 1);
    fflush(stdout);
    cr_assert_stdout_eq_str("A");
}

Test(my_putstr, lowercase_characters, .init = redirect_std)
{
    cr_assert_eq(my_putstr("hello world "), 12);
    fflush(stdout);
    cr_assert_stdout_eq_str("hello world ", "Expected other thing");
}

Test(my_putstr, empty_and_null_strings, .init = redirect_std)
{
    cr_assert_eq(my_putstr(""), 0);
    cr_assert_eq(my_putstr(NULL), 0);
    fflush(stdout);
    cr_assert_stdout_eq_str("");
}

Test(my_putline, adds_a_line_feed, .init = redirect_std)
{
    cr_assert_eq(my_putline("8f84"), 5);
    fflush(stdout);
    cr_assert_stdout_eq_str("8f84\n");
}

Test(my_putbytes, raw_bytes_and_empty_input, .init = redirect_std)
{
    const uint8_t bytes[] = { 'W', 'F' };

    cr_assert_eq(my_putbytes(bytes, 2), 2);
    cr_assert_eq(my_putbytes(bytes, 0), 0);
    cr_assert_eq(my_putbytes(NULL, 3), 0);
    fflush(stdout);
    cr_assert_stdout_eq_str("WF");
}

Test(my_puterr, writes_on_stderr_only, .init = redirect_std)
{
    cr_assert_eq(my_puterr("oops\n"), 5);
    fflush(stdout);
    fflush(stderr);
    cr_assert_stdout_eq_str("");
    cr_assert_stderr_eq_str("oops\n");
}

Test(my_put_pair, rsa_key_line, .init = redirect_std)
{
    cr_assert_eq(my_put_pair("public key: ", "0101", "19bb"), 22);
    fflush(stdout);
    cr_assert_stdout_eq_str("public key: 0101-19bb\n");
}

Test(my_put_hex_line, bytes_as_lowercase_hex, .init = redirect_std)
{
    const uint8_t bytes[] = { 0x8f, 0x84, 0xAB };

    cr_assert_eq(my_put_hex_line(bytes, 3), 7);
    my_put_hex_line(NULL, 0);
    fflush(stdout);
    cr_assert_stdout_eq_str("8f84ab\n\n");
}

Test(my_put_message, bytes_then_line_feed, .init = redirect_std)
{
    cr_assert_eq(my_put_message((const uint8_t *)"Hi", 2), 3);
    my_put_message(NULL, 0);
    fflush(stdout);
    cr_assert_stdout_eq_str("Hi\n\n");
}
