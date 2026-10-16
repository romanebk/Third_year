/*
** EPITECH PROJECT, 2026
** pgp_aes.h
** File description:
** Pretty Good Privacy with AES (hybrid RSA + AES)
*/

#ifndef PGP_AES_H_
#define PGP_AES_H_

#include "cli.h"

/*
** Runs the "pgp-aes" CRYPTO_SYSTEM: the message is ciphered with
** AES-128/192/256 using a symmetric key, and the symmetric key itself
** is ciphered with RSA. The key argument has the form
** "SYMMETRIC_KEY:RSA_KEY", where RSA_KEY is "e-n" to cipher and "d-n"
** to decipher (hexadecimal little-endian numbers, as everywhere in
** this project). The symmetric key must be 16, 24 or 32 bytes long.
** Output on cipher is two lines: the ciphered symmetric key, then the
** ciphered message. Returns 0 or -1 (allocation failure).
**
** Reference vector (subject, p.4-5):
**     sym key 57696e74657220697320636f6d696e67 (AES-128)
**     input   All men must die
**     line 2  744ce22c385958348f0df26eceb62eef
*/
int run_pgp_aes(const cli_options_t *opts);

#endif /* !PGP_AES_H_ */
