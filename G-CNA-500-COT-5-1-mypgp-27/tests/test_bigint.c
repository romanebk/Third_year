/*
** EPITECH PROJECT, 2026
** test_bigint.c
** File description:
** Criterion unit tests for the arbitrary precision integers (bigint.c)
*/

#include <criterion/criterion.h>

#include "bigint.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static uint64_t to_u64(const biguint_t *v)
{
    uint64_t r = 0;

    if (v->n >= 1)
        r |= v->limbs[0];
    if (v->n >= 2)
        r |= ((uint64_t)v->limbs[1]) << 32;
    return r;
}

static void check_u64(const char *label, uint64_t expected, uint64_t actual)
{
    cr_expect_eq(actual, expected, "%s: expected %llu, got %llu", label,
        (unsigned long long)expected, (unsigned long long)actual);
}

static void check_bool(const char *label, bool expected, bool actual)
{
    cr_expect_eq(actual, expected, "%s", label);
}

Test(bigint, add_sub_mul)
{
    biguint_t a = biguint_from_u64(1000000000ULL);
    biguint_t b = biguint_from_u64(2000000000ULL);
    biguint_t sum = biguint_add(&a, &b);
    biguint_t diff = biguint_sub(&b, &a);
    biguint_t prod = biguint_mul(&a, &b);

    check_u64("add: 1e9 + 2e9", 3000000000ULL, to_u64(&sum));
    check_u64("sub: 2e9 - 1e9", 1000000000ULL, to_u64(&diff));
    check_u64("mul: 1e9 * 2e9 (low 64 bits)", 1000000000ULL * 2000000000ULL, to_u64(&prod));
    biguint_free(&a);
    biguint_free(&b);
    biguint_free(&sum);
    biguint_free(&diff);
    biguint_free(&prod);
}

Test(bigint, mul_carry_propagation)
{
    biguint_t max64 = biguint_from_u64(0xFFFFFFFFFFFFFFFFULL);
    biguint_t prod = biguint_mul(&max64, &max64);

    /* (2^64-1)^2 = 2^128 - 2^65 + 1 */
    check_bool("mul carry: result needs 4 limbs", true, prod.n == 4);
    check_u64("mul carry: limb[0]", 1u, prod.limbs[0]);
    check_u64("mul carry: limb[1]", 0u, prod.limbs[1]);
    check_u64("mul carry: limb[2]", 0xFFFFFFFEu, prod.limbs[2]);
    check_u64("mul carry: limb[3]", 0xFFFFFFFFu, prod.limbs[3]);
    biguint_free(&max64);
    biguint_free(&prod);
}

Test(bigint, div_mod)
{
    biguint_t num = biguint_from_u64(1000000007ULL);
    biguint_t den = biguint_from_u64(97ULL);
    biguint_t quot;
    biguint_t rem;

    biguint_divmod(&num, &den, &quot, &rem);
    check_u64("div: 1000000007 / 97", 1000000007ULL / 97ULL, to_u64(&quot));
    check_u64("mod: 1000000007 % 97", 1000000007ULL % 97ULL, to_u64(&rem));
    biguint_free(&quot);
    biguint_free(&rem);
    biguint_free(&num);
    biguint_free(&den);
}

Test(bigint, div_exact_and_edge_cases)
{
    biguint_t a = biguint_from_u64(100);
    biguint_t b = biguint_from_u64(10);
    biguint_t q = biguint_div(&a, &b);
    biguint_t r = biguint_mod(&a, &b);

    check_u64("div exact: 100 / 10", 10, to_u64(&q));
    check_u64("mod exact: 100 % 10", 0, to_u64(&r));
    biguint_free(&q);
    biguint_free(&r);

    /* numerator smaller than denominator */
    biguint_t small = biguint_from_u64(3);
    biguint_t big = biguint_from_u64(10);
    biguint_t q2 = biguint_div(&small, &big);
    biguint_t r2 = biguint_mod(&small, &big);

    check_u64("div num < den: 3 / 10", 0, to_u64(&q2));
    check_u64("mod num < den: 3 % 10", 3, to_u64(&r2));
    biguint_free(&q2);
    biguint_free(&r2);

    /* zero numerator */
    biguint_t zero = biguint_zero();
    biguint_t q3 = biguint_div(&zero, &b);
    check_bool("div 0 / 10 is zero", true, biguint_is_zero(&q3));
    biguint_free(&q3);

    biguint_free(&a);
    biguint_free(&b);
    biguint_free(&small);
    biguint_free(&big);
    biguint_free(&zero);
}

