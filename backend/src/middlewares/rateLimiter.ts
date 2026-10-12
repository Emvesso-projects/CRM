import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors/appError";
import { env } from "../config/env";

/**
 * Rate Limiter Middleware
 *
 * Prevents brute-force attacks by limiting requests per IP address.
 */

// General API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  handler: (req: Request, res: Response, next: NextFunction) => {
    next(
      AppError.system.tooManyRequests(
        "Too many requests, please try again later.",
      ),
    );
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Auth-specific rate limiter - 5 requests per 5 minutes (stricter for login/register)
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  handler: (req: Request, res: Response, next: NextFunction) => {
    next(
      AppError.system.tooManyRequests(
        "Too many authentication attempts, please try again after 5 minutes.",
      ),
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => false,
});

/*
 * Signup, step 1 — mail a code. 5 per 15 minutes, matching
 * passwordResetLimiter, because that is now exactly what this does: it creates
 * nothing, it sends an email.
 *
 * It used to be 3 per 30 minutes, set when one request created the whole
 * organization. Left at that, a user who mistyped their address and needed a
 * resend would be locked out mid-signup — the org creation this was protecting
 * now sits behind signupVerifyLimiter and a 6-digit code.
 */
export const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === "development" ? 50 : 5,
  handler: (req: Request, res: Response, next: NextFunction) => {
    next(
      AppError.system.tooManyRequests(
        "Too many signup attempts from this IP. Please try again after 15 minutes.",
      ),
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/*
 * Signup, step 2 — consume the code and create the organization. More
 * permissive than the send limit because a mistyped code must not cost the user
 * their whole signup; blind guessing is bounded by the per-row failedAttempts
 * counter, which burns out at 5 regardless of IP.
 */
export const signupVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === "development" ? 100 : 10,
  handler: (req: Request, res: Response, next: NextFunction) => {
    next(
      AppError.system.tooManyRequests(
        "Too many verification attempts. Please try again after 15 minutes.",
      ),
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Refresh token rate limiter - 10 requests per 5 minutes
export const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  handler: (req: Request, res: Response, next: NextFunction) => {
    next(
      AppError.system.tooManyRequests(
        "Too many token refresh attempts, please try again later.",
      ),
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset rate limiter - 5 requests per 15 minutes
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === "development" ? 50 : 5, // Limit each IP to 5 in prod, 50 in dev
  handler: (req: Request, res: Response, next: NextFunction) => {
    next(
      AppError.system.tooManyRequests(
        "Too many password reset attempts, please try again after 15 minutes.",
      ),
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Reset-link verification/submission limiter - permits normal verify + retry flow
export const passwordResetTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (req: Request, res: Response, next: NextFunction) => {
    next(
      AppError.system.tooManyRequests(
        "Too many password reset attempts, please try again later.",
      ),
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});
