/*
** EPITECH PROJECT, 2026
** bigint.c
** File description:
** arbitrary precision unsigned integers (pure C99, no external dep)
*/

#include "bigint.h"
#include "error.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

biguint_t biguint_zero(void)
{
    biguint_t value = { NULL, 0 };

    return value;
}

static biguint_t alloc_limbs(size_t n)
{
    biguint_t value;

    if (n == 0)
        return biguint_zero();
    value.limbs = malloc(n * sizeof(uint32_t));
    if (value.limbs == NULL)
        my_pgp_die("out of memory");
    value.n = n;
    return value;
}

static void normalize(biguint_t *value)
{
    while (value->n > 0 && value->limbs[value->n - 1] == 0)
        value->n--;
    if (value->n == 0) {
        free(value->limbs);
        value->limbs = NULL;
    }
}

biguint_t biguint_from_u64(uint64_t v)
{
    biguint_t value;

    if (v == 0)
        return biguint_zero();
    value = alloc_limbs(2);
    value.limbs[0] = (uint32_t)(v & 0xFFFFFFFFu);
    value.limbs[1] = (uint32_t)(v >> 32);
    normalize(&value);
    return value;
}

biguint_t biguint_clone(const biguint_t *src)
{
    biguint_t value;

    if (src->n == 0)
        return biguint_zero();
    value = alloc_limbs(src->n);
    memcpy(value.limbs, src->limbs, src->n * sizeof(uint32_t));
    return value;
}

void biguint_free(biguint_t *value)
{
    free(value->limbs);
    value->limbs = NULL;
    value->n = 0;
}

bool biguint_is_zero(const biguint_t *value)
{
    return value->n == 0;
}

int biguint_cmp(const biguint_t *a, const biguint_t *b)
{
    size_t i;

    if (a->n != b->n)
        return a->n < b->n ? -1 : 1;
    for (i = a->n; i > 0; i--) {
        if (a->limbs[i - 1] != b->limbs[i - 1])
            return a->limbs[i - 1] < b->limbs[i - 1] ? -1 : 1;
    }
    return 0;
}

biguint_t biguint_add(const biguint_t *a, const biguint_t *b)
{
    size_t max_n = a->n > b->n ? a->n : b->n;
    biguint_t result = alloc_limbs(max_n + 1);
    uint64_t carry = 0;
    uint64_t sum;
    size_t i;

    for (i = 0; i < max_n + 1; i++) {
        sum = carry;
        if (i < a->n)
            sum += a->limbs[i];
        if (i < b->n)
            sum += b->limbs[i];
        result.limbs[i] = (uint32_t)(sum & 0xFFFFFFFFu);
        carry = sum >> 32;
    }
    normalize(&result);
    return result;
}

biguint_t biguint_sub(const biguint_t *a, const biguint_t *b)
{
    biguint_t result;
    int64_t borrow = 0;
    int64_t diff;
    size_t i;

    assert(biguint_cmp(a, b) >= 0);
    result = alloc_limbs(a->n);
    for (i = 0; i < a->n; i++) {
        diff = (int64_t)a->limbs[i] - borrow;
        diff -= i < b->n ? (int64_t)b->limbs[i] : 0;
        if (diff < 0) {
            diff += (int64_t)1 << 32;
            borrow = 1;
        } else {
            borrow = 0;
        }
        result.limbs[i] = (uint32_t)diff;
    }
    normalize(&result);
    return result;
}

biguint_t biguint_mul(const biguint_t *a, const biguint_t *b)
{
    biguint_t result;
    uint64_t carry;
    uint64_t prod;
    size_t i;
    size_t j;

    if (a->n == 0 || b->n == 0)
        return biguint_zero();
    result = alloc_limbs(a->n + b->n);
    memset(result.limbs, 0, result.n * sizeof(uint32_t));
    for (i = 0; i < a->n; i++) {
        carry = 0;
        for (j = 0; j < b->n; j++) {
            prod = (uint64_t)a->limbs[i] * b->limbs[j]
                + result.limbs[i + j] + carry;
            result.limbs[i + j] = (uint32_t)(prod & 0xFFFFFFFFu);
            carry = prod >> 32;
        }
        result.limbs[i + b->n] += (uint32_t)carry;
    }
    normalize(&result);
    return result;
}

