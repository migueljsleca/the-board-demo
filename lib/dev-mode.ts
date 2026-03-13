type MinimalSession = {
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
} | null;

const DEFAULT_DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_DEV_USER_NAME = "Local Dev User";
const DEFAULT_DEV_USER_EMAIL = "local@dev.invalid";

export function isAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_AUTH === "1";
}

export function isNoDatabaseDemoMode() {
  return isAuthBypassEnabled() && !process.env.POSTGRES_URL;
}

export function getDevBypassUserId() {
  const userId = process.env.DEV_BYPASS_USER_ID?.trim();
  return userId || DEFAULT_DEV_USER_ID;
}

export function getRequestUserId(session: MinimalSession) {
  const sessionUserId = session?.user?.id;
  if (sessionUserId && sessionUserId.trim()) return sessionUserId;
  if (isAuthBypassEnabled()) return getDevBypassUserId();
  return null;
}

export function getDemoViewer() {
  return {
    id: getDevBypassUserId(),
    name: process.env.DEV_BYPASS_USER_NAME?.trim() || DEFAULT_DEV_USER_NAME,
    email: process.env.DEV_BYPASS_USER_EMAIL?.trim() || DEFAULT_DEV_USER_EMAIL,
    image: null as string | null,
  };
}
