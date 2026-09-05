import { ORDER_STATUS, PAYMENT_STATUS } from '../../config/constants.js';
import { prisma } from '../../db/prisma.js';

function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value as { toString(): string });
}

export interface OrdersAnalytics {
  totalOrders: number;
  paidOrders: number;
  failedPayments: number;
  pendingOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  byStatus: Array<{ status: string; count: number; revenue: number }>;
}

export async function getOrdersAnalytics(): Promise<OrdersAnalytics> {
  const [groups, paidAgg] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { status: ORDER_STATUS.PAID },
      _count: true,
      _sum: { totalAmount: true },
    }),
  ]);

  const byStatus = groups.map((g) => ({
    status: g.status,
    count: g._count.status,
    revenue: num(g._sum.totalAmount),
  }));
  const countOf = (status: string) => byStatus.find((b) => b.status === status)?.count ?? 0;
  const totalRevenue = num(paidAgg._sum.totalAmount);
  const paidOrders = paidAgg._count;

  return {
    totalOrders: byStatus.reduce((n, b) => n + b.count, 0),
    paidOrders,
    failedPayments: countOf(ORDER_STATUS.PAYMENT_FAILED),
    pendingOrders: countOf(ORDER_STATUS.PENDING_PAYMENT),
    totalRevenue,
    averageOrderValue: paidOrders > 0 ? totalRevenue / paidOrders : 0,
    byStatus: byStatus.sort((a, b) => a.status.localeCompare(b.status)),
  };
}

export interface MerchantAnalytics {
  merchantId: string;
  totalOrders: number;
  paidOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  capturedPayments: number;
  refundedPayments: number;
  byStatus: Array<{ status: string; count: number; revenue: number }>;
}

/** Same shapes as the global endpoints, scoped to one merchant's orders. */
export async function getMerchantAnalytics(merchantId: string): Promise<MerchantAnalytics> {
  const [groups, paidAgg, payments] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      where: { merchantId },
      _count: { status: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { merchantId, status: ORDER_STATUS.PAID },
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ['status'],
      where: { order: { merchantId } },
      _count: { status: true },
    }),
  ]);

  const byStatus = groups.map((g) => ({
    status: g.status,
    count: g._count.status,
    revenue: num(g._sum.totalAmount),
  }));
  const totalRevenue = num(paidAgg._sum.totalAmount);
  const paidOrders = paidAgg._count;
  const payCount = (status: string) =>
    payments.find((p) => p.status === status)?._count.status ?? 0;

  return {
    merchantId,
    totalOrders: byStatus.reduce((n, b) => n + b.count, 0),
    paidOrders,
    totalRevenue,
    averageOrderValue: paidOrders > 0 ? totalRevenue / paidOrders : 0,
    capturedPayments: payCount(PAYMENT_STATUS.CAPTURED),
    refundedPayments: payCount(PAYMENT_STATUS.REFUNDED),
    byStatus: byStatus.sort((a, b) => a.status.localeCompare(b.status)),
  };
}

export interface PaymentsAnalytics {
  totalPayments: number;
  capturedPayments: number;
  failedPayments: number;
  openPayments: number;
  capturedAmount: number;
  byStatus: Array<{ status: string; count: number; amount: number }>;
}

export async function getPaymentsAnalytics(): Promise<PaymentsAnalytics> {
  const groups = await prisma.payment.groupBy({
    by: ['status'],
    _count: { status: true },
    _sum: { amount: true },
  });
  const byStatus = groups.map((g) => ({
    status: g.status,
    count: g._count.status,
    amount: num(g._sum.amount),
  }));
  const countOf = (status: string) => byStatus.find((b) => b.status === status)?.count ?? 0;
  const amountOf = (status: string) => byStatus.find((b) => b.status === status)?.amount ?? 0;

  return {
    totalPayments: byStatus.reduce((n, b) => n + b.count, 0),
    capturedPayments: countOf(PAYMENT_STATUS.CAPTURED),
    failedPayments: countOf(PAYMENT_STATUS.FAILED),
    openPayments: countOf(PAYMENT_STATUS.CREATED) + countOf(PAYMENT_STATUS.AUTHORIZED),
    capturedAmount: amountOf(PAYMENT_STATUS.CAPTURED),
    byStatus: byStatus.sort((a, b) => a.status.localeCompare(b.status)),
  };
}

export interface AgentAnalytics {
  agentSessions: number;
  sessionsByStatus: Array<{ status: string; count: number }>;
  toolCalls: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  blockedToolCalls: number;
  callsByTool: Array<{ toolName: string; count: number; succeeded: number; blocked: number }>;
}

export async function getAgentAnalytics(): Promise<AgentAnalytics> {
  const [sessions, toolStatusGroups, toolNameGroups] = await Promise.all([
    prisma.agentSession.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.agentToolCall.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.agentToolCall.groupBy({ by: ['toolName', 'status'], _count: true }),
  ]);

  const statusCount = (status: string) =>
    toolStatusGroups.find((g) => g.status === status)?._count.status ?? 0;

  const perTool = new Map<string, { count: number; succeeded: number; blocked: number }>();
  for (const g of toolNameGroups) {
    const entry = perTool.get(g.toolName) ?? { count: 0, succeeded: 0, blocked: 0 };
    entry.count += g._count;
    if (g.status === 'SUCCEEDED') entry.succeeded += g._count;
    if (g.status === 'BLOCKED') entry.blocked += g._count;
    perTool.set(g.toolName, entry);
  }

  return {
    agentSessions: sessions.reduce((n, s) => n + s._count.status, 0),
    sessionsByStatus: sessions.map((s) => ({ status: s.status, count: s._count.status })),
    toolCalls: toolStatusGroups.reduce((n, g) => n + g._count.status, 0),
    successfulToolCalls: statusCount('SUCCEEDED'),
    failedToolCalls: statusCount('FAILED'),
    blockedToolCalls: statusCount('BLOCKED'),
    callsByTool: [...perTool.entries()]
      .map(([toolName, v]) => ({ toolName, ...v }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface OverviewAnalytics {
  orders: OrdersAnalytics;
  payments: Pick<PaymentsAnalytics, 'totalPayments' | 'capturedPayments' | 'failedPayments' | 'capturedAmount'>;
  agent: Pick<AgentAnalytics, 'agentSessions' | 'toolCalls' | 'successfulToolCalls' | 'blockedToolCalls'>;
}

export async function getOverviewAnalytics(): Promise<OverviewAnalytics> {
  const [orders, payments, agent] = await Promise.all([
    getOrdersAnalytics(),
    getPaymentsAnalytics(),
    getAgentAnalytics(),
  ]);
  return {
    orders,
    payments: {
      totalPayments: payments.totalPayments,
      capturedPayments: payments.capturedPayments,
      failedPayments: payments.failedPayments,
      capturedAmount: payments.capturedAmount,
    },
    agent: {
      agentSessions: agent.agentSessions,
      toolCalls: agent.toolCalls,
      successfulToolCalls: agent.successfulToolCalls,
      blockedToolCalls: agent.blockedToolCalls,
    },
  };
}
