/*
** EPITECH PROJECT, 2026
** unit_helpers.h
** File description:
** shared helpers for the Criterion unit tests
*/

#ifndef UNIT_HELPERS_H_
#define UNIT_HELPERS_H_

#include <criterion/criterion.h>
#include <criterion/redirect.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#include "cli.h"

/* Redirects the three standard streams of the test process. */
static inline void redirect_all(void)
{
    cr_redirect_stdout();
    cr_redirect_stderr();
    cr_redirect_stdin();
}

/* Writes `len` bytes on the redirected stdin, then closes it (EOF). */
static inline void feed_stdin(const char *data, size_t len)
{
    FILE *in = cr_get_redirected_stdin();

    if (len > 0)
        fwrite(data, 1, len, in);
    fclose(in);
}

static inline void feed_str(const char *data)
{
    feed_stdin(data, strlen(data));
}

static inline cli_options_t make_opts(crypto_system_t crypto,
    crypto_mode_t mode, bool block, const char *key)
{
    cli_options_t opts;

    opts.crypto = crypto;
    opts.mode = mode;
    opts.block_mode = block;
    opts.key = key;
    opts.prime_p = NULL;
    opts.prime_q = NULL;
    return opts;
}

static inline cli_options_t make_gen(crypto_system_t crypto, const char *p,
    const char *q)
{
    cli_options_t opts = make_opts(crypto, MODE_GENERATE, false, NULL);

    opts.prime_p = p;
    opts.prime_q = q;
    return opts;
}

/* Flushes stdout and compares everything printed so far. */
#define assert_stdout(expected)                                        \
    do {                                                               \
        fflush(stdout);                                                \
        cr_assert_stdout_eq_str(expected);                             \
    } while (0)

#endif /* !UNIT_HELPERS_H_ */
