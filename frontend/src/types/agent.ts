import type { Pricing } from "./cart";
import type { ProductCard } from "./product";

export type AgentResponseType =
  | "text"
  | "product_recommendation"
  | "product_comparison"
  | "cart_update"
  | "order_preview"
  | "payment_ready"
  | "payment_result"
  | "error";

export interface AgentRecommendation {
  productId: string;
  productName?: string;
  score?: number;
  reason: string;
  matchedPreferences?: string[];
  tradeoffs?: string[];
  alternatives?: string[];
}

export interface AgentActivity {
  id?: string;
  type: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentAction {
  type: string;
  label: string;
  productId?: string;
  cartItemId?: string;
  quantity?: number;
  href?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentSecurityChecks {
  priceVerified: boolean;
  stockVerified: boolean;
  totalVerified: boolean;
  userConfirmationRequired: boolean;
}

export interface AgentResponse {
  sessionId: string;
  session_id: string;
  messageId: string;
  message: string;
  type: AgentResponseType;
  tool_calls: Array<{ name: string; status: string }>;
  products?: ProductCard[];
  recommendation?: AgentRecommendation;
  activities?: AgentActivity[];
  actions?: AgentAction[];
  cart?: unknown;
  order?: unknown;
  securityChecks?: AgentSecurityChecks;
  metadata?: Record<string, unknown>;
  ai_unavailable?: boolean;
}

export interface AgentSession {
  id: string;
  status: string;
  messageCount: number;
  preview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export { type Pricing };