Test(bigint, bit_length_and_test_bit)
{
    biguint_t zero = biguint_zero();
    biguint_t one = biguint_from_u64(1);
    biguint_t v = biguint_from_u64(0b1011ULL); /* 11 decimal */

    check_u64("bit_length(0)", 0, biguint_bit_length(&zero));
    check_u64("bit_length(1)", 1, biguint_bit_length(&one));
    check_u64("bit_length(11)", 4, biguint_bit_length(&v));
    check_bool("test_bit(11, 0)", true, biguint_test_bit(&v, 0));
    check_bool("test_bit(11, 1)", true, biguint_test_bit(&v, 1));
    check_bool("test_bit(11, 2)", false, biguint_test_bit(&v, 2));
    check_bool("test_bit(11, 3)", true, biguint_test_bit(&v, 3));
    check_bool("test_bit(11, 100) out of range -> false", false, biguint_test_bit(&v, 100));
    biguint_free(&zero);
    biguint_free(&one);
    biguint_free(&v);
}

Test(bigint, cmp_clone_zero)
{
    biguint_t x = biguint_from_u64(10);
    biguint_t y = biguint_from_u64(20);
    biguint_t clone = biguint_clone(&x);
    biguint_t zero = biguint_zero();

    check_bool("cmp: 10 < 20", true, biguint_cmp(&x, &y) < 0);
    check_bool("cmp: 20 > 10", true, biguint_cmp(&y, &x) > 0);
    check_bool("cmp: 10 == 10", true, biguint_cmp(&x, &x) == 0);
    check_bool("is_zero(0)", true, biguint_is_zero(&zero));
    check_bool("is_zero(10) is false", false, biguint_is_zero(&x));
    check_u64("clone is independent copy", 10, to_u64(&clone));
    biguint_free(&x);
    biguint_free(&y);
    biguint_free(&clone);
    biguint_free(&zero);
}

Test(bigint, powmod)
{
    biguint_t base = biguint_from_u64(4);
    biguint_t exp = biguint_from_u64(13);
    biguint_t mod = biguint_from_u64(497);
    biguint_t result = biguint_powmod(&base, &exp, &mod);

    check_u64("powmod: 4^13 mod 497", 445, to_u64(&result));
    biguint_free(&result);

    biguint_t exp0 = biguint_from_u64(0);
    biguint_t r0 = biguint_powmod(&base, &exp0, &mod);
    check_u64("powmod: x^0 mod m == 1", 1, to_u64(&r0));
    biguint_free(&r0);

    biguint_free(&base);
    biguint_free(&exp);
    biguint_free(&exp0);
    biguint_free(&mod);
}

/* Big-endian hex string (like python hex()) into a biguint. */
static biguint_t from_hex_be(const char *hex)
{
    size_t hlen = strlen(hex);
    size_t blen = (hlen + 1) / 2;
    uint8_t *le = calloc(blen, 1);
    biguint_t v;
    size_t i;

    if (le == NULL) {
        fprintf(stderr, "out of memory in test\n");
        exit(1);
    }
    for (i = 0; i < hlen; i++) {
        char c = hex[hlen - 1 - i];
        uint8_t nib = (uint8_t)((c <= '9') ? c - '0' : c - 'a' + 10);

        le[i / 2] |= (uint8_t)(nib << ((i % 2) * 4));
    }
    v = biguint_from_bytes_le(le, blen);
    free(le);
    return v;
}

/* Biguint rendered as big-endian hex, compared to a python reference. */
static void check_hex(const char *label, const char *expected,
    const biguint_t *v)
{
    size_t len;
    uint8_t *le = biguint_to_bytes_le(v, &len);
    size_t hlen = len * 2;
    char *got = malloc(hlen + 1);
    size_t i;
    bool same;

    if (got == NULL) {
        fprintf(stderr, "out of memory in test\n");
        exit(1);
    }
    for (i = 0; i < len; i++)
        sprintf(got + 2 * i, "%02x", le[len - 1 - i]);
    got[hlen] = '\0';
    /* Values compare equal ignoring leading zero nibbles: python hex()
    ** strips them all, while a whole byte always survives here. */
    same = strcmp(got + strspn(got, "0"), expected + strspn(expected, "0"))
        == 0;
    cr_expect(same, "%s: expected %s, got %s", label, expected, got);
    free(got);
    free(le);
}

