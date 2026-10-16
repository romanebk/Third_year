/*
** EPITECH PROJECT, 2026
** io.c
** File description:
** standard input reading
*/

#include "io.h"
#include "error.h"
#include "hex.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>

/*
** One reading primitive for both modes: stop at the line feed when
** `one_line` is set (block mode), otherwise swallow the whole stream and
** strip a single trailing line feed afterwards.
*/
static buffer_t read_stdin(bool one_line)
{
    buffer_t buf = buffer_new();
    int c;

    while ((c = getchar()) != EOF) {
        if (one_line && c == '\n')
            break;
        buffer_push(&buf, (uint8_t)c);
    }
    if (ferror(stdin)) {
        buffer_free(&buf);
        my_pgp_die("failed to read the standard input");
    }
    if (!one_line && buf.len > 0 && buf.data[buf.len - 1] == '\n')
        buf.len--;
    return buf;
}

buffer_t io_read_line_buffer(void)
{
    return read_stdin(true);
}

buffer_t io_read_all(void)
{
    return read_stdin(false);
}

/*
** The deciphered input comes from the user, so it is validated *before*
** anything is decoded: that way the caller can free its own buffers and
** leave with 84 instead of leaking them through my_pgp_die().
*/
static int hex_digit(char c)
{
    if (c >= '0' && c <= '9')
        return c - '0';
    if (c >= 'a' && c <= 'f')
        return c - 'a' + 10;
    if (c >= 'A' && c <= 'F')
        return c - 'A' + 10;
    return -1;
}

static bool is_hex_text(const char *text, size_t len)
{
    size_t i;

    if (len % 2 != 0)
        return false;
    for (i = 0; i < len; i++)
        if (hex_digit(text[i]) < 0)
            return false;
    return true;
}

/*
** Returns 0 on success, -1 when the temporary copy cannot be allocated
** and -2 when the content is not a valid hexadecimal number. Blanks (a
** CR before the line feed, spaces, line breaks) are not part of the
** number and are skipped.
*/
int io_hex_decode(const buffer_t *in, buffer_t *out)
{
    char *text;
    size_t len = 0;
    size_t i;

    if (in == NULL || out == NULL)
        return -1;
    text = malloc(in->len + 1);

    if (text == NULL)
        return -1;
    for (i = 0; i < in->len; i++)
        if (!isspace(in->data[i]))
            text[len++] = (char)in->data[i];
    text[len] = '\0';
    if (!is_hex_text(text, len)) {
        free(text);
        return -2;
    }
    *out = hex_to_bytes(text);
    free(text);
    return 0;
}
