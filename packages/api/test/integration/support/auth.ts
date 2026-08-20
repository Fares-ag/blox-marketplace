import type { Agent, Test } from 'supertest';
import { TEST_ORIGIN, TEST_PASSWORD } from './env';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

function withOrigin<T extends Test>(req: T): T {
  return req.set('Origin', TEST_ORIGIN);
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

/** Wraps a supertest agent so every HTTP verb sends the CORS Origin header. */
export function authed(agent: Agent): Agent {
  const wrapped = {} as Agent;
  for (const method of HTTP_METHODS) {
    wrapped[method] = ((url: string) => withOrigin(agent[method](url))) as Agent[typeof method];
  }
  return wrapped;
}
