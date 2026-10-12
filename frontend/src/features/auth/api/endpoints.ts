export const AUTH_ENDPOINTS = {
  SIGNUP: "/auth/signup",
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
  ME: "/auth/me",
  PROFILE: "/auth/profile",
  CHANGE_PASSWORD: "/auth/change-password",
  FORGOT_PASSWORD_GENERATE_OTP: "/auth/forgot-password/generate-otp",
  FORGOT_PASSWORD_RESET: "/auth/forgot-password/reset",
  REFRESH_TOKEN: "/auth/refresh",
  /** Step 2 of signup — consumes the emailed code and creates the account. */
  SIGNUP_VERIFY: "/auth/signup/verify",
};
