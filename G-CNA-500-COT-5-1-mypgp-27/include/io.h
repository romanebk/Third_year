/*
** EPITECH PROJECT, 2026
** io.h
** File description:
** standard input reading
*/

#ifndef IO_H_
#define IO_H_

#include "buffer.h"

/*
** Reads one line (block mode, RSA): the line feed is not part of the
** message (subject, p.3). Returns an empty buffer on immediate end of
** file.
*/
buffer_t io_read_line_buffer(void);

/*
** Reads the whole of stdin (stream mode). A single trailing line feed is
** stripped if present: the deciphered input is a hex string terminated by
** the line feed added by the shell, and a ciphered file written by
** `echo` must round-trip exactly.
*/
buffer_t io_read_all(void);

/*
** Decodes the hex content of `in` into `out`.
** Returns 0 on success, -1 if the temporary NUL-terminated copy cannot be
** allocated and -2 if the content is not a valid hexadecimal number: the
** caller frees its own buffers before turning those into an error 84, so
** that even the error paths stay valgrind clean.
*/
int io_hex_decode(const buffer_t *in, buffer_t *out);

#endif /* !IO_H_ */
