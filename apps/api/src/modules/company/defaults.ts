import type { Prisma } from '@prisma/client';
import { DEFAULT_WORKFLOW, type EmailTemplateKey } from '@recruitflow/shared';

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateKey, { name: string; subject: string; body: string }> = {
  APPLICATION_RECEIVED: {
    name: 'Application received',
    subject: 'We received your application for {{jobTitle}}',
    body: 'Hi {{firstName}},\n\nThank you for applying for the {{jobTitle}} role at {{companyName}}. Our team is reviewing your application and will get back to you soon.\n\nBest regards,\n{{senderName}}',
  },
  INTERVIEW_INVITATION: {
    name: 'Interview invitation',
    subject: 'Interview invitation — {{jobTitle}} at {{companyName}}',
    body: "Hi {{firstName}},\n\nWe enjoyed reviewing your profile and would love to invite you to an interview for the {{jobTitle}} role.\n\nPlease share a few time slots that work for you this week.\n\nLooking forward to speaking with you,\n{{senderName}}",
  },
  REJECTED: {
    name: 'Rejected',
    subject: 'Update on your application for {{jobTitle}}',
    body: "Hi {{firstName}},\n\nThank you for your time and interest in {{companyName}}. After careful consideration, we've decided to move forward with other candidates for the {{jobTitle}} role.\n\nWe'll keep your profile on file for future opportunities.\n\nWarm regards,\n{{senderName}}",
  },
  OFFER: {
    name: 'Offer',
    subject: 'Offer from {{companyName}} — {{jobTitle}}',
    body: "Hi {{firstName}},\n\nCongratulations! We're delighted to offer you the {{jobTitle}} position at {{companyName}}. Your formal offer letter is attached and our team will reach out to walk you through the details.\n\nWelcome aboard!\n{{senderName}}",
  },
  FOLLOW_UP: {
    name: 'Follow-up',
    subject: 'Following up on your application',
    body: 'Hi {{firstName}},\n\nI wanted to follow up regarding your application for {{jobTitle}}. Do you have a few minutes this week for a quick call?\n\nThanks,\n{{senderName}}',
  },
};

export function defaultCompanySetup(companyId: string): {
  stages: Prisma.CompanyStageCreateManyInput[];
  templates: Prisma.EmailTemplateCreateManyInput[];
} {
  return {
    stages: DEFAULT_WORKFLOW.map((s, order) => ({ companyId, name: s.name, type: s.type, order })),
    templates: Object.entries(DEFAULT_EMAIL_TEMPLATES).map(([key, t]) => ({ companyId, key, ...t })),
  };
}

export function renderTemplate(template: string, vars: Record<string, string | undefined | null>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}
