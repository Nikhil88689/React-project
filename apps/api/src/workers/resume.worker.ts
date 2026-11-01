import type { Prisma, ProcessingStep } from '@prisma/client';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { isProd } from '../config/env';
import { publish } from '../lib/events';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import type { JobPayloads } from '../lib/queue';
import { detectFileType, storage } from '../lib/storage';
import { matchApplication, parseResume } from '../modules/ai/ai.service';
import { normalizeSkill } from '../modules/ai/engine/skills';

const pause = (ms: number) => (isProd ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

async function setStep(candidateId: string, step: ProcessingStep) {
  await prisma.candidate.update({ where: { id: candidateId }, data: { parseStatus: step } });
}

export async function extractResumeText(buf: Buffer): Promise<string> {
  const type = detectFileType(buf);
  if (type === 'pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join('\n') : text;
  }
  if (type === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  throw new Error('Unsupported file signature');
}

/**
 * Resume pipeline: Processing → Extracting text → Parsing → AI analysis → Complete.
 * Parsed data only fills gaps — anything the candidate typed in the form wins.
 */
export async function processResume({ fileId, candidateId, applicationId, companyId }: JobPayloads['resume.process']) {
  try {
    await setStep(candidateId, 'PROCESSING');
    const file = await prisma.file.findUniqueOrThrow({ where: { id: fileId } });
    const buf = await storage.getObject(file.storageKey);
    await pause(500);

    await setStep(candidateId, 'EXTRACTING');
    const text = (await extractResumeText(buf)).replace(/\u0000/g, '').slice(0, 60_000);
    await pause(500);

    await setStep(candidateId, 'PARSING');
    const { parsed } = await parseResume(text);
    const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });

    await prisma.$transaction(async (tx) => {
      await tx.candidate.update({
        where: { id: candidateId },
        data: {
          resumeText: text,
          headline: candidate.headline ?? parsed.headline ?? parsed.experiences[0]?.title ?? null,
          location: candidate.location ?? parsed.location,
          phone: candidate.phone ?? parsed.phone,
          linkedinUrl: candidate.linkedinUrl ?? (parsed.linkedinUrl ? `https://${parsed.linkedinUrl.replace(/^https?:\/\//, '')}` : null),
          githubUrl: candidate.githubUrl ?? (parsed.githubUrl ? `https://${parsed.githubUrl.replace(/^https?:\/\//, '')}` : null),
          experienceYears: candidate.experienceYears ?? parsed.totalYears,
          currentCompany: candidate.currentCompany ?? parsed.experiences[0]?.company ?? null,
          summary: candidate.summary ?? parsed.summary,
          projects: parsed.projects,
          certifications: parsed.certifications,
        },
      });
      if (parsed.skills.length) {
        await tx.candidateSkill.deleteMany({ where: { candidateId } });
        const seen = new Set<string>();
        await tx.candidateSkill.createMany({
          data: parsed.skills
            .map((s) => ({ name: normalizeSkill(s.name), years: s.years }))
            .filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)))
            .map((s) => ({ candidateId, ...s })),
        });
      }
      if (parsed.experiences.length) {
        await tx.candidateExperience.deleteMany({ where: { candidateId } });
        await tx.candidateExperience.createMany({
          data: parsed.experiences.map((e) => ({
            candidateId,
            company: e.company,
            title: e.title,
            startDate: new Date(e.startDate),
            endDate: e.endDate ? new Date(e.endDate) : null,
            description: e.description,
          })),
        });
      }
      if (parsed.educations.length) {
        await tx.candidateEducation.deleteMany({ where: { candidateId } });
        await tx.candidateEducation.createMany({ data: parsed.educations.map((e) => ({ candidateId, ...e })) });
      }
      await tx.aiAnalysis.create({ data: { companyId, kind: 'RESUME_PARSE', candidateId, result: parsed as unknown as Prisma.InputJsonValue, engine: 'parser' } });
    });

    await setStep(candidateId, 'ANALYZING');
    await pause(400);
    const apps = applicationId ? [{ id: applicationId }] : await prisma.application.findMany({ where: { candidateId }, select: { id: true } });
    for (const app of apps) await matchApplication(app.id, { refresh: true });

    await setStep(candidateId, 'COMPLETE');
    publish('resume.parsed', { companyId, candidateId, applicationId, success: true });
  } catch (err) {
    logger.error({ err, candidateId, fileId }, 'Resume processing failed');
    await setStep(candidateId, 'FAILED').catch(() => undefined);
    publish('resume.parsed', { companyId, candidateId, applicationId, success: false });
  }
}
