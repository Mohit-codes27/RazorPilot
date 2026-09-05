export interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface UserPreferences {
  preferredCurrency: string | null;
  maxBudget: number | null;
  preferredPaymentMethod: string | null;
  preferences: Record<string, unknown> | null;
}
