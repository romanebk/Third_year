import { describe, it, expect, beforeEach } from "vitest";

import { oauthProviderIdForService, isAccountLinkUsable } from "@/server/services";
import { encryptToken } from "@/server/auth/token-encryption";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");
const OTHER_KEY = Buffer.alloc(32, 9).toString("base64");

beforeEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

describe("oauthProviderIdForService", () => {
  it("maps google-calendar to the shared google provider", () => {
    expect(oauthProviderIdForService("google-calendar")).toBe("google");
  });

  it("returns the service name itself for direct providers", () => {
    expect(oauthProviderIdForService("github")).toBe("github");
  });

  it("returns the service name itself for unknown services", () => {
    expect(oauthProviderIdForService("unknown-service")).toBe("unknown-service");
  });
});

describe("isAccountLinkUsable", () => {
  it("accepts a token encrypted with the current key", () => {
    expect(isAccountLinkUsable({ access_token: encryptToken("secret-token") })).toBe(true);
  });

  it("rejects a missing token", () => {
    expect(isAccountLinkUsable({ access_token: null })).toBe(false);
  });

  it("rejects a malformed stored value", () => {
    expect(isAccountLinkUsable({ access_token: "not-a-token" })).toBe(false);
  });

  it("rejects a token encrypted with a rotated key", () => {
    process.env.TOKEN_ENCRYPTION_KEY = OTHER_KEY;
    const stale = encryptToken("old-token");
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
    expect(isAccountLinkUsable({ access_token: stale })).toBe(false);
  });
});