size_t biguint_bit_length(const biguint_t *value)
{
    size_t bits;
    uint32_t top;

    if (value->n == 0)
        return 0;
    bits = (value->n - 1) * 32;
    top = value->limbs[value->n - 1];
    while (top != 0) {
        bits++;
        top >>= 1;
    }
    return bits;
}

bool biguint_test_bit(const biguint_t *value, size_t index)
{
    size_t limb = index / 32;

    if (limb >= value->n)
        return false;
    return (value->limbs[limb] >> (index % 32)) & 1u;
}

/*
** Divisor of a single limb: one pass from the top limb, the running
** remainder always fits in 64 bits.
*/
static void divmod_small(const biguint_t *num, uint32_t den,
    biguint_t *quot, biguint_t *rem)
{
    biguint_t q = alloc_limbs(num->n);
    uint64_t r = 0;
    size_t i;

    for (i = num->n; i-- > 0;) {
        r = (r << 32) | num->limbs[i];
        q.limbs[i] = (uint32_t)(r / den);
        r %= den;
    }
    normalize(&q);
    *quot = q;
    *rem = biguint_from_u64(r);
}

static unsigned int leading_zeros(uint32_t x)
{
    unsigned int count = 0;

    while ((x & 0x80000000u) == 0) {
        x <<= 1;
        count++;
    }
    return count;
}

/* dst = src << shift (0 <= shift < 32) on n limbs, returns the carry out. */
static uint32_t shift_left_limbs(uint32_t *dst, const uint32_t *src,
    size_t n, unsigned int shift)
{
    uint32_t carry = 0;
    size_t i;

    for (i = 0; i < n; i++) {
        dst[i] = shift == 0 ? src[i] : (src[i] << shift) | carry;
        carry = shift == 0 ? 0 : src[i] >> (32 - shift);
    }
    return carry;
}

/*
** Estimates the quotient digit of u[j..j+n] / v (Knuth, step D3): the
** guess from the two top limbs is at most 2 too large, the test on the
** third limb brings it back to at most 1 too large.
*/
static uint64_t estimate_qhat(const uint32_t *u, const uint32_t *v,
    size_t n, size_t j)
{
    uint64_t top = ((uint64_t)u[j + n] << 32) | u[j + n - 1];
    uint64_t qhat = top / v[n - 1];
    uint64_t rhat = top % v[n - 1];

    while (qhat > 0xFFFFFFFFu
        || qhat * v[n - 2] > ((rhat << 32) | u[j + n - 2])) {
        qhat--;
        rhat += v[n - 1];
        if (rhat > 0xFFFFFFFFu)
            break;
    }
    return qhat;
}

/*
** u[j..j+n] -= qhat * v (Knuth, steps D4 and D6): when the estimate was
** one too large the subtraction goes negative and v is added back.
** Returns the corrected quotient digit.
*/
static uint32_t mul_sub_digit(uint32_t *u, const uint32_t *v, size_t n,
    size_t j, uint64_t qhat)
{
    uint64_t borrow = 0;
    uint64_t prod;
    uint64_t diff;
    uint64_t carry = 0;
    size_t i;

    for (i = 0; i < n; i++) {
        prod = qhat * v[i] + carry;
        carry = prod >> 32;
        diff = (uint64_t)u[i + j] - (prod & 0xFFFFFFFFu) - borrow;
        u[i + j] = (uint32_t)diff;
        borrow = (diff >> 32) & 1u;
    }
    diff = (uint64_t)u[j + n] - carry - borrow;
    u[j + n] = (uint32_t)diff;
    if (((diff >> 32) & 1u) == 0)
        return (uint32_t)qhat;
    carry = 0;
    for (i = 0; i < n; i++) {
        prod = (uint64_t)u[i + j] + v[i] + carry;
        u[i + j] = (uint32_t)prod;
        carry = prod >> 32;
    }
    u[j + n] += (uint32_t)carry;
    return (uint32_t)(qhat - 1);
}