/*
** Montgomery path (odd moduli, multi-limb) against python references,
** plus the classic fallback (even modulus) and the mod-1 edge case.
*/
Test(bigint, powmod_montgomery)
{
    biguint_t b = from_hex_be("123456789abcdef0123456789abcdef0fedcba98"
        "76543210");
    biguint_t e = biguint_from_u64(65537);
    biguint_t m = from_hex_be("ffffffffffffffffffffffffffffffffffffffff"
        "fffffffffffffffffffffed1");
    biguint_t r = biguint_powmod(&b, &e, &m);

    check_hex("powmod montgomery 128-bit (ref python)",
        "85525ef04b7311aa1809f70474cd83764eddd57dd1d3e212645543b52824341",
        &r);
    biguint_free(&r);
    biguint_free(&b);
    biguint_free(&e);
    biguint_free(&m);

    biguint_t b2 = biguint_from_u64(0xabcdef);
    biguint_t e2 = biguint_from_u64(0x12345);
    biguint_t m2 = from_hex_be("ffffffffffffffffffffffffffffffffffffff"
        "ffffffffffffffffffffffffe0");
    biguint_t r2 = biguint_powmod(&b2, &e2, &m2);

    check_hex("powmod classic fallback, even 256-bit mod (ref python)",
        "a7140a28f62795661892b7e50ba40b6fa249059f8e8b8d0ec59937f3d1fc812f",
        &r2);
    biguint_free(&r2);
    biguint_free(&b2);
    biguint_free(&e2);
    biguint_free(&m2);

    biguint_t b3 = biguint_from_u64(3);
    biguint_t e3 = biguint_from_u64(5);
    biguint_t m3 = biguint_from_u64(100);
    biguint_t r3 = biguint_powmod(&b3, &e3, &m3);

    check_u64("powmod even mod: 3^5 mod 100 == 43", 43, to_u64(&r3));
    biguint_free(&r3);
    biguint_free(&b3);
    biguint_free(&e3);
    biguint_free(&m3);

    biguint_t b4 = biguint_from_u64(5);
    biguint_t e4 = biguint_from_u64(3);
    biguint_t m4 = biguint_from_u64(1);
    biguint_t r4 = biguint_powmod(&b4, &e4, &m4);

    check_bool("powmod mod 1 == 0", true, biguint_is_zero(&r4));
    biguint_free(&r4);
    biguint_free(&b4);
    biguint_free(&e4);
    biguint_free(&m4);
}

Test(bigint, gcd)
{
    biguint_t a = biguint_from_u64(1071);    biguint_t b = biguint_from_u64(462);
    biguint_t g = biguint_gcd(&a, &b);

    check_u64("gcd(1071, 462)", 21, to_u64(&g));
    biguint_free(&g);
    biguint_free(&a);
    biguint_free(&b);

    biguint_t x = biguint_from_u64(17);
    biguint_t y = biguint_from_u64(5);
    biguint_t g2 = biguint_gcd(&x, &y);
    check_u64("gcd(17, 5) coprime", 1, to_u64(&g2));
    biguint_free(&g2);
    biguint_free(&x);
    biguint_free(&y);
}

Test(bigint, modinv)
{
    biguint_t a = biguint_from_u64(3);
    biguint_t mod = biguint_from_u64(11);
    biguint_t inv;
    bool ok = biguint_modinv(&a, &mod, &inv);

    check_bool("modinv(3, 11) exists", true, ok);
    check_u64("modinv(3, 11) == 4", 4, to_u64(&inv));
    biguint_free(&inv);
    biguint_free(&a);
    biguint_free(&mod);

    biguint_t e = biguint_from_u64(17);
    biguint_t lambda = biguint_from_u64(3120);
    biguint_t d;
    bool ok2 = biguint_modinv(&e, &lambda, &d);
    biguint_t prod_raw;
    biguint_t prod;

    check_bool("modinv(17, 3120) exists", true, ok2);
    check_u64("modinv(17, 3120) == 2753", 2753, to_u64(&d));
    prod_raw = biguint_mul(&e, &d);
    prod = biguint_mod(&prod_raw, &lambda);
    check_u64("e * d mod lambda == 1", 1, to_u64(&prod));
    biguint_free(&prod_raw);
    biguint_free(&prod);
    biguint_free(&d);
    biguint_free(&e);
    biguint_free(&lambda);

    biguint_t non_coprime_a = biguint_from_u64(4);
    biguint_t non_coprime_mod = biguint_from_u64(8);
    biguint_t no_inv;
    bool ok3 = biguint_modinv(&non_coprime_a, &non_coprime_mod, &no_inv);
    check_bool("modinv(4, 8) does not exist", false, ok3);
    biguint_free(&non_coprime_a);
    biguint_free(&non_coprime_mod);
}

