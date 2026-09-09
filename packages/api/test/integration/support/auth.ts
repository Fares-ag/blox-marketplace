import type { Agent, Test } from 'supertest';
import { TEST_ORIGIN, TEST_PASSWORD } from './env';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

/**
 * superagent sends no `User-Agent` of its own, but every real caller does and
 * the consent ledger records it (PDPPL evidence: who accepted, from where, on
 * what). Sending one keeps the fixtures honest about what the API receives.
 */
export const TEST_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

function withClientHeaders<T extends Test>(req: T): T {
  return req.set('Origin', TEST_ORIGIN).set('User-Agent', TEST_USER_AGENT);
}

export async function signUp(
  agent: Agent,
  email: string,
  name = 'Test User',
  password = TEST_PASSWORD,
) {
  const res = await agent
    .post('/api/auth/sign-up/email')
    .set('Origin', TEST_ORIGIN)
    .send({ email, password, name });
  if (res.status >= 400) {
    throw new Error(`sign-up failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res;
}

export async function signIn(
  agent: Agent,
  email: string,
  password = TEST_PASSWORD,
) {
  const res = await agent
    .post('/api/auth/sign-in/email')
    .set('Origin', TEST_ORIGIN)
    .send({ email, password });
  if (res.status >= 400) {
    throw new Error(`sign-in failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res;
}

export async function signUpFresh(
  agent: Agent,
  label: string,
  name = 'Test User',
) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@integration.test`;
  await signUp(agent, email, name);
  await signIn(agent, email);
  return email;
}

/** Wraps a supertest agent so every HTTP verb sends the CORS Origin and a browser User-Agent. */
export function authed(agent: Agent): Agent {
  const wrapped = {} as Agent;
  for (const method of HTTP_METHODS) {
    wrapped[method] = ((url: string) => withClientHeaders(agent[method](url))) as Agent[typeof method];
  }
  return wrapped;
}
