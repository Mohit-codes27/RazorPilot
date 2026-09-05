import type { CartResponse } from './cart.js';
import type { OrderPreviewResponse, OrderResponse, SecurityChecks } from './order.js';
import type { ProductCardData } from './product.js';

export type AgentResponseType =
  | 'text'
  | 'product_recommendation'
  | 'product_comparison'
  | 'cart_update'
  | 'order_preview'
  | 'payment_ready'
  | 'payment_result'
  | 'error';

export interface AgentRecommendation {
  productId: string;
  productName?: string;
  score?: number;
  reason: string;
  matchedPreferences?: string[];
  tradeoffs?: string[];
  alternatives?: string[];
}

export type AgentActivityType =
  | 'understand'
  | 'search'
  | 'filter'
  | 'compare'
  | 'preference_match'
  | 'stock_check'
  | 'cart_update'
  | 'order_prepare'
  | 'security_check'
  | 'payment'
  | 'complete'
  | 'error';

export interface AgentActivity {
  id?: string;
  type: AgentActivityType;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export type AgentActionType =
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'update_cart_quantity'
  | 'view_product'
  | 'buy_product'
  | 'checkout'
  | 'retry'
  | 'continue_shopping';

export interface AgentAction {
  type: AgentActionType;
  label: string;
  productId?: string;
  cartItemId?: string;
  quantity?: number;
  href?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  sessionId: string;
  messageId: string;
  message: string;
  type: AgentResponseType;
  products?: ProductCardData[];
  recommendation?: AgentRecommendation;
  activities?: AgentActivity[];
  actions?: AgentAction[];
  cart?: CartResponse;
  order?: OrderResponse | OrderPreviewResponse;
  securityChecks?: SecurityChecks;
  metadata?: Record<string, unknown>;
}

/** Human-readable labels for activity feed — never raw tool names. */
export const TOOL_ACTIVITY_LABELS: Record<string, { type: AgentActivityType; label: string }> = {
  search_products: { type: 'search', label: 'Searching products' },
  get_product: { type: 'stock_check', label: 'Checking product details and stock' },
  compare_products: { type: 'compare', label: 'Comparing options' },
  get_user_preferences: { type: 'preference_match', label: 'Matching your preferences' },
  get_cart: { type: 'cart_update', label: 'Reviewing your cart' },
  add_to_cart: { type: 'cart_update', label: 'Updating your cart' },
  remove_from_cart: { type: 'cart_update', label: 'Updating your cart' },
  preview_order: { type: 'order_prepare', label: 'Preparing order preview' },
  create_order: { type: 'order_prepare', label: 'Preparing your order' },
  prepare_payment: { type: 'payment', label: 'Preparing secure payment' },
};

/** Suggested frontend actions derived from executed tools. */
export function actionsForTool(
  toolName: string,
  result: unknown,
): AgentAction[] {
  const r = (result ?? {}) as Record<string, unknown>;
  switch (toolName) {
    case 'search_products':
    case 'compare_products': {
      const items = Array.isArray((r as { data?: unknown }).data)
        ? ((r as { data: Array<{ id: string; name: string }> }).data)
        : [];
      return items.slice(0, 3).map((p) => ({
        type: 'add_to_cart' as const,
        label: `Add ${p.name} to cart`,
        productId: p.id,
      }));
    }
    case 'get_product': {
      const id = typeof r['id'] === 'string' ? (r['id'] as string) : undefined;
      return id ? [{ type: 'buy_product', label: 'Buy this product', productId: id }] : [];
    }
    case 'preview_order':
      return [{ type: 'checkout', label: 'Confirm & Pay' }];
    default:
      return [];
  }
}
