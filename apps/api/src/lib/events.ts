import { EventEmitter } from 'node:events';
import type { StageType } from '@recruitflow/shared';
import { logger } from './logger';

/**
 * In-process domain event bus. Producers (services) publish facts; consumers
 * (notifications, email, cache, sockets) react independently. Swapping this for
 * Redis Streams / SNS later doesn't change producers.
 */
export interface DomainEvents {
  'candidate.applied': { companyId: string; applicationId: string; candidateId: string; jobId: string; actorId: string | null };
  'application.moved': {
    companyId: string;
    applicationId: string;
    candidateId: string;
    candidateName: string;
    jobId: string;
    jobTitle: string;
    fromStageName: string | null;
    toStageName: string;
    toStageType: StageType;
    actorId: string | null;
    actorName: string | null;
  };
  'interview.scheduled': { companyId: string; interviewId: string; actorId: string };
  'interview.updated': { companyId: string; interviewId: string; actorId: string; change: 'RESCHEDULED' | 'CANCELLED' | 'UPDATED' };
  'feedback.submitted': { companyId: string; interviewId: string; feedbackId: string; actorId: string };
  'job.published': { companyId: string; jobId: string; actorId: string };
  'resume.parsed': { companyId: string; candidateId: string; applicationId?: string; success: boolean };
}

type EventName = keyof DomainEvents;

const bus = new EventEmitter();
bus.setMaxListeners(50);

export function publish<E extends EventName>(event: E, payload: DomainEvents[E]) {
  bus.emit(event, payload);
}

export function subscribe<E extends EventName>(event: E, handler: (payload: DomainEvents[E]) => Promise<void> | void) {
  bus.on(event, (payload: DomainEvents[E]) => {
    Promise.resolve(handler(payload)).catch((err) => logger.error({ err, event }, 'Event handler failed'));
  });
}
