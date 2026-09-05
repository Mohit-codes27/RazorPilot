/**
 * AI provider abstraction. The orchestrator depends on this interface —
 * swap Gemini for another model by implementing it, without touching
 * agent logic.
 */

export interface AIToolParameterSchema {
  type: 'OBJECT';
  properties: Record<string, unknown>;
  required?: string[];
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: AIToolParameterSchema;
}

export interface AIHistoryPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface AIHistoryTurn {
  role: 'user' | 'model' | 'function';
  parts: AIHistoryPart[];
}

export interface AIRequestedToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AIChatInput {
  systemPrompt: string;
  history: AIHistoryTurn[];
  message: string;
  tools: AIToolDefinition[];
}

export interface AIChatResult {
  text: string;
  toolCalls: AIRequestedToolCall[];
}

export interface AIProvider {
  readonly name: string;
  chat(input: AIChatInput): Promise<AIChatResult>;
}
