import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../server.js";
import { WeatherService } from "../lib/weather.js";
test("weather validates, caches, marks provider and no-data", async () => {
  let calls = 0;
  const w = new WeatherService(
    {
      name: "test",
      async fetch(station) {
        calls++;
        return { metar: "TEST", taf: null };
      },
    },
    10000,
  );
  assert.rejects(() => w.get("BAD"));
  const a = await w.get("VVTS"),
    b = await w.get("VVTS");
  assert.equal(calls, 1);
  assert.equal(a.provider, "test");
  assert.equal(b.cached, true);
});
test("server health, MIME, traversal, station validation", async () => {
  const s = createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  try {
    const base = "http://127.0.0.1:" + s.address().port;
    assert.equal((await fetch(base + "/api/health")).status, 200);
    assert.match(
      (await fetch(base + "/app.js")).headers.get("content-type"),
      /javascript/,
    );
    assert.equal((await fetch(base + "/api/weather?station=XX")).status, 400);
    assert.equal((await fetch(base + "/.env")).status, 404);
    assert.equal(
      (await fetch(base + "/vendor/../../package.json")).status,
      404,
    );
  } finally {
    s.close();
  }
});