/*
** Schoolbook long division on 32-bit limbs (Knuth, TAOCP vol. 2,
** 4.3.1, algorithm D): one quotient limb per step instead of one bit,
** which is what keeps gcd and modinv fast on 4096-bit RSA keys.
*/
void biguint_divmod(const biguint_t *num, const biguint_t *den,
    biguint_t *quot, biguint_t *rem)
{
    size_t n = den->n;
    size_t m;
    unsigned int shift;
    uint32_t *u;
    uint32_t *v;
    biguint_t q;
    biguint_t r;
    size_t j;
    size_t i;

    assert(!biguint_is_zero(den));
    if (biguint_cmp(num, den) < 0) {
        *quot = biguint_zero();
        *rem = biguint_clone(num);
        return;
    }
    if (n == 1) {
        divmod_small(num, den->limbs[0], quot, rem);
        return;
    }
    m = num->n - n;
    shift = leading_zeros(den->limbs[n - 1]);
    v = malloc(n * sizeof(uint32_t));
    u = malloc((num->n + 1) * sizeof(uint32_t));
    if (v == NULL || u == NULL)
        my_pgp_die("out of memory");
    shift_left_limbs(v, den->limbs, n, shift);
    u[num->n] = shift_left_limbs(u, num->limbs, num->n, shift);
    q = alloc_limbs(m + 1);
    for (j = m + 1; j-- > 0;)
        q.limbs[j] = mul_sub_digit(u, v, n, j, estimate_qhat(u, v, n, j));
    r = alloc_limbs(n);
    for (i = 0; i < n; i++)
        r.limbs[i] = shift == 0 ? u[i]
            : (u[i] >> shift) | (u[i + 1] << (32 - shift));
    free(u);
    free(v);
    normalize(&q);
    normalize(&r);
    *quot = q;
    *rem = r;
}

biguint_t biguint_div(const biguint_t *num, const biguint_t *den)
{
    biguint_t quot;
    biguint_t rem;

    biguint_divmod(num, den, &quot, &rem);
    biguint_free(&rem);
    return quot;
}

biguint_t biguint_mod(const biguint_t *num, const biguint_t *den)
{
    biguint_t quot;
    biguint_t rem;

    biguint_divmod(num, den, &quot, &rem);
    biguint_free(&quot);
    return rem;
}

static biguint_t mulmod(const biguint_t *a, const biguint_t *b,
    const biguint_t *mod)
{
    biguint_t prod = biguint_mul(a, b);
    biguint_t result = biguint_mod(&prod, mod);

    biguint_free(&prod);
    return result;
}

/*
** Montgomery arithmetic on 64-bit limbs (CIOS flavour, Koc et al.): with
** an odd modulus, every modular multiplication below is two interleaved
** schoolbook passes and no division. The 64x64 -> 128 bit products use
** the GCC/Clang `unsigned __int128` extension, which divides the number
** of inner steps by four compared to 32-bit limbs. Even moduli keep the
** classic path: RSA moduli are always odd, so they all qualify.
*/
__extension__ typedef unsigned __int128 u128_t;

#define MONT_WINDOW 5
#define MONT_TABLE_SIZE (1u << (MONT_WINDOW - 1))

typedef struct {
    uint64_t *n;
    size_t k;
    uint64_t nprime;
    uint64_t *t;
} mont_ctx_t;

/* -n^-1 mod 2^64 by Newton iteration (6 steps take 1 bit to 64). */
static uint64_t mont_nprime(uint64_t n0)
{
    uint64_t x = 1;
    size_t i;

    for (i = 0; i < 6; i++)
        x = x * (2u - n0 * x);
    return (uint64_t)0 - x;
}

static uint64_t *alloc_u64(size_t n)
{
    uint64_t *p = calloc(n, sizeof(uint64_t));

    if (p == NULL)
        my_pgp_die("out of memory");
    return p;
}

/* Packs the 32-bit limbs of `src` into k zero-padded 64-bit limbs. */
static void to_u64(uint64_t *dst, const biguint_t *src, size_t k)
{
    size_t i;

    memset(dst, 0, k * sizeof(uint64_t));
    for (i = 0; i < src->n && i / 2 < k; i++)
        dst[i / 2] |= (uint64_t)src->limbs[i] << (32 * (i % 2));
}

static biguint_t from_u64(const uint64_t *src, size_t k)
{
    biguint_t value = alloc_limbs(2 * k);
    size_t i;

    for (i = 0; i < 2 * k; i++)
        value.limbs[i] = (uint32_t)(src[i / 2] >> (32 * (i % 2)));
    normalize(&value);
    return value;
}

