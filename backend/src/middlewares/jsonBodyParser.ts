import express, { RequestHandler } from "express";

type JsonOptions = Parameters<typeof express.json>[0];

/**
 * Global JSON body parser that leaves some paths' bodies unread.
 *
 * The Razorpay webhook verifies an HMAC over the exact request bytes, so its
 * router parses with express.raw(). body-parser skips any request whose stream
 * has already been consumed — so if express.json() ran first, express.raw()
 * would do nothing, the handler would receive a parsed object, and every
 * signature check would fail. Skipping those paths here leaves the stream for
 * the route's own parser.
 *
 * A skipped prefix matches itself and anything below it ("/a/b" skips "/a/b"
 * and "/a/b/c", not "/a/bc").
 */
export const jsonBodyParserExcept = (
  skippedPathPrefixes: readonly string[],
  options?: JsonOptions,
): RequestHandler => {
  const parseJson = express.json(options);

  return (req, res, next) => {
    const skip = skippedPathPrefixes.some(
      (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`),
    );
    if (skip) return next();
    return parseJson(req, res, next);
  };
};
