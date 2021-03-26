import * as assert from "uvu/assert";
import fetch from "node-fetch";
import { test } from "uvu";
import { app } from "../uvu-server";

test.before(() => void app.listen(8080));
test.after(() => void app.close());

test("GET / with a correct endpoint", async () => {
  const res = await fetch("http://localhost:8080/test/get");
  assert.is(await res.json(), { success: true });
});

test("POST / with a valid body", async () => {
  const res = await fetch("http://localhost:8080/test/post", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hey" }),
    method: "POST",
  });

  assert.is(res.status, 204);
  assert.type(res.headers.get("X-Example"), "string");
});

test("GET with a query param", async () => {
  const p = Math.floor(Math.random() * 1000).toString();
  const res = await fetch(`http://localhost:8080/test/${p}`);

  assert.is(await res.json(), { hello: p });
});

test("POST / with an invalid body", async () => {
  const res = await fetch("http://localhost:8080/test/post", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ age: 10 }),
    method: "POST",
  });

  assert.is(res.status, 422);
});

test.run();