/*
** EPITECH PROJECT, 2026
** elgamal.h
** File description:
** ElGamal cryptosystem over Z/pZ (2nd asymmetric cryptosystem)
*/

#ifndef ELGAMAL_H_
#define ELGAMAL_H_

#include "cli.h"

/*
** ElGamal over the multiplicative group modulo a prime P, with the
** generator G = 2 fixed (as e = Fermat prime is fixed for RSA). Every
** number is hexadecimal little endian, as everywhere in this project.
**
**     ./my_pgp elgamal -g P X     public key  Y-P   with Y = G^X mod P
**                                 private key X-P   (1 <= X <= P - 2)
**     ./my_pgp elgamal -c Y-P     reads M < P, prints C1-C2 with
**                                 C1 = G^K mod P, C2 = M * Y^K mod P
**                                 and K drawn from /dev/urandom
**     ./my_pgp elgamal -d X-P     reads C1-C2, prints M = C2 * C1^-X
**                                 computed as C2 * C1^(P - 1 - X) mod P
**
** The ephemeral K makes two ciphers of the same message differ, which is
** what makes ElGamal semantically secure (unlike textbook RSA).
*/
void run_elgamal(const cli_options_t *opts);

#endif /* !ELGAMAL_H_ */
