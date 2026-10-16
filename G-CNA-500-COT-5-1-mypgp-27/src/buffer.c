/*
** EPITECH PROJECT, 2026
** buffer.c
** File description:
** dynamic byte buffer (home-made std::vector<uint8_t> equivalent)
*/

#include "buffer.h"
#include "error.h"

#include <stdlib.h>
#include <string.h>

buffer_t buffer_new(void)
{
    buffer_t buf = { NULL, 0, 0 };

    return buf;
}

void buffer_free(buffer_t *buf)
{
    free(buf->data);
    buf->data = NULL;
    buf->len = 0;
    buf->cap = 0;
}

static void buffer_grow(buffer_t *buf, size_t needed)
{
    size_t new_cap;
    uint8_t *new_data;

    if (buf->cap == 0)
        new_cap = 16;
    else
        new_cap = buf->cap;

    if (buf->len + needed <= buf->cap)
        return;
    while (new_cap < buf->len + needed)
        new_cap *= 2;
    new_data = realloc(buf->data, new_cap);
    if (new_data == NULL)
        my_pgp_die("out of memory");
    buf->data = new_data;
    buf->cap = new_cap;
}

void buffer_push(buffer_t *buf, uint8_t byte)
{
    buffer_grow(buf, 1);
    buf->data[buf->len] = byte;
    buf->len++;
}

void buffer_append(buffer_t *buf, const uint8_t *data, size_t len)
{
    if (len == 0)
        return;
    buffer_grow(buf, len);
    memcpy(buf->data + buf->len, data, len);
    buf->len += len;
}
