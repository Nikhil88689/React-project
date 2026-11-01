import { Router } from 'express';
import { talentPoolMemberSchema, talentPoolSchema } from '@recruitflow/shared';
import { errors } from '../../lib/errors';
import { ok, param, parse } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authenticate, companyAuth, requirePermission } from '../../middleware/auth';

export const talentPoolsRouter = Router();
talentPoolsRouter.use(authenticate, requirePermission('talentpool:manage'));

async function findPool(companyId: string, id: string) {
  const pool = await prisma.talentPool.findFirst({ where: { id, companyId } });
  if (!pool) throw errors.notFound('Talent pool');
  return pool;
}

talentPoolsRouter.get('/', async (req, res) => {
  const auth = companyAuth(req);
  const pools = await prisma.talentPool.findMany({
    where: { companyId: auth.companyId },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { members: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      members: {
        take: 5,
        orderBy: { addedAt: 'desc' },
        include: { candidate: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      },
    },
  });
  ok(
    res,
    pools.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      color: p.color,
      count: p._count.members,
      createdBy: `${p.createdBy.firstName} ${p.createdBy.lastName}`,
      createdAt: p.createdAt.toISOString(),
      preview: p.members.map((m) => ({ id: m.candidate.id, name: `${m.candidate.firstName} ${m.candidate.lastName}`, avatarUrl: m.candidate.avatarUrl })),
    })),
  );
});

talentPoolsRouter.post('/', async (req, res) => {
  const auth = companyAuth(req);
  const input = parse(talentPoolSchema, req.body);
  ok(res, await prisma.talentPool.create({ data: { ...input, companyId: auth.companyId, createdById: auth.userId } }), 201);
});

talentPoolsRouter.patch('/:id', async (req, res) => {
  const auth = companyAuth(req);
  const pool = await findPool(auth.companyId, param(req.params.id));
  ok(res, await prisma.talentPool.update({ where: { id: pool.id }, data: parse(talentPoolSchema.partial(), req.body) }));
});

talentPoolsRouter.delete('/:id', async (req, res) => {
  const auth = companyAuth(req);
  const pool = await findPool(auth.companyId, param(req.params.id));
  await prisma.talentPool.delete({ where: { id: pool.id } });
  ok(res, { ok: true });
});

talentPoolsRouter.post('/:id/members', async (req, res) => {
  const auth = companyAuth(req);
  const pool = await findPool(auth.companyId, param(req.params.id));
  const { candidateIds } = parse(talentPoolMemberSchema, req.body);
  const valid = await prisma.candidate.findMany({ where: { id: { in: candidateIds }, companyId: auth.companyId }, select: { id: true } });
  const result = await prisma.talentPoolMember.createMany({
    data: valid.map((c) => ({ poolId: pool.id, candidateId: c.id, addedById: auth.userId })),
    skipDuplicates: true,
  });
  ok(res, { added: result.count }, 201);
});

talentPoolsRouter.delete('/:id/members/:candidateId', async (req, res) => {
  const auth = companyAuth(req);
  const pool = await findPool(auth.companyId, param(req.params.id));
  await prisma.talentPoolMember.deleteMany({ where: { poolId: pool.id, candidateId: param(req.params.candidateId) } });
  ok(res, { ok: true });
});
