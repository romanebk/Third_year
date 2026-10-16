/*
** EPITECH PROJECT, 2026
** buffer.h
** File description:
** dynamic byte buffer (home-made std::vector<uint8_t> equivalent)
*/

#ifndef BUFFER_H_
#define BUFFER_H_

#include <stddef.h>
#include <stdint.h>

typedef struct {
    uint8_t *data;
    size_t len;
    size_t cap;
} buffer_t;

buffer_t buffer_new(void);
void buffer_free(buffer_t *buf);
void buffer_push(buffer_t *buf, uint8_t byte);
void buffer_append(buffer_t *buf, const uint8_t *data, size_t len);

#endif /* !BUFFER_H_ */
