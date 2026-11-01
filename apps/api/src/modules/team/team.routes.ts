import { Router } from 'express';
import { ROLE_LABELS, inviteMemberSchema, updateMemberSchema, type TeamMemberDTO } from '@recruitflow/shared';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { hashToken, randomToken } from '../../lib/crypto';
import { errors } from '../../lib/errors';
import { ok, param, parse } from '../../lib/http';
import { emailLayout } from '../../lib/mailer';
import { prisma } from '../../lib/prisma';
import { enqueue } from '../../lib/queue';
import { authenticate, companyAuth, requirePermission } from '../../middleware/auth';
import { assertWithinLimit } from '../billing/limits';

export const teamRouter = Router();
teamRouter.use(authenticate);

teamRouter.get('/', requirePermission('team:view'), async (req, res) => {
  const auth = companyAuth(req);
  const [members, invitations] = await Promise.all([
    prisma.companyMember.findMany({
      where: { companyId: auth.companyId },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, lastActiveAt: true } } },
    }),
    prisma.invitation.findMany({
      where: { companyId: auth.companyId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      include: { invitedBy: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  const dto: TeamMemberDTO[] = members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: `${m.user.firstName} ${m.user.lastName}`,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
    title: m.title,
    status: m.status,
    lastActiveAt: m.user.lastActiveAt?.toISOString() ?? null,
    joinedAt: m.joinedAt?.toISOString() ?? null,
  }));
  ok(res, {
    members: dto,
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      invitedBy: `${i.invitedBy.firstName} ${i.invitedBy.lastName}`,
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
    })),
  });
});

teamRouter.post('/invitations', requirePermission('team:manage'), async (req, res) => {
  const auth = companyAuth(req);
  const input = parse(inviteMemberSchema, req.body);
  const existingMember = await prisma.companyMember.findFirst({ where: { companyId: auth.companyId, user: { email: input.email } } });
  if (existingMember) throw errors.conflict('This person is already on your team', 'ALREADY_MEMBER');
  await assertWithinLimit(auth.companyId, 'teamMembers');

  await prisma.invitation.deleteMany({ where: { companyId: auth.companyId, email: input.email, acceptedAt: null } });
  const token = randomToken(32);
  const invite = await prisma.invitation.create({
    data: { companyId: auth.companyId, email: input.email, role: input.role, tokenHash: hashToken(token), invitedById: auth.userId, expiresAt: new Date(Date.now() + 7 * 86400_000) },
    include: { company: true, invitedBy: true },
  });
  const url = `${env.APP_URL}/accept-invite?token=${token}`;
  await enqueue('email.send', {
    to: input.email,
    subject: `${invite.invitedBy.firstName} invited you to ${invite.company.name} on RecruitFlow`,
    html: emailLayout(
      `Join ${invite.company.name} on RecruitFlow`,
      `<p>${invite.invitedBy.firstName} ${invite.invitedBy.lastName} invited you to join as <b>${ROLE_LABELS[input.role]}</b>.</p><p>This invitation expires in 7 days.</p>`,
      { label: 'Accept invitation', url },
    ),
  });
  await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'INVITE_MEMBER', entityType: 'invitation', entityId: invite.id, summary: `invited ${input.email} as ${ROLE_LABELS[input.role]}` });
  ok(res, { id: invite.id, email: invite.email, role: invite.role, ...(env.NODE_ENV !== 'production' ? { devInviteUrl: url } : {}) }, 201);
});

teamRouter.delete('/invitations/:id', requirePermission('team:manage'), async (req, res) => {
  const auth = companyAuth(req);
  const result = await prisma.invitation.deleteMany({ where: { id: param(req.params.id), companyId: auth.companyId } });
  if (!result.count) throw errors.notFound('Invitation');
  ok(res, { ok: true });
});

async function assertNotLastAdmin(companyId: string, memberId: string) {
  const admins = await prisma.companyMember.count({ where: { companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE', id: { not: memberId } } });
  if (admins === 0) throw errors.conflict('A workspace needs at least one active admin', 'LAST_ADMIN');
}

teamRouter.patch('/:memberId', requirePermission('team:manage'), async (req, res) => {
  const auth = companyAuth(req);
  const input = parse(updateMemberSchema, req.body);
  const member = await prisma.companyMember.findFirst({ where: { id: param(req.params.memberId), companyId: auth.companyId }, include: { user: true } });
  if (!member) throw errors.notFound('Member');
  if (member.userId === auth.userId) throw errors.badRequest("You can't change your own role or status", undefined, 'SELF_UPDATE');
  if (member.role === 'COMPANY_ADMIN' && ((input.role && input.role !== 'COMPANY_ADMIN') || input.status === 'DISABLED')) {
    await assertNotLastAdmin(auth.companyId, member.id);
  }
  const updated = await prisma.companyMember.update({ where: { id: member.id }, data: input });
  if (input.role && input.role !== member.role) {
    await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'CHANGE_ROLE', entityType: 'member', entityId: member.id, summary: `changed ${member.user.firstName} ${member.user.lastName}'s role from ${ROLE_LABELS[member.role]} to ${ROLE_LABELS[input.role]}`, metadata: { from: member.role, to: input.role } });
  }
  ok(res, { id: updated.id, role: updated.role, status: updated.status });
});

teamRouter.delete('/:memberId', requirePermission('team:manage'), async (req, res) => {
  const auth = companyAuth(req);
  const member = await prisma.companyMember.findFirst({ where: { id: param(req.params.memberId), companyId: auth.companyId }, include: { user: true } });
  if (!member) throw errors.notFound('Member');
  if (member.userId === auth.userId) throw errors.badRequest("You can't remove yourself", undefined, 'SELF_REMOVE');
  if (member.role === 'COMPANY_ADMIN') await assertNotLastAdmin(auth.companyId, member.id);
  await prisma.companyMember.delete({ where: { id: member.id } });
  await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'REMOVE_MEMBER', entityType: 'member', entityId: member.id, summary: `removed ${member.user.firstName} ${member.user.lastName} from the team` });
  ok(res, { ok: true });
});