Test(bigint, is_probably_prime)
{
    biguint_t zero = biguint_zero();
    biguint_t one = biguint_from_u64(1);
    biguint_t two = biguint_from_u64(2);
    biguint_t three = biguint_from_u64(3);
    biguint_t four = biguint_from_u64(4);
    biguint_t prime_41 = biguint_from_u64(41);
    biguint_t prime_7919 = biguint_from_u64(7919);
    biguint_t composite_1681 = biguint_from_u64(1681);
    biguint_t composite_91 = biguint_from_u64(91);
    biguint_t subject_p = biguint_from_u64(211);
    biguint_t subject_q = biguint_from_u64(227);

    check_bool("is_prime(0) is false", false, biguint_is_probably_prime(&zero));
    check_bool("is_prime(1) is false", false, biguint_is_probably_prime(&one));
    check_bool("is_prime(2) is true", true, biguint_is_probably_prime(&two));
    check_bool("is_prime(3) is true", true, biguint_is_probably_prime(&three));
    check_bool("is_prime(4) is false", false, biguint_is_probably_prime(&four));
    check_bool("is_prime(41) is true", true, biguint_is_probably_prime(&prime_41));
    check_bool("is_prime(7919) is true", true,
        biguint_is_probably_prime(&prime_7919));
    check_bool("is_prime(1681 = 41*41) is false", false,
        biguint_is_probably_prime(&composite_1681));
    check_bool("is_prime(91 = 7*13) is false", false,
        biguint_is_probably_prime(&composite_91));
    check_bool("is_prime(211, subject P) is true", true,
        biguint_is_probably_prime(&subject_p));
    check_bool("is_prime(227, subject Q) is true", true,
        biguint_is_probably_prime(&subject_q));
    biguint_free(&zero);
    biguint_free(&one);
    biguint_free(&two);
    biguint_free(&three);
    biguint_free(&four);
    biguint_free(&prime_41);
    biguint_free(&prime_7919);
    biguint_free(&composite_1681);
    biguint_free(&composite_91);
    biguint_free(&subject_p);
    biguint_free(&subject_q);
}

Test(bigint, bytes_le)
{
    uint8_t bytes[] = { 0x46, 0x57 };
    biguint_t v = biguint_from_bytes_le(bytes, 2);
    size_t out_len;
    uint8_t *out;

    check_u64("from_bytes_le(WF reversed order) == 0x5746", 0x5746, to_u64(&v));
    out = biguint_to_bytes_le(&v, &out_len);
    check_u64("to_bytes_le length", 2, out_len);
    check_u64("to_bytes_le[0]", 0x46, out[0]);
    check_u64("to_bytes_le[1]", 0x57, out[1]);
    free(out);
    biguint_free(&v);

    biguint_t zero = biguint_zero();
    size_t zlen;
    uint8_t *zout = biguint_to_bytes_le(&zero, &zlen);
    check_u64("to_bytes_le(0) length", 1, zlen);
    check_u64("to_bytes_le(0)[0]", 0, zout[0]);
    free(zout);
}

/*
** Knuth's algorithm D overestimates the quotient digit by one on these
** operands (test data of Hacker's Delight, divmnu64.c): the "add back"
** correction step must run and the result must still be exact.
*/
Test(bigint, divmod_add_back_step)
{
    biguint_t u1 = from_hex_be("7fffffff800000000000000000000000");
    biguint_t v1 = from_hex_be("800000000000000000000001");
    biguint_t u2 = from_hex_be("800000000000000000000003");
    biguint_t v2 = from_hex_be("200000000000000000000001");
    biguint_t q;
    biguint_t r;

    biguint_divmod(&u1, &v1, &q, &r);
    check_hex("add back 1: quotient", "fffffffe", &q);
    check_hex("add back 1: remainder", "7fffffffffffffff00000002", &r);
    biguint_free(&q);
    biguint_free(&r);
    biguint_divmod(&u2, &v2, &q, &r);
    check_hex("add back 2: quotient", "3", &q);
    check_hex("add back 2: remainder", "200000000000000000000000", &r);
    biguint_free(&q);
    biguint_free(&r);
    biguint_free(&u1);
    biguint_free(&v1);
    biguint_free(&u2);
    biguint_free(&v2);
}

Test(bigint, sub_with_borrow_across_limbs)
{
    biguint_t a = from_hex_be("100000000");
    biguint_t b = biguint_from_u64(1);
    biguint_t d = biguint_sub(&a, &b);

    check_u64("2^32 - 1", 0xFFFFFFFFu, to_u64(&d));
    biguint_free(&a);
    biguint_free(&b);
    biguint_free(&d);
}
