import crypto from "crypto";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { jsonBodyParserExcept } from "./jsonBodyParser";

const WEBHOOK_PATH = "/api/v1/billing/webhook";
const SECRET = "test-webhook-secret";

let server: Server;
let baseUrl: string;

/**
 * Mirrors the real wiring: the global parser runs first, then a router that
 * parses its own body with express.raw() — exactly what app.ts and
 * webhook.route.ts do.
 */
beforeAll(async () => {
  const app = express();
  app.use(jsonBodyParserExcept([WEBHOOK_PATH]));

  const webhook = express.Router();
  webhook.post("/razorpay", express.raw({ type: "application/json" }), (req, res) => {
    const body = req.body as unknown;
    res.json({
      isBuffer: Buffer.isBuffer(body),
      hmac: Buffer.isBuffer(body)
        ? crypto.createHmac("sha256", SECRET).update(body).digest("hex")
        : null,
    });
  });
  app.use(WEBHOOK_PATH, webhook);

  app.post("/api/v1/leads", (req, res) => res.json({ received: req.body }));
  app.post(`${WEBHOOK_PATH}s`, (req, res) => res.json({ received: req.body }));

  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const postJson = (path: string, payload: string) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  }).then((res) => res.json());

describe("jsonBodyParserExcept", () => {
  it("leaves the webhook body as the raw bytes, so its HMAC matches the sender's", async () => {
    // Spacing is deliberate: re-serializing a parsed object would drop it and
    // change the signature.
    const payload = '{"event": "payment.captured",  "id": 1}';
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");

    const result = await postJson(`${WEBHOOK_PATH}/razorpay`, payload);

    expect(result).toEqual({ isBuffer: true, hmac: expected });
  });

  it("still parses JSON on every other route", async () => {
    const result = await postJson("/api/v1/leads", '{"name":"Acme"}');

    expect(result).toEqual({ received: { name: "Acme" } });
  });

  it("does not skip a sibling path that merely shares the prefix", async () => {
    const result = await postJson(`${WEBHOOK_PATH}s`, '{"a":1}');

    expect(result).toEqual({ received: { a: 1 } });
  });
});
