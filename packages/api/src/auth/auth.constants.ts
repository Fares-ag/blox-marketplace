import type { DmAuth } from './auth';

/** Nest DI token for the Better Auth instance (replaces global.__dmAuth). */
export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

export type AuthInstance = DmAuth;
