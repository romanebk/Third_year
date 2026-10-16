/*
** EPITECH PROJECT, 2026
** hex.c
** File description:
** hexadecimal conversion
*/

#include "hex.h"
#include "error.h"

#include <stdlib.h>
#include <string.h>

static int hex_digit_value(char c)
{
    if (c >= '0' && c <= '9')
        return c - '0';
    if (c >= 'a' && c <= 'f')
        return c - 'a' + 10;
    if (c >= 'A' && c <= 'F')
        return c - 'A' + 10;
    my_pgp_die("invalid hexadecimal character");
}

buffer_t hex_to_bytes(const char *hex)
{
    buffer_t out = buffer_new();
    size_t len = strlen(hex);
    size_t i;
    int high;
    int low;

    if (len % 2 != 0)
        my_pgp_die("hexadecimal string must have an even length");
    for (i = 0; i < len; i += 2) {
        high = hex_digit_value(hex[i]);
        low = hex_digit_value(hex[i + 1]);
        buffer_push(&out, (uint8_t)((high << 4) | low));
    }
    return out;
}

char *bytes_to_hex(const uint8_t *bytes, size_t len)
{
    static const char digits[] = "0123456789abcdef";
    char *out = malloc(len * 2 + 1);
    size_t i;

    if (out == NULL)
        my_pgp_die("out of memory");
    for (i = 0; i < len; i++) {
        out[i * 2] = digits[bytes[i] >> 4];
        out[i * 2 + 1] = digits[bytes[i] & 0x0f];
    }
    out[len * 2] = '\0';
    return out;
}
