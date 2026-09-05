import { getAIProvider } from '../providers/ai/index.js';
import type { AIChatInput, AIChatResult } from '../providers/ai/aiProvider.js';

/** Thin pass-through so the orchestrator never touches the SDK directly. */
export async function aiChat(input: AIChatInput): Promise<AIChatResult> {
  return getAIProvider().chat(input);
}
