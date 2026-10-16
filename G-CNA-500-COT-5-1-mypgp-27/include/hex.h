/*
** EPITECH PROJECT, 2026
** hex.h
** File description:
** hexadecimal conversion
*/

#ifndef HEX_H_
#define HEX_H_

#include "buffer.h"

#include <stddef.h>
#include <stdint.h>

buffer_t hex_to_bytes(const char *hex);
char *bytes_to_hex(const uint8_t *bytes, size_t len);

#endif /* !HEX_H_ */
