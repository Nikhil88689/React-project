/**
 * Canonical skill taxonomy. Aliases map free-text mentions ("reactjs", "k8s") onto a
 * single canonical name so matching compares like with like.
 * `loose` aliases are only accepted from explicit skill lists, never from prose,
 * because they produce false positives ("go to market", "ts" in words…).
 */
interface SkillDef {
  aliases: string[];
  loose?: string[];
  family: 'frontend' | 'backend' | 'data' | 'devops' | 'mobile' | 'design' | 'general' | 'testing';
}

export const SKILLS: Record<string, SkillDef> = {
  React: { aliases: ['react', 'react.js', 'reactjs'], family: 'frontend' },
  'Next.js': { aliases: ['next.js', 'nextjs'], family: 'frontend' },
  TypeScript: { aliases: ['typescript'], loose: ['ts'], family: 'frontend' },
  JavaScript: { aliases: ['javascript', 'es6', 'ecmascript'], loose: ['js'], family: 'frontend' },
  Redux: { aliases: ['redux', 'redux toolkit', 'rtk'], family: 'frontend' },
  'Vue.js': { aliases: ['vue', 'vue.js', 'vuejs'], family: 'frontend' },
  Angular: { aliases: ['angular'], family: 'frontend' },
  HTML: { aliases: ['html', 'html5'], family: 'frontend' },
  CSS: { aliases: ['css', 'css3', 'scss', 'sass'], family: 'frontend' },
  'Tailwind CSS': { aliases: ['tailwind', 'tailwindcss', 'tailwind css'], family: 'frontend' },
  'React Query': { aliases: ['react query', 'tanstack query'], family: 'frontend' },
  Webpack: { aliases: ['webpack'], family: 'frontend' },
  Vite: { aliases: ['vite'], family: 'frontend' },
  'React Native': { aliases: ['react native', 'react-native'], family: 'mobile' },
  Flutter: { aliases: ['flutter', 'dart'], family: 'mobile' },
  'Node.js': { aliases: ['node', 'node.js', 'nodejs'], family: 'backend' },
  Express: { aliases: ['express', 'express.js', 'expressjs'], family: 'backend' },
  NestJS: { aliases: ['nestjs', 'nest.js'], family: 'backend' },
  'REST APIs': { aliases: ['rest', 'rest api', 'rest apis', 'restful', 'restful apis'], family: 'backend' },
  GraphQL: { aliases: ['graphql', 'apollo'], family: 'backend' },
  Python: { aliases: ['python'], family: 'backend' },
  Django: { aliases: ['django'], family: 'backend' },
  FastAPI: { aliases: ['fastapi'], family: 'backend' },
  Java: { aliases: ['java'], family: 'backend' },
  'Spring Boot': { aliases: ['spring boot', 'spring'], family: 'backend' },
  Go: { aliases: ['golang'], loose: ['go'], family: 'backend' },
  Microservices: { aliases: ['microservices', 'micro-services', 'microservice'], family: 'backend' },
  'Socket.IO': { aliases: ['socket.io', 'websockets', 'websocket'], family: 'backend' },
  Kafka: { aliases: ['kafka'], family: 'backend' },
  PostgreSQL: { aliases: ['postgresql', 'postgres', 'psql'], family: 'data' },
  MySQL: { aliases: ['mysql'], family: 'data' },
  MongoDB: { aliases: ['mongodb', 'mongo', 'mongoose'], family: 'data' },
  Redis: { aliases: ['redis'], family: 'data' },
  SQL: { aliases: ['sql'], family: 'data' },
  Prisma: { aliases: ['prisma'], family: 'data' },
  'Machine Learning': { aliases: ['machine learning', 'deep learning', 'pytorch', 'tensorflow'], loose: ['ml'], family: 'data' },
  'Data Analysis': { aliases: ['data analysis', 'pandas', 'numpy', 'power bi', 'tableau'], family: 'data' },
  AWS: { aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'cloudfront', 'rds'], family: 'devops' },
  GCP: { aliases: ['gcp', 'google cloud'], family: 'devops' },
  Azure: { aliases: ['azure'], family: 'devops' },
  Docker: { aliases: ['docker', 'containers', 'docker compose'], family: 'devops' },
  Kubernetes: { aliases: ['kubernetes', 'k8s', 'helm'], family: 'devops' },
  Terraform: { aliases: ['terraform'], family: 'devops' },
  'CI/CD': { aliases: ['ci/cd', 'github actions', 'jenkins', 'gitlab ci', 'circleci'], family: 'devops' },
  Linux: { aliases: ['linux', 'bash', 'shell scripting'], family: 'devops' },
  Git: { aliases: ['git', 'github', 'gitlab'], family: 'general' },
  'System Design': { aliases: ['system design', 'distributed systems', 'scalability'], family: 'backend' },
  Jest: { aliases: ['jest'], family: 'testing' },
  'React Testing Library': { aliases: ['react testing library', 'testing library', 'rtl'], family: 'testing' },
  Cypress: { aliases: ['cypress'], family: 'testing' },
  Playwright: { aliases: ['playwright'], family: 'testing' },
  Figma: { aliases: ['figma'], family: 'design' },
  'UI Design': { aliases: ['ui design', 'visual design', 'design systems'], family: 'design' },
  'UX Research': { aliases: ['ux research', 'user research', 'usability testing'], family: 'design' },
  Agile: { aliases: ['agile', 'scrum', 'kanban', 'jira'], family: 'general' },
  'Product Management': { aliases: ['product management', 'roadmapping', 'product strategy'], family: 'general' },
};

const lookup = new Map<string, string>();
const looseLookup = new Map<string, string>();
for (const [canonical, def] of Object.entries(SKILLS)) {
  lookup.set(canonical.toLowerCase(), canonical);
  for (const alias of def.aliases) lookup.set(alias, canonical);
  for (const alias of def.loose ?? []) looseLookup.set(alias, canonical);
}

/** Maps a skill label from a structured list onto its canonical name (or a title-cased fallback). */
export function normalizeSkill(raw: string): string {
  const key = raw.trim().toLowerCase();
  return lookup.get(key) ?? looseLookup.get(key) ?? raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function skillFamily(canonical: string) {
  return SKILLS[canonical]?.family ?? 'general';
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const aliasPatterns = [...lookup.entries()]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([alias, canonical]) => ({ canonical, re: new RegExp(`(^|[^a-z0-9+#])${escape(alias)}(?=$|[^a-z0-9+#])`, 'i') }));

/** Extracts canonical skills mentioned anywhere in free text. */
export function extractSkills(text: string): string[] {
  const found = new Set<string>();
  for (const { canonical, re } of aliasPatterns) if (re.test(text)) found.add(canonical);
  return [...found];
}

/** True if free text mentions the canonical skill or one of its strict aliases. */
export function textMentions(text: string, canonical: string): boolean {
  const def = SKILLS[canonical];
  const terms = def ? [canonical.toLowerCase(), ...def.aliases] : [canonical.toLowerCase()];
  return terms.some((t) => new RegExp(`(^|[^a-z0-9+#])${escape(t)}(?=$|[^a-z0-9+#])`, 'i').test(text));
}

export const ALL_SKILLS = Object.keys(SKILLS);
