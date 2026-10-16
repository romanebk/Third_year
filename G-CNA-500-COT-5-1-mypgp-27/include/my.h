/*
** EPITECH PROJECT, 2026
** my.h
** File description:
** small output helpers (my_putstr and friends)
*/

#ifndef MY_H_
#define MY_H_

#include <stddef.h>
#include <stdint.h>

/*
** Every helper writes through the C streams (stdout / stderr), never with
** a raw write(2): the output of the program stays in one buffer, so the
** order of the lines is preserved even when stdout is a pipe or a file.
** Each one returns the number of bytes written.
*/
size_t my_strlen(const char *str);
int my_putchar(char c);
int my_putstr(const char *str);
int my_putline(const char *str);
int my_putbytes(const uint8_t *data, size_t len);
int my_puterr(const char *str);

/* "LABELa-b\n": RSA and ElGamal keys, ElGamal ciphered pairs. */
int my_put_pair(const char *label, const char *a, const char *b);

/* Bytes printed as lowercase hexadecimal followed by a line feed. */
int my_put_hex_line(const uint8_t *data, size_t len);

/* Raw bytes followed by a line feed (deciphered messages). */
int my_put_message(const uint8_t *data, size_t len);

#endif /* !MY_H_ */
