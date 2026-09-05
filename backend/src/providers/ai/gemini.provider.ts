import { Content, FunctionDeclaration, GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env.js';
import { AIServiceError } from '../../utils/errors.js';
import type {
  AIChatInput,
  AIChatResult,
  AIHistoryTurn,
  AIProvider,
} from './aiProvider.js';

function toGeminiHistory(history: AIHistoryTurn[]): Content[] {
  return history.map((turn) => ({
    role: turn.role,
    parts: turn.parts.map((p) => {
      if (p.functionCall) {
        return { functionCall: { name: p.functionCall.name, args: p.functionCall.args } };
      }
      if (p.functionResponse) {
        return {
          functionResponse: { name: p.functionResponse.name, response: p.functionResponse.response },
        };
      }
      return { text: p.text ?? '' };
    }),
  }));
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  async chat(input: AIChatInput): Promise<AIChatResult> {
    if (!env.GEMINI_API_KEY) {
      throw new AIServiceError('Gemini API key is not configured');
    }
    try {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const declarations: FunctionDeclaration[] = input.tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters as unknown as FunctionDeclaration['parameters'],
      }));
      const model = genAI.getGenerativeModel({
        model: env.GEMINI_MODEL,
        systemInstruction: input.systemPrompt,
        tools: declarations.length > 0 ? [{ functionDeclarations: declarations }] : [],
      });
      const chat = model.startChat({
        history: toGeminiHistory(input.history),
      });
      const result = await chat.sendMessage(input.message);
      const response = result.response;
      const toolCalls = (response.functionCalls() ?? []).map((fc) => ({
        name: fc.name,
        args: (fc.args ?? {}) as Record<string, unknown>,
      }));
      return { text: response.text() ?? '', toolCalls };
    } catch (err) {
      if (err instanceof AIServiceError) throw err;
      throw new AIServiceError(`Gemini request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