/* out = t mod n for t < 2n held on k+1 limbs. */
static void mont_final_sub(const mont_ctx_t *ctx, const uint64_t *t,
    uint64_t *out)
{
    size_t k = ctx->k;
    bool ge = t[k] != 0;
    uint64_t borrow = 0;
    uint64_t diff;
    size_t i;

    for (i = k; !ge && i-- > 0;) {
        if (t[i] != ctx->n[i]) {
            ge = t[i] > ctx->n[i];
            break;
        }
        if (i == 0)
            ge = true;
    }
    if (!ge) {
        memcpy(out, t, k * sizeof(uint64_t));
        return;
    }
    for (i = 0; i < k; i++) {
        diff = t[i] - ctx->n[i] - borrow;
        borrow = (t[i] < ctx->n[i]) || (t[i] - ctx->n[i] < borrow);
        out[i] = diff;
    }
}

/*
** out = a * b / R mod n, with R = 2^(64k) and a, b < n. The running sum
** t holds k+2 limbs and stays below 2n, hence the final subtraction.
** `out` may alias `a` or `b`: t is only copied out at the very end.
*/
static void mont_mul(const mont_ctx_t *ctx, const uint64_t *a,
    const uint64_t *b, uint64_t *out)
{
    size_t k = ctx->k;
    uint64_t *t = ctx->t;
    u128_t uv;
    uint64_t carry;
    uint64_t m;
    size_t i;
    size_t j;

    memset(t, 0, (k + 2) * sizeof(uint64_t));
    for (i = 0; i < k; i++) {
        carry = 0;
        for (j = 0; j < k; j++) {
            uv = (u128_t)a[i] * b[j] + t[j] + carry;
            t[j] = (uint64_t)uv;
            carry = (uint64_t)(uv >> 64);
        }
        uv = (u128_t)t[k] + carry;
        t[k] = (uint64_t)uv;
        t[k + 1] = (uint64_t)(uv >> 64);
        m = t[0] * ctx->nprime;
        uv = (u128_t)m * ctx->n[0] + t[0];
        carry = (uint64_t)(uv >> 64);
        for (j = 1; j < k; j++) {
            uv = (u128_t)m * ctx->n[j] + t[j] + carry;
            t[j - 1] = (uint64_t)uv;
            carry = (uint64_t)(uv >> 64);
        }
        uv = (u128_t)t[k] + carry;
        t[k - 1] = (uint64_t)uv;
        t[k] = t[k + 1] + (uint64_t)(uv >> 64);
    }
    mont_final_sub(ctx, t, out);
}

/*
** Index of the lowest set bit of the window that starts at bit `top`
** (sliding window: a window always ends on a one, so only the odd
** powers of the base need to be precomputed).
*/
static size_t window_low(const biguint_t *exp, size_t top)
{
    size_t low = top + 1 >= MONT_WINDOW ? top + 1 - MONT_WINDOW : 0;

    while (!biguint_test_bit(exp, low))
        low++;
    return low;
}

static size_t window_value(const biguint_t *exp, size_t top, size_t low)
{
    size_t value = 0;
    size_t i;

    for (i = top + 1; i-- > low;)
        value = (value << 1) | (biguint_test_bit(exp, i) ? 1u : 0u);
    return value;
}

/*
** table[i] = base^(2i+1) in Montgomery form, for the sliding window.
** `r2` is R^2 mod n, used to bring the base into Montgomery form.
*/
static uint64_t *mont_build_table(const mont_ctx_t *ctx,
    const biguint_t *base, const biguint_t *mod, uint64_t *r2)
{
    size_t k = ctx->k;
    uint64_t *table = alloc_u64(MONT_TABLE_SIZE * k);
    uint64_t *sq = alloc_u64(k);
    biguint_t red = biguint_mod(base, mod);
    size_t i;

    to_u64(table, &red, k);
    biguint_free(&red);
    mont_mul(ctx, table, r2, table);
    mont_mul(ctx, table, table, sq);
    for (i = 1; i < MONT_TABLE_SIZE; i++)
        mont_mul(ctx, table + (i - 1) * k, sq, table + i * k);
    free(sq);
    return table;
}

/* R^2 mod n, the constant that brings a number into Montgomery form. */
static uint64_t *mont_r2(const biguint_t *mod, size_t k)
{
    uint64_t *r2 = alloc_u64(k);
    biguint_t big_r2 = alloc_limbs(4 * k + 1);
    biguint_t tmp;

    memset(big_r2.limbs, 0, big_r2.n * sizeof(uint32_t));
    big_r2.limbs[4 * k] = 1;
    tmp = biguint_mod(&big_r2, mod);
    to_u64(r2, &tmp, k);
    biguint_free(&tmp);
    biguint_free(&big_r2);
    return r2;
}

