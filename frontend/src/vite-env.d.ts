/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Business timezone for dates and times; must match the backend's APP_TIMEZONE. */
  readonly VITE_APP_TIMEZONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
