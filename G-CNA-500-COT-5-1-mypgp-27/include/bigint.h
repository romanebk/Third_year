/*
** EPITECH PROJECT, 2026
** bigint.h
** File description:
** arbitrary precision unsigned integers (pure C99, no external dep)
*/

#ifndef BIGINT_H_
#define BIGINT_H_

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

typedef struct {
    uint32_t *limbs;
    size_t n;
} biguint_t;

biguint_t biguint_zero(void);
biguint_t biguint_from_u64(uint64_t value);
biguint_t biguint_clone(const biguint_t *src);
void biguint_free(biguint_t *value);

bool biguint_is_zero(const biguint_t *value);
int biguint_cmp(const biguint_t *a, const biguint_t *b);

biguint_t biguint_add(const biguint_t *a, const biguint_t *b);
biguint_t biguint_sub(const biguint_t *a, const biguint_t *b);
biguint_t biguint_mul(const biguint_t *a, const biguint_t *b);

size_t biguint_bit_length(const biguint_t *value);
bool biguint_test_bit(const biguint_t *value, size_t index);

void biguint_divmod(const biguint_t *num, const biguint_t *den,
    biguint_t *quot, biguint_t *rem);
biguint_t biguint_div(const biguint_t *num, const biguint_t *den);
biguint_t biguint_mod(const biguint_t *num, const biguint_t *den);

biguint_t biguint_powmod(const biguint_t *base, const biguint_t *exp,
    const biguint_t *mod);
biguint_t biguint_gcd(const biguint_t *a, const biguint_t *b);
bool biguint_modinv(const biguint_t *a, const biguint_t *mod, biguint_t *out);
bool biguint_is_probably_prime(const biguint_t *value);

biguint_t biguint_from_bytes_le(const uint8_t *bytes, size_t len);
uint8_t *biguint_to_bytes_le(const biguint_t *value, size_t *out_len);

#endif /* !BIGINT_H_ */
