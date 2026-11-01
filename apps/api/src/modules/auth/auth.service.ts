import bcrypt from 'bcryptjs';
import {
  ROLE_PERMISSIONS,
  type AuthUser,
  type CandidateRegisterInput,
  type PlanTier,
  type RegisterInput,
  type Role,
} from '@recruitflow/shared';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { hashToken, randomToken, safeEqual, signAccessToken } from '../../lib/crypto';
import { errors } from '../../lib/errors';
import { emailLayout, sendEmail } from '../../lib/mailer';
import { prisma } from '../../lib/prisma';
import { uniqueSlug } from '../../lib/slug';
import { defaultCompanySetup } from '../company/defaults';

export interface ClientMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: AuthUser;
}

const BCRYPT_ROUNDS = 11;
export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_ROUNDS);
let dummyHash: string | undefined;

/** Picks the workspace + role a user acts as. One active membership per session. */
async function resolveContext(userId: string, preferredCompanyId?: string | null) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const memberships = await prisma.companyMember.findMany({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  const membership = memberships.find((m) => m.companyId === preferredCompanyId) ?? memberships[0];
  let role: Role = 'CANDIDATE';
  if (membership) role = membership.role;
  else if (user.isSuperAdmin) role = 'SUPER_ADMIN';
  return { user, membership, role, companyId: membership?.companyId ?? null };
}

export async function buildAuthUser(userId: string, companyId: string | null): Promise<AuthUser> {
  const { user, membership, role } = await resolveContext(userId, companyId);
  const company = membership
    ? await prisma.company.findUnique({ where: { id: membership.companyId }, include: { subscription: true } })
    : null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    timezone: user.timezone,
    title: membership?.title ?? null,
    role,
    permissions: [...ROLE_PERMISSIONS[role]],
    company: company
      ? {
          id: company.id,
          name: company.name,
          slug: company.slug,
          logoUrl: company.logoUrl,
          onboardingCompleted: company.onboardingCompleted,
          plan: (company.subscription?.plan ?? 'STARTER') as PlanTier,
        }
      : null,
  };
}

/** Refresh tokens are opaque `<sessionId>.<secret>`; only an HMAC of the secret is stored. */
async function issueSession(userId: string, meta: ClientMeta, preferredCompanyId?: string | null): Promise<IssuedTokens> {
  const ctx = await resolveContext(userId, preferredCompanyId);
  const secret = randomToken(32);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400_000);
  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hashToken(secret),
      userAgent: meta.userAgent?.slice(0, 400) ?? null,
      ip: meta.ip ?? null,
      expiresAt,
    },
  });
  return {
    accessToken: signAccessToken({ sub: userId, sid: session.id, cid: ctx.companyId, role: ctx.role }),
    refreshToken: `${session.id}.${secret}`,
    refreshExpiresAt: expiresAt,
    user: await buildAuthUser(userId, ctx.companyId),
  };
}

export async function register(input: RegisterInput, meta: ClientMeta) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw errors.conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const passwordHash = await hashPassword(input.password);
  const { user, company } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, firstName: input.firstName, lastName: input.lastName, passwordHash },
    });
    const company = await tx.company.create({
      data: { name: input.companyName, slug: uniqueSlug(input.companyName), size: input.companySize, industry: input.industry },
    });
    await tx.companyMember.create({ data: { companyId: company.id, userId: user.id, role: 'COMPANY_ADMIN', title: 'Founder' } });
    const setup = defaultCompanySetup(company.id);
    await tx.companyStage.createMany({ data: setup.stages });
    await tx.emailTemplate.createMany({ data: setup.templates });
    await tx.subscription.create({
      data: { companyId: company.id, plan: 'GROWTH', status: 'TRIALING', currentPeriodEnd: new Date(Date.now() + 14 * 86400_000) },
    });
    return { user, company };
  });

  await audit({ companyId: company.id, actorId: user.id, action: 'REGISTER', entityType: 'company', entityId: company.id, summary: `created workspace ${company.name}`, ip: meta.ip });
  return issueSession(user.id, meta, company.id);
}

export async function registerCandidate(input: CandidateRegisterInput, meta: ClientMeta) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw errors.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  const user = await prisma.user.create({
    data: { email: input.email, firstName: input.firstName, lastName: input.lastName, passwordHash: await hashPassword(input.password) },
  });
  // Link any applications previously submitted with this email.
  await prisma.candidate.updateMany({ where: { email: input.email, userId: null }, data: { userId: user.id } });
  return issueSession(user.id, meta);
}

export async function login(email: string, password: string, meta: ClientMeta) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Compare against a dummy hash when the user doesn't exist to keep timing uniform.
  dummyHash ??= await bcrypt.hash('timing-equaliser', BCRYPT_ROUNDS);
  const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !user.passwordHash || !valid) throw errors.unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');

  const tokens = await issueSession(user.id, meta);
  await audit({ companyId: tokens.user.company?.id ?? null, actorId: user.id, action: 'LOGIN', entityType: 'user', entityId: user.id, summary: 'signed in', ip: meta.ip, metadata: { userAgent: meta.userAgent ?? null } });
  return tokens;
}