/* Left-to-right sliding-window exponentiation in Montgomery form. */
static biguint_t mont_powmod(const biguint_t *base, const biguint_t *exp,
    const biguint_t *mod)
{
    mont_ctx_t ctx;
    size_t k = (mod->n + 1) / 2;
    uint64_t *r2 = mont_r2(mod, k);
    uint64_t *acc = alloc_u64(k);
    uint64_t *table;
    biguint_t result;
    size_t i = biguint_bit_length(exp);
    size_t top;
    size_t low;
    size_t j;

    ctx.k = k;
    ctx.n = alloc_u64(k);
    ctx.t = alloc_u64(k + 2);
    to_u64(ctx.n, mod, k);
    ctx.nprime = mont_nprime(ctx.n[0]);
    table = mont_build_table(&ctx, base, mod, r2);
    acc[0] = 1;
    mont_mul(&ctx, acc, r2, acc);
    while (i > 0) {
        top = i - 1;
        if (!biguint_test_bit(exp, top)) {
            mont_mul(&ctx, acc, acc, acc);
            i = top;
            continue;
        }
        low = window_low(exp, top);
        for (j = low; j <= top; j++)
            mont_mul(&ctx, acc, acc, acc);
        mont_mul(&ctx, acc,
            table + (window_value(exp, top, low) >> 1) * k, acc);
        i = low;
    }
    memset(r2, 0, k * sizeof(uint64_t));
    r2[0] = 1;
    mont_mul(&ctx, acc, r2, acc);
    result = from_u64(acc, k);
    free(r2);
    free(acc);
    free(table);
    free(ctx.n);
    free(ctx.t);
    return result;
}

static biguint_t powmod_classic(const biguint_t *base, const biguint_t *exp,
    const biguint_t *mod)
{
    biguint_t result = biguint_from_u64(1);
    biguint_t b = biguint_mod(base, mod);
    size_t bits = biguint_bit_length(exp);
    biguint_t tmp;
    size_t i;

    for (i = 0; i < bits; i++) {
        if (biguint_test_bit(exp, i)) {
            tmp = mulmod(&result, &b, mod);
            biguint_free(&result);
            result = tmp;
        }
        tmp = mulmod(&b, &b, mod);
        biguint_free(&b);
        b = tmp;
    }
    biguint_free(&b);
    tmp = biguint_mod(&result, mod);
    biguint_free(&result);
    return tmp;
}

biguint_t biguint_powmod(const biguint_t *base, const biguint_t *exp,
    const biguint_t *mod)
{
    if (mod->n > 0 && (mod->limbs[0] & 1u) != 0)
        return mont_powmod(base, exp, mod);
    return powmod_classic(base, exp, mod);
}

biguint_t biguint_gcd(const biguint_t *a, const biguint_t *b)
{
    biguint_t x = biguint_clone(a);
    biguint_t y = biguint_clone(b);
    biguint_t r;

    while (!biguint_is_zero(&y)) {
        r = biguint_mod(&x, &y);
        biguint_free(&x);
        x = y;
        y = r;
    }
    biguint_free(&y);
    return x;
}

typedef struct {
    biguint_t mag;
    bool neg;
} sbig_t;

static sbig_t sbig_make(biguint_t mag, bool neg)
{
    sbig_t s;

    if (biguint_is_zero(&mag))
        neg = false;
    s.mag = mag;
    s.neg = neg;
    return s;
}

static void sbig_free(sbig_t *s)
{
    biguint_free(&s->mag);
}

static sbig_t sbig_add(const sbig_t *a, const sbig_t *b)
{
    biguint_t mag;

    if (a->neg == b->neg) {
        mag = biguint_add(&a->mag, &b->mag);
        return sbig_make(mag, a->neg);
    }
    if (biguint_cmp(&a->mag, &b->mag) >= 0) {
        mag = biguint_sub(&a->mag, &b->mag);
        return sbig_make(mag, a->neg);
    }
    mag = biguint_sub(&b->mag, &a->mag);
    return sbig_make(mag, b->neg);
}

static sbig_t sbig_mul(const sbig_t *a, const sbig_t *b)
{
    biguint_t mag = biguint_mul(&a->mag, &b->mag);

    return sbig_make(mag, a->neg != b->neg);
}

