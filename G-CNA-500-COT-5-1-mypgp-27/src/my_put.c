/*
** EPITECH PROJECT, 2026
** my_put.c
** File description:
** small output helpers (my_putstr and friends)
*/

#include "my.h"
#include "hex.h"

#include <stdio.h>
#include <stdlib.h>

size_t my_strlen(const char *str)
{
    size_t len = 0;

    if (str == NULL)
        return 0;
    while (str[len] != '\0')
        len++;
    return len;
}

int my_putchar(char c)
{
    return fputc((unsigned char)c, stdout) == EOF ? 0 : 1;
}

int my_putstr(const char *str)
{
    return (int)fwrite(str, 1, my_strlen(str), stdout);
}

int my_putline(const char *str)
{
    int written = my_putstr(str);

    return written + my_putchar('\n');
}

int my_putbytes(const uint8_t *data, size_t len)
{
    if (data == NULL || len == 0)
        return 0;
    return (int)fwrite(data, 1, len, stdout);
}

int my_puterr(const char *str)
{
    return (int)fwrite(str, 1, my_strlen(str), stderr);
}

int my_put_pair(const char *label, const char *a, const char *b)
{
    int written = my_putstr(label);

    written += my_putstr(a);
    written += my_putchar('-');
    written += my_putstr(b);
    return written + my_putchar('\n');
}

int my_put_hex_line(const uint8_t *data, size_t len)
{
    char *hex = bytes_to_hex(data, len);
    int written = my_putline(hex);

    free(hex);
    return written;
}

int my_put_message(const uint8_t *data, size_t len)
{
    int written = my_putbytes(data, len);

    return written + my_putchar('\n');
}