function splitRefreshToken(raw: string | undefined) {
  if (!raw) return null;
  const [sessionId, secret] = raw.split('.');
  return sessionId && secret ? { sessionId, secret } : null;
}

/** Rotates the refresh token. Presenting an already-rotated token revokes the session (reuse detection). */
export async function refresh(raw: string | undefined, meta: ClientMeta): Promise<IssuedTokens> {
  const parts = splitRefreshToken(raw);
  if (!parts) throw errors.unauthorized('Session expired', 'SESSION_EXPIRED');
  const session = await prisma.session.findUnique({ where: { id: parts.sessionId } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) throw errors.unauthorized('Session expired', 'SESSION_EXPIRED');

  if (!safeEqual(session.refreshTokenHash, hashToken(parts.secret))) {
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    throw errors.unauthorized('Session expired', 'REFRESH_TOKEN_REUSED');
  }

  const secret = randomToken(32);
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash: hashToken(secret), lastUsedAt: new Date(), ip: meta.ip ?? session.ip },
  });
  const ctx = await resolveContext(session.userId);
  return {
    accessToken: signAccessToken({ sub: session.userId, sid: session.id, cid: ctx.companyId, role: ctx.role }),
    refreshToken: `${session.id}.${secret}`,
    refreshExpiresAt: session.expiresAt,
    user: await buildAuthUser(session.userId, ctx.companyId),
  };
}

export async function logout(raw: string | undefined, actor?: { userId: string; companyId: string | null }) {
  const parts = splitRefreshToken(raw);
  if (parts) await prisma.session.updateMany({ where: { id: parts.sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (actor) await audit({ companyId: actor.companyId, actorId: actor.userId, action: 'LOGOUT', entityType: 'user', entityId: actor.userId, summary: 'signed out' });
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // Never reveal whether an account exists.
  const token = randomToken(32);
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) } });
  const url = `${env.APP_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your RecruitFlow password',
    html: emailLayout('Reset your password', `<p>Hi ${user.firstName},</p><p>Use the button below to choose a new password. This link expires in 1 hour.</p>`, { label: 'Reset password', url }),
    text: `Reset your password: ${url}`,
  });
}

export async function resetPassword(token: string, password: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw errors.badRequest('This reset link is invalid or has expired', undefined, 'INVALID_RESET_TOKEN');
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function changePassword(userId: string, sessionId: string, current: string, next: string, companyId: string | null) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash || !(await bcrypt.compare(current, user.passwordHash))) {
    throw errors.badRequest('Current password is incorrect', undefined, 'INVALID_PASSWORD');
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } }),
    prisma.session.updateMany({ where: { userId, id: { not: sessionId }, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit({ companyId, actorId: userId, action: 'CHANGE_PASSWORD', entityType: 'user', entityId: userId, summary: 'changed their password' });
}

export function describeUserAgent(ua: string | null) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown' };
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /node|undici|curl|axios|Playwright/i.test(ua) ? 'API client' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown';
  return { browser, os };
}

export async function listSessions(userId: string, currentSessionId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
  });
  return sessions.map((s) => ({
    id: s.id,
    ...describeUserAgent(s.userAgent),
    ip: s.ip,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    current: s.id === currentSessionId,
  }));
}

export async function revokeSession(userId: string, sessionId: string, companyId: string | null) {
  const result = await prisma.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!result.count) throw errors.notFound('Session');
  await audit({ companyId, actorId: userId, action: 'REVOKE_SESSION', entityType: 'session', entityId: sessionId, summary: 'revoked a session' });
}

export async function loginHistory(userId: string) {
  const logs = await prisma.auditLog.findMany({
    where: { actorId: userId, action: { in: ['LOGIN', 'LOGOUT'] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    ip: l.ip,
    createdAt: l.createdAt.toISOString(),
    ...describeUserAgent(((l.metadata as { userAgent?: string } | null)?.userAgent as string) ?? null),
  }));
}

export async function getInvitation(token: string) {
  const invite = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { company: true } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) throw errors.badRequest('This invitation is invalid or has expired', undefined, 'INVALID_INVITE');
  const existingUser = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } });
  return { invite, existingUser: Boolean(existingUser) };
}

export async function acceptInvite(input: { token: string; firstName: string; lastName: string; password: string }, meta: ClientMeta) {
  const { invite } = await getInvitation(input.token);
  let user = await prisma.user.findUnique({ where: { email: invite.email } });
  if (user) {
    if (!user.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw errors.unauthorized('An account exists for this email — enter its current password to join', 'INVALID_CREDENTIALS');
    }
  } else {
    user = await prisma.user.create({
      data: { email: invite.email, firstName: input.firstName, lastName: input.lastName, passwordHash: await hashPassword(input.password), emailVerified: true },
    });
  }
  await prisma.$transaction([
    prisma.companyMember.upsert({
      where: { companyId_userId: { companyId: invite.companyId, userId: user.id } },
      create: { companyId: invite.companyId, userId: user.id, role: invite.role, status: 'ACTIVE' },
      update: { role: invite.role, status: 'ACTIVE' },
    }),
    prisma.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
  ]);
  return issueSession(user.id, meta, invite.companyId);
}
