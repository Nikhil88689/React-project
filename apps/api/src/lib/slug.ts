import { shortId } from './crypto';

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const uniqueSlug = (input: string) => `${slugify(input) || 'item'}-${shortId(6)}`;
