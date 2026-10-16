/*
** EPITECH PROJECT, 2026
** rsa.h
** File description:
** RSA cryptosystem (-g, -c, -d)
*/

#ifndef RSA_H_
#define RSA_H_

#include "bigint.h"
#include "cli.h"

typedef struct {
    biguint_t exponent;
    biguint_t modulus;
} rsa_key_t;

biguint_t rsa_carmichael_lambda(const biguint_t *p, const biguint_t *q);
biguint_t rsa_pick_e(const biguint_t *lambda);
biguint_t rsa_compute_d(const biguint_t *e, const biguint_t *lambda);

rsa_key_t rsa_parse_key(const char *key);
void rsa_key_free(rsa_key_t *key);

char *rsa_biguint_to_hex(const biguint_t *value);

void run_rsa(const cli_options_t *opts);

#endif /* !RSA_H_ */
