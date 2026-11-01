import sanitizeHtml from 'sanitize-html';
import type { JobDescription } from '@recruitflow/shared';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'a', 'code', 'pre', 'hr'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }) },
};

/** Rich-text fields are rendered on public pages, so only a small formatting allowlist survives. */
export const sanitizeRichText = (html: string) => sanitizeHtml(html, OPTIONS);

export function sanitizeJobDescription(d: JobDescription): JobDescription {
  return {
    about: sanitizeRichText(d.about),
    responsibilities: sanitizeRichText(d.responsibilities),
    requirements: sanitizeRichText(d.requirements),
    niceToHave: sanitizeRichText(d.niceToHave),
    benefits: sanitizeRichText(d.benefits),
  };
}
