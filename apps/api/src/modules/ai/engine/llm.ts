import { env, features } from '../../../config/env';
import { logger } from '../../../lib/logger';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Minimal client for any OpenAI-compatible chat completions API. Always requests
 * JSON so outputs are validated and stored as structured data, never free text.
 */
export async function llmJson<T>(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number } = {}): Promise<T> {
  const res = await fetch(`${env.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1500,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`LLM request failed with ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  return JSON.parse(body.choices[0].message.content) as T;
}

/** Runs the LLM path when configured and falls back to the deterministic engine on any failure. */
export async function withFallback<T>(label: string, llm: () => Promise<T>, heuristic: () => T | Promise<T>): Promise<T> {
  if (!features.llm) return heuristic();
  try {
    return await llm();
  } catch (err) {
    logger.warn({ err, label }, 'LLM call failed — falling back to heuristic engine');
    return heuristic();
  }
}