bool biguint_modinv(const biguint_t *a, const biguint_t *mod, biguint_t *out)
{
    biguint_t old_r = biguint_clone(a);
    biguint_t r = biguint_clone(mod);
    sbig_t old_s = sbig_make(biguint_from_u64(1), false);
    sbig_t s = sbig_make(biguint_zero(), false);
    biguint_t one = biguint_from_u64(1);
    bool invertible;
    biguint_t q;
    biguint_t next_r;
    sbig_t q_signed;
    sbig_t qs;
    sbig_t neg_qs;
    sbig_t next_s;

    while (!biguint_is_zero(&r)) {
        q = biguint_div(&old_r, &r);
        next_r = biguint_mod(&old_r, &r);
        biguint_free(&old_r);
        old_r = r;
        r = next_r;

        q_signed = sbig_make(biguint_clone(&q), false);
        qs = sbig_mul(&q_signed, &s);
        neg_qs = sbig_make(biguint_clone(&qs.mag), !qs.neg);
        next_s = sbig_add(&old_s, &neg_qs);

        biguint_free(&q);
        sbig_free(&q_signed);
        sbig_free(&qs);
        sbig_free(&neg_qs);
        sbig_free(&old_s);
        old_s = s;
        s = next_s;
    }

    invertible = biguint_cmp(&old_r, &one) == 0;
    if (invertible) {
        if (old_s.neg) {
            biguint_t reduced = biguint_mod(&old_s.mag, mod);
            *out = biguint_is_zero(&reduced) ? reduced
                : biguint_sub(mod, &reduced);
            if (!biguint_is_zero(&reduced))
                biguint_free(&reduced);
        } else {
            *out = biguint_mod(&old_s.mag, mod);
        }
    }
    biguint_free(&one);
    biguint_free(&old_r);
    biguint_free(&r);
    sbig_free(&old_s);
    sbig_free(&s);
    return invertible;
}

static const uint64_t SMALL_PRIMES[] = {
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37
};
#define SMALL_PRIME_COUNT (sizeof(SMALL_PRIMES) / sizeof(SMALL_PRIMES[0]))
#define MILLER_RABIN_RANDOM_ROUNDS 10

static bool trial_division(const biguint_t *n, bool *decided)
{
    biguint_t p;
    biguint_t rem;
    size_t i;

    *decided = false;
    for (i = 0; i < SMALL_PRIME_COUNT; i++) {
        p = biguint_from_u64(SMALL_PRIMES[i]);
        if (biguint_cmp(n, &p) == 0) {
            biguint_free(&p);
            *decided = true;
            return true;
        }
        rem = biguint_mod(n, &p);
        biguint_free(&p);
        if (biguint_is_zero(&rem)) {
            biguint_free(&rem);
            *decided = true;
            return false;
        }
        biguint_free(&rem);
    }
    return false;
}

static void miller_rabin_decompose(const biguint_t *n_minus_1, biguint_t *d,
    size_t *r)
{
    biguint_t two = biguint_from_u64(2);
    biguint_t m = biguint_clone(n_minus_1);
    biguint_t q;
    biguint_t rem;
    size_t count = 0;

    for (;;) {
        biguint_divmod(&m, &two, &q, &rem);
        if (!biguint_is_zero(&rem)) {
            biguint_free(&q);
            biguint_free(&rem);
            break;
        }
        biguint_free(&rem);
        biguint_free(&m);
        m = q;
        count++;
    }
    biguint_free(&two);
    *d = m;
    *r = count;
}

static bool miller_rabin_witness_passes(const biguint_t *n,
    const biguint_t *n_minus_1, const biguint_t *d, size_t r,
    const biguint_t *a)
{
    biguint_t one = biguint_from_u64(1);
    biguint_t x = biguint_powmod(a, d, n);
    biguint_t sq;
    bool passes;
    size_t i;

    passes = biguint_cmp(&x, &one) == 0 || biguint_cmp(&x, n_minus_1) == 0;
    for (i = 1; i < r && !passes; i++) {
        sq = mulmod(&x, &x, n);
        biguint_free(&x);
        x = sq;
        passes = biguint_cmp(&x, n_minus_1) == 0;
    }
    biguint_free(&x);
    biguint_free(&one);
    return passes;
}

