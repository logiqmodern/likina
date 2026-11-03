export const E2E_PORT = 3300;

export const E2E_ENV = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://app:app@localhost:5432/likina_e2e",
  APP_URL: `http://127.0.0.1:${E2E_PORT}`,
  SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123456789",
  ADMIN_SETUP_TOKEN: "e2e-admin-setup-token-0123456789",
};
