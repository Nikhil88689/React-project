import type { AssistantReply, CandidateFilters, StageType } from '@recruitflow/shared';
import { extractSkills } from './skills';

export type ParsedIntent =
  | { intent: 'SEARCH_CANDIDATES'; filters: CandidateFilters }
  | { intent: 'PENDING_FEEDBACK' }
  | { intent: 'STAGE_STATS'; stage: StageType; sinceDays: number; label: string }
  | { intent: 'DRAFT_EMAIL'; nameQuery: string | null; topic: 'RESCHEDULE' | 'REJECTION' | 'OFFER' | 'FOLLOW_UP' | 'INTERVIEW' }
  | { intent: 'HELP' };

const STAGE_WORDS: [RegExp, StageType][] = [
  [/\binterview(s|ing|ed)?\b/i, 'INTERVIEW'],
  [/\boffers?\b/i, 'OFFER'],
  [/\bhired?\b|\bhires\b/i, 'HIRED'],
  [/\bshortlist(ed)?\b/i, 'SHORTLISTED'],
  [/\bscreen(ing|ed)?\b/i, 'SCREENING'],
  [/\breject(ed|ion)?\b/i, 'REJECTED'],
  [/\bappl(ied|ications?)\b/i, 'APPLIED'],
];

const LOCATIONS = ['Bangalore', 'Bengaluru', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai', 'Delhi', 'Gurugram', 'Noida', 'Kolkata', 'Remote'];

function window(text: string): { days: number; label: string } {
  if (/\btoday\b/i.test(text)) return { days: 1, label: 'today' };
  if (/\bthis month\b|\blast 30 days\b/i.test(text)) return { days: 30, label: 'this month' };
  if (/\bthis quarter\b|\blast 90 days\b/i.test(text)) return { days: 90, label: 'this quarter' };
  return { days: 7, label: 'this week' };
}

/**
 * Converts recruiter natural language into a structured intent + filters.
 * The backend then executes the structured query — the model never touches SQL.
 */
export function parseRecruiterQuery(message: string): ParsedIntent {
  const text = message.trim();

  if (/(waiting|pending|awaiting|missing|overdue).{0,20}feedback|feedback.{0,20}(pending|missing|due)/i.test(text)) {
    return { intent: 'PENDING_FEEDBACK' };
  }

  if (/\b(draft|write|compose|prepare)\b.{0,40}\b(email|mail|message|note)\b/i.test(text)) {
    const nameQuery = text.match(/\b(?:to|for)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)?.[1] ?? null;
    const topic = /reschedul/i.test(text)
      ? 'RESCHEDULE'
      : /reject|decline|not moving/i.test(text)
        ? 'REJECTION'
        : /offer/i.test(text)
          ? 'OFFER'
          : /interview|invite/i.test(text)
            ? 'INTERVIEW'
            : 'FOLLOW_UP';
    return { intent: 'DRAFT_EMAIL', nameQuery, topic };
  }

  if (/\b(how many|count|number of|total)\b/i.test(text)) {
    const stage = STAGE_WORDS.find(([re]) => re.test(text))?.[1] ?? 'APPLIED';
    const w = window(text);
    return { intent: 'STAGE_STATS', stage, sinceDays: w.days, label: w.label };
  }

  const filters: CandidateFilters = {};
  const skills = extractSkills(text);
  if (skills.length) filters.skills = skills;
  const years = text.match(/(\d{1,2})\s*\+?\s*(?:years|yrs|yoe)/i);
  if (years) filters.minExperience = Number(years[1]);
  const location = LOCATIONS.find((l) => new RegExp(`\\b${l}\\b`, 'i').test(text));
  if (location) filters.location = location === 'Bengaluru' ? 'Bangalore' : location;
  if (/\b(available|immediate(ly)?|immediate joiner)\b/i.test(text)) filters.availability = 'IMMEDIATE';
  const match = text.match(/(\d{2})\s*%?\s*\+?\s*match|match(?:\s*score)?\s*(?:above|over|>|>=)\s*(\d{2})/i);
  if (match) filters.minMatch = Number(match[1] ?? match[2]);
  const stage = STAGE_WORDS.find(([re]) => re.test(text))?.[1];
  if (stage && stage !== 'APPLIED') filters.stage = stage;

  if (Object.keys(filters).length || /\b(candidates?|developers?|engineers?|designers?|people|profiles?|show|find|search)\b/i.test(text)) {
    if (!Object.keys(filters).length) {
      const term = text.replace(/\b(show|find|search|me|all|the|candidates?|for|with|who|are|list)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      if (term) filters.search = term;
    }
    return { intent: 'SEARCH_CANDIDATES', filters };
  }

  return { intent: 'HELP' };
}

export function describeFilters(f: CandidateFilters): string {
  const parts: string[] = [];
  if (f.skills?.length) parts.push(f.skills.join(', '));
  if (f.minExperience != null) parts.push(`${f.minExperience}+ years`);
  if (f.location) parts.push(f.location);
  if (f.availability) parts.push('available immediately');
  if (f.stage) parts.push(`in ${f.stage.toLowerCase()} stage`);
  if (f.minMatch) parts.push(`${f.minMatch}%+ match`);
  if (f.search) parts.push(`"${f.search}"`);
  return parts.join(' · ');
}

export const HELP_REPLY: Omit<AssistantReply, 'engine'> = {
  intent: 'HELP',
  message:
    'I can search candidates, surface interviews waiting on feedback, report pipeline numbers, and draft emails. Try:\n' +
    '• "Show me React candidates with 3+ years experience"\n' +
    '• "Which candidates are waiting for feedback?"\n' +
    '• "How many candidates entered interview stage this week?"\n' +
    '• "Draft an email to Rahul about rescheduling"',
};
