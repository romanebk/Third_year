import { describe, it, expect } from "vitest";

import { minRefreshRateSeconds, effectiveRefreshRateSeconds } from "@/server/services/refresh-rates";

describe("minRefreshRateSeconds", () => {
  it("returns the per-service floor for known services", () => {
    expect(minRefreshRateSeconds("github")).toBe(60);
    expect(minRefreshRateSeconds("weather")).toBe(60);
    expect(minRefreshRateSeconds("youtube")).toBe(300);
    expect(minRefreshRateSeconds("google-calendar")).toBe(300);
    expect(minRefreshRateSeconds("nasa")).toBe(3600);
    expect(minRefreshRateSeconds("holidays")).toBe(3600);
    expect(minRefreshRateSeconds("universities")).toBe(3600);
  });

  it("falls back to the global floor for unknown services", () => {
    expect(minRefreshRateSeconds("unknown-service")).toBe(5);
    expect(minRefreshRateSeconds("")).toBe(5);
  });
});

describe("effectiveRefreshRateSeconds", () => {
  it("keeps a requested interval above the floor as is", () => {
    expect(effectiveRefreshRateSeconds("github", 120)).toBe(120);
  });

  it("raises a requested interval below the floor to the floor", () => {
    expect(effectiveRefreshRateSeconds("github", 5)).toBe(60);
    expect(effectiveRefreshRateSeconds("nasa", 60)).toBe(3600);
  });

  it("uses the global floor for unknown services", () => {
    expect(effectiveRefreshRateSeconds("unknown-service", 1)).toBe(5);
  });
});
