/**
 * QA: web link vs mobile OTP password reset on the live local API.
 *
 *   node packages/api/scripts/qa-password-reset-otp.mjs
 *
 * Env: API_URL (default http://localhost:3011), ORIGIN, DATABASE_URL from packages/api/.env
 */
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(here, '..', '.env') });

const BASE = process.env.API_URL ?? 'http://localhost:3011';
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';
const OLD_PASSWORD = 'Password123!';
const NEW_PASSWORD = 'Password456!';
const stamp = Date.now();

/** @type {{ id: string; name: string; pass: boolean; detail?: string }[]} */
const results = [];

function record(id, name, pass, detail = '') {
  results.push({ id, name, pass, detail });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function post(urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data, text };
}

async function signUp(email) {
  return post('/api/auth/sign-up/email', { email, password: OLD_PASSWORD, name: 'QA Reset User' });
}

async function signIn(email, password) {
  return post('/api/auth/sign-in/email', { email, password });
}

async function latestOutbox(prisma, to, after) {
  return prisma.emailOutbox.findFirst({
    where: { to, template: 'password_reset', createdAt: { gte: after } },
    orderBy: { createdAt: 'desc' },
  });
}

async function main() {
  console.log('Password reset QA');
  console.log('API:', BASE);
  console.log('');

  const health = await fetch(`${BASE}/api/health/ready`).then((r) => r.json()).catch((err) => ({ error: String(err) }));
  record('H1', 'API ready', health.ok === true, JSON.stringify(health));
  if (!health.ok) {
    printSummary();
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    console.log('=== Mobile OTP request ===');
    const mobileEmail = `qa-reset-otp-${stamp}@drivemarket.local`;
    const signup = await signUp(mobileEmail);
    record('M0', 'sign up customer', signup.res.ok, `status=${signup.res.status}`);

    const unknownBefore = new Date();
    const unknown = await post('/api/auth/request-password-reset', {
      email: `missing-${stamp}@example.com`,
      isMobile: true,
    });
    record(
      'M1',
      'unknown email still 200',
      unknown.res.status === 200 && unknown.data?.status === true,
      JSON.stringify(unknown.data),
    );
    const leaked = await prisma.verification.findFirst({
      where: { identifier: `password-reset-otp:missing-${stamp}@example.com` },
    });
    record('M2', 'unknown email stores no OTP', !leaked);

    const after = new Date();
    const reqOtp = await post('/api/auth/request-password-reset', {
      email: mobileEmail.toUpperCase(),
      isMobile: true,
    });
    record(
      'M3',
      'isMobile true returns OTP copy, not a link',
      reqOtp.res.status === 200 &&
        reqOtp.data?.status === true &&
        String(reqOtp.data?.message ?? '').toLowerCase().includes('code') &&
        !String(reqOtp.data?.message ?? '').toLowerCase().includes('link'),
      JSON.stringify(reqOtp.data),
    );

    const otpMail = await latestOutbox(prisma, mobileEmail, after);
    const otpPayload = otpMail?.payload && typeof otpMail.payload === 'object' ? otpMail.payload : {};
    const otp = typeof otpPayload.otp === 'string' ? otpPayload.otp : '';
    record(
      'M4',
      'reset email contains OTP, not a portal URL',
      !!otpMail && /^\d{6}$/.test(otp) && !otpPayload.url,
      JSON.stringify({ subject: otpMail?.subject, payload: otpPayload }),
    );

    console.log('=== Mobile OTP confirm ===');
    const missingEmail = await post('/api/auth/reset-password', {
      OTP: otp || '123456',
      newPassword: NEW_PASSWORD,
    });
    record(
      'M5',
      'OTP without email is 400',
      missingEmail.res.status === 400,
      JSON.stringify(missingEmail.data),
    );

    const wrong = await post('/api/auth/reset-password', {
      email: mobileEmail,
      OTP: '000000',
      newPassword: NEW_PASSWORD,
    });
    record(
      'M6',
      'wrong OTP is 400 INVALID_OTP',
      wrong.res.status === 400 && (wrong.data?.code === 'INVALID_OTP' || String(wrong.data?.message ?? '').includes('Invalid')),
      JSON.stringify(wrong.data),
    );

    const oldStillWorks = await signIn(mobileEmail, OLD_PASSWORD);
    record('M7', 'wrong OTP leaves old password', oldStillWorks.res.ok, `status=${oldStillWorks.res.status}`);

    const short = await post('/api/auth/reset-password', {
      email: mobileEmail,
      OTP: otp,
      newPassword: 'short',
    });
    record('M8', 'short password is 400', short.res.status === 400, JSON.stringify(short.data));

    const confirm = await post('/api/auth/reset-password', {
      email: mobileEmail,
      OTP: otp,
      newPassword: NEW_PASSWORD,
    });
    record('M9', 'matching OTP resets password', confirm.res.status === 200 && confirm.data?.status === true, JSON.stringify(confirm.data));

    const oldGone = await signIn(mobileEmail, OLD_PASSWORD);
    record('M10', 'old password rejected after reset', oldGone.res.status === 401 || !oldGone.res.ok, `status=${oldGone.res.status}`);

    const newOk = await signIn(mobileEmail, NEW_PASSWORD);
    record('M11', 'new password signs in', newOk.res.ok, `status=${newOk.res.status}`);

    const reuse = await post('/api/auth/reset-password', {
      email: mobileEmail,
      OTP: otp,
      newPassword: 'Password789!',
    });
    record('M12', 'used OTP cannot be reused', reuse.res.status === 400, JSON.stringify(reuse.data));

    const lowercase = await post('/api/auth/request-password-reset', {
      email: mobileEmail,
      isMobile: true,
    });
    const otpMail2 = await latestOutbox(prisma, mobileEmail, new Date(Date.now() - 2000));
    const otp2 =
      otpMail2?.payload && typeof otpMail2.payload === 'object' && typeof otpMail2.payload.otp === 'string'
        ? otpMail2.payload.otp
        : '';
    const confirmLower = await post('/api/auth/reset-password', {
      email: mobileEmail,
      otp: otp2,
      newPassword: 'Password789!',
    });
    record(
      'M13',
      'lowercase otp alias works',
      lowercase.res.ok && confirmLower.res.status === 200,
      JSON.stringify({ request: lowercase.data, confirm: confirmLower.data, otp: otp2 }),
    );

    console.log('=== Web link flow unchanged ===');
    const webEmail = `qa-reset-web-${stamp}@drivemarket.local`;
    const webSignup = await signUp(webEmail);
    record('W0', 'sign up web customer', webSignup.res.ok, `status=${webSignup.res.status}`);

    const webAfter = new Date();
    const webReq = await post('/api/auth/request-password-reset', { email: webEmail });
    record(
      'W1',
      'omitted isMobile still mentions a reset link',
      webReq.res.status === 200 &&
        webReq.data?.status === true &&
        String(webReq.data?.message ?? '').toLowerCase().includes('link'),
      JSON.stringify(webReq.data),
    );
    const webMail = await latestOutbox(prisma, webEmail, webAfter);
    const webPayload = webMail?.payload && typeof webMail.payload === 'object' ? webMail.payload : {};
    record(
      'W2',
      'web email has url, not otp',
      typeof webPayload.url === 'string' && webPayload.url.includes('/reset-password/') && !webPayload.otp,
      JSON.stringify(webPayload),
    );

    const falseAfter = new Date();
    const falseReq = await post('/api/auth/request-password-reset', { email: webEmail, isMobile: false });
    const falseMail = await latestOutbox(prisma, webEmail, falseAfter);
    const falsePayload = falseMail?.payload && typeof falseMail.payload === 'object' ? falseMail.payload : {};
    record(
      'W3',
      'isMobile false still sends a link',
      falseReq.res.status === 200 && typeof falsePayload.url === 'string' && !falsePayload.otp,
      JSON.stringify({ body: falseReq.data, payload: falsePayload }),
    );

    const tokenMatch = typeof webPayload.url === 'string' ? /\/reset-password\/([^/?]+)/.exec(webPayload.url) : null;
    const token = tokenMatch?.[1] ?? '';
    const webReset = await post('/api/auth/reset-password', { token, newPassword: NEW_PASSWORD });
    record('W4', 'web token still resets password', webReset.res.status === 200 && webReset.data?.status === true, JSON.stringify(webReset.data));
    const webSignIn = await signIn(webEmail, NEW_PASSWORD);
    record('W5', 'web customer signs in with new password', webSignIn.res.ok, `status=${webSignIn.res.status}`);
  } finally {
    await prisma.$disconnect();
  }

  printSummary();
  if (results.some((r) => !r.pass)) process.exit(1);
}

function printSummary() {
  const failed = results.filter((r) => !r.pass);
  console.log('');
  console.log(`Summary: ${results.filter((r) => r.pass).length}/${results.length} passed`);
  if (failed.length) {
    console.log('Failed:');
    for (const row of failed) console.log(`  - ${row.id} ${row.name}${row.detail ? ` — ${row.detail}` : ''}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