static bool miller_rabin_small_witnesses(const biguint_t *n,
    const biguint_t *n_minus_1, const biguint_t *d, size_t r)
{
    biguint_t a;
    size_t i;
    bool ok = true;

    for (i = 0; i < SMALL_PRIME_COUNT && ok; i++) {
        a = biguint_from_u64(SMALL_PRIMES[i]);
        if (biguint_cmp(&a, n) < 0)
            ok = miller_rabin_witness_passes(n, n_minus_1, d, r, &a);
        biguint_free(&a);
    }
    return ok;
}

static void seed_rng_once(void)
{
    static bool seeded = false;

    if (!seeded) {
        srand((unsigned int)time(NULL));
        seeded = true;
    }
}

static biguint_t random_biguint_below(const biguint_t *limit)
{
    size_t byte_len = limit->n > 0 ? limit->n * 4 : 1;
    uint8_t *bytes;
    biguint_t raw;
    biguint_t result;
    size_t i;

    seed_rng_once();
    bytes = malloc(byte_len);
    if (bytes == NULL)
        my_pgp_die("out of memory");
    for (i = 0; i < byte_len; i++)
        bytes[i] = (uint8_t)(rand() & 0xFF);
    raw = biguint_from_bytes_le(bytes, byte_len);
    free(bytes);
    result = biguint_mod(&raw, limit);
    biguint_free(&raw);
    return result;
}

static bool miller_rabin_random_witnesses(const biguint_t *n,
    const biguint_t *n_minus_1, const biguint_t *d, size_t r)
{
    biguint_t two = biguint_from_u64(2);
    biguint_t range = biguint_sub(n_minus_1, &two);
    biguint_t offset;
    biguint_t a;
    size_t i;
    bool ok = true;

    for (i = 0; i < MILLER_RABIN_RANDOM_ROUNDS && ok; i++) {
        offset = random_biguint_below(&range);
        a = biguint_add(&offset, &two);
        biguint_free(&offset);
        ok = miller_rabin_witness_passes(n, n_minus_1, d, r, &a);
        biguint_free(&a);
    }
    biguint_free(&range);
    biguint_free(&two);
    return ok;
}

bool biguint_is_probably_prime(const biguint_t *value)
{
    biguint_t two = biguint_from_u64(2);
    biguint_t one;
    biguint_t n_minus_1;
    biguint_t d;
    size_t r;
    bool decided;
    bool trial_result;
    bool ok;

    if (biguint_cmp(value, &two) < 0) {
        biguint_free(&two);
        return false;
    }
    biguint_free(&two);
    trial_result = trial_division(value, &decided);
    if (decided)
        return trial_result;
    one = biguint_from_u64(1);
    n_minus_1 = biguint_sub(value, &one);
    biguint_free(&one);
    miller_rabin_decompose(&n_minus_1, &d, &r);
    ok = miller_rabin_small_witnesses(value, &n_minus_1, &d, r)
        && miller_rabin_random_witnesses(value, &n_minus_1, &d, r);
    biguint_free(&n_minus_1);
    biguint_free(&d);
    return ok;
}

biguint_t biguint_from_bytes_le(const uint8_t *bytes, size_t len)
{
    biguint_t value;
    size_t n = (len + 3) / 4;
    size_t i;
    uint32_t limb;
    size_t byte_index;
    size_t k;

    if (len == 0)
        return biguint_zero();
    value = alloc_limbs(n);
    for (i = 0; i < n; i++) {
        limb = 0;
        for (k = 0; k < 4; k++) {
            byte_index = i * 4 + k;
            if (byte_index < len)
                limb |= ((uint32_t)bytes[byte_index]) << (k * 8);
        }
        value.limbs[i] = limb;
    }
    normalize(&value);
    return value;
}

uint8_t *biguint_to_bytes_le(const biguint_t *value, size_t *out_len)
{
    size_t len = value->n * 4;
    uint8_t *out;
    size_t i;

    if (len == 0) {
        *out_len = 1;
        out = malloc(1);
        if (out == NULL)
            my_pgp_die("out of memory");
        out[0] = 0;
        return out;
    }
    while (len > 1 && ((value->limbs[(len - 1) / 4]
            >> (((len - 1) % 4) * 8)) & 0xFFu) == 0)
        len--;
    out = malloc(len);
    if (out == NULL)
        my_pgp_die("out of memory");
    for (i = 0; i < len; i++)
        out[i] = (uint8_t)(value->limbs[i / 4] >> ((i % 4) * 8));
    *out_len = len;
    return out;
}
