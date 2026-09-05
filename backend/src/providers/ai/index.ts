import type { AIProvider } from './aiProvider.js';
import { GeminiProvider } from './gemini.provider.js';

let cached: AIProvider | null = null;
let override: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (override) return override;
  if (cached) return cached;
  cached = new GeminiProvider();
  return cached;
}

/** Test-only injection of a scripted AI provider (no API key needed). */
export function setAIProviderOverride(provider: AIProvider | null): void {
  override = provider;
}
