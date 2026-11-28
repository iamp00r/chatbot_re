// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ execute }) }));

const { GET } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  beforeEach(() => {
    execute.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("DB에 닿으면 200과 db: up", async () => {
    execute.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "up" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("DB 오류면 503이고 오류 원문을 응답에 담지 않는다", async () => {
    execute.mockRejectedValue(new Error("password authentication failed for user secret"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ ok: false, db: "down" });
    expect(body).not.toContain("secret");
  });
});
