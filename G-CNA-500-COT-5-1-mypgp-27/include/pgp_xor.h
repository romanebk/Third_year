/*
** EPITECH PROJECT, 2026
** pgp_xor.h
** File description:
** Pretty Good Privacy with XOR (hybrid RSA + XOR)
*/

#ifndef PGP_XOR_H_
#define PGP_XOR_H_

#include "cli.h"

/*
** Runs the "pgp-xor" CRYPTO_SYSTEM: the message is ciphered with XOR
** using a symmetric key, and the symmetric key itself is ciphered with
** RSA. The key argument has the form "SYMMETRIC_KEY:RSA_KEY", where
** RSA_KEY is "e-n" to cipher and "d-n" to decipher (hexadecimal
** little-endian numbers, as everywhere in this project).
** Output on cipher is two lines: the ciphered symmetric key, then the
** ciphered message. Returns 0 or -1 (allocation failure).
**
** Reference vector (subject + C++ era test_pgp_xor.sh):
**     sym key 576861742069732064656164206d6179206e6576657220646965
**     input   You know nothing, Jon Snow
**     line 2  20070f2700071c6a4449060a490515164e4e12190b190011063c
*/
int run_pgp_xor(const cli_options_t *opts);

#endif /* !PGP_XOR_H_ */
