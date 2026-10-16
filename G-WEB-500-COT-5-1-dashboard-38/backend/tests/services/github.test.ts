import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchRecentCommits, fetchUserProfile } from "@/server/services/github/fetch";
import { WidgetValidationError, WidgetRateLimitError } from "@/server/widgets/errors";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function apiResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  };
}

const COMMITS = [
  {
    sha: "abcdef1234567890",
    commit: { message: "Fix bug\n\nLong body", author: { name: "octo", date: "2026-10-01T00:00:00Z" } },
  },
  {
    sha: "1234567890abcdef",
    commit: { message: "Add feature", author: { name: "hubot", date: "2026-10-02T00:00:00Z" } },
  },
];

describe("fetchRecentCommits", () => {
  it("rejects a malformed repository without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchRecentCommits({ repository: "no-slash" })).rejects.toThrow("owner/repo");
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns mapped commits on success", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(apiResponse(COMMITS))));

    const res = await fetchRecentCommits({ repository: "octo/repo" });
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ sha: "abcdef1", message: "Fix bug", author: "octo" });
  });

  it("maps a 404 to a validation error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(apiResponse({}, 404))));

    await expect(fetchRecentCommits({ repository: "octo/missing" })).rejects.toThrow(
      "repository not found",
    );
  });

  it("falls back to anonymous access when the token is rejected", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: { headers?: Record<string, string> }) => {
        calls.push({ url, headers: init.headers ?? {} });
        if (init.headers?.Authorization) return Promise.resolve(apiResponse({}, 401));
        return Promise.resolve(apiResponse(COMMITS));
      }),
    );

    const res = await fetchRecentCommits({ repository: "octo/repo", accessToken: "expired" });
    expect(res).toHaveLength(2);
    expect(calls).toHaveLength(2);
    expect(calls[1].headers.Authorization).toBeUndefined();
  });

  it("maps an exhausted rate limit to WidgetRateLimitError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          apiResponse({}, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1728000000" }),
        ),
      ),
    );

    await expect(fetchRecentCommits({ repository: "octo/repo" })).rejects.toBeInstanceOf(
      WidgetRateLimitError,
    );
  });

  it("reports an unreachable GitHub API as a validation error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));

    await expect(fetchRecentCommits({ repository: "octo/repo" })).rejects.toThrow(
      "could not reach GitHub",
    );
  });
});

describe("fetchUserProfile", () => {
  const PROFILE = {
    login: "octocat",
    name: "monalisa",
    avatar_url: "https://github.com/images/a.png",
    public_repos: 8,
    followers: 100,
  };

  function stubProfileApis() {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.startsWith("https://api.github.com/users/")) {
          return Promise.resolve(apiResponse(PROFILE));
        }
        return Promise.resolve(apiResponse({}, 404));
      }),
    );
  }

  it("rejects a missing username without calling the network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    await expect(fetchUserProfile({ username: "  " })).rejects.toBeInstanceOf(
      WidgetValidationError,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns the profile with null contributions when the heatmap fails", async () => {
    stubProfileApis();

    const res = await fetchUserProfile({ username: "octocat" });
    expect(res.username).toBe("octocat");
    expect(res.name).toBe("monalisa");
    expect(res.publicRepos).toBe(8);
    expect(res.followers).toBe(100);
    expect(res.privateRepos).toBeNull();
    expect(res.contributions).toBeNull();
  });

  it("maps a 404 to a validation error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(apiResponse({}, 404))));

    await expect(fetchUserProfile({ username: "ghost" })).rejects.toThrow("user not found");
  });
});
