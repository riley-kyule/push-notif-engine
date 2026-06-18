export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");
export const AUTH_SERVICE = Symbol("AUTH_SERVICE");
export const TOKEN_SERVICE = Symbol("TOKEN_SERVICE");
export const PASSWORD_SERVICE = Symbol("PASSWORD_SERVICE");

export const ROLE_ORDER = ["super-admin", "admin", "editor", "analyst"] as const;
