import { StorageKeys, readCollection, todayDateString } from './storage';
import { getBranches } from './branches';
import { generateProfitAndLossReport } from './finance';
import type {
  ExecutiveHoldingSummary,
  BranchLeaderboardEntry,
  HourlyTrafficData,
  PaymentDistributionData,
  Transaction,
  Customer,
  PaymentMethod,
} from './types';

export function getExecutiveHoldingSummary(periodMonth?: string): ExecutiveHoldingSummary {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);

  // Generate consolidated P&L report for all branches
  const pnl = generateProfitAndLossReport(undefined, targetMonth);

  // Customers & Member metrics
  const customers = readCollection<Customer>(StorageKeys.customers);
  const totalUniqueCustomers = customers.length;
  const totalActiveMembers = customers.filter((c) => c.tier !== null).length;

  const averageOrderValue =
    pnl.transactionCount > 0 ? Math.round(pnl.totalRevenue / pnl.transactionCount) : 0;

  return {
    periodMonth: targetMonth,
    totalRevenue: pnl.totalRevenue,
    totalGrossProfit: pnl.grossProfit,
    grossProfitMargin: pnl.grossProfitMargin,
    totalNetProfit: pnl.netProfit,
    netProfitMargin: pnl.netProfitMargin,
    totalTransactions: pnl.transactionCount,
    averageOrderValue,
    totalUniqueCustomers,
    totalActiveMembers,
    serviceRevenue: pnl.serviceRevenue,
    productRevenue: pnl.productRevenue,
    membershipRevenue: pnl.membershipRevenue,
    totalDiscount: pnl.totalDiscount,
    totalCOGS: pnl.cogs,
    totalOpex: pnl.totalOpex,
  };
}

export function getBranchLeaderboard(periodMonth?: string): BranchLeaderboardEntry[] {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const branches = getBranches();

  // Holding consolidated revenue for percentage share calculation
  const holdingPnl = generateProfitAndLossReport(undefined, targetMonth);
  const holdingTotalRevenue = holdingPnl.totalRevenue;

  const allTransactions = readCollection<Transaction>(StorageKeys.transactions).filter((tx) =>
    tx.timestamp.startsWith(targetMonth),
  );

  const leaderboardUnsorted = branches.map((branch) => {
    const branchPnl = generateProfitAndLossReport(branch.id, targetMonth);
    const branchTxs = allTransactions.filter((tx) => tx.branchId === branch.id);
    const transactions = branchTxs.length;

    const memberTransactionsCount = branchTxs.filter(
      (tx) => tx.customer.type === 'member' || tx.customer.tier !== null,
    ).length;

    const memberRatio =
      transactions > 0 ? (memberTransactionsCount / transactions) * 100 : 0;

    const aov = transactions > 0 ? Math.round(branchPnl.totalRevenue / transactions) : 0;

    const revenueShare =
      holdingTotalRevenue > 0 ? (branchPnl.totalRevenue / holdingTotalRevenue) * 100 : 0;

    return {
      branchId: branch.id,
      branchName: branch.name,
      city: branch.city,
      revenue: branchPnl.totalRevenue,
      revenueShare,
      transactions,
      aov,
      netProfit: branchPnl.netProfit,
      netProfitMargin: branchPnl.netProfitMargin,
      memberTransactionsCount,
      memberRatio,
      rank: 1,
    };
  });

  // Sort by revenue descending, then net profit
  leaderboardUnsorted.sort((a, b) => b.revenue - a.revenue || b.netProfit - a.netProfit);

  // Assign ranks
  return leaderboardUnsorted.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

export function getHourlyPeakTraffic(
  branchId?: string,
  periodMonth?: string,
): HourlyTrafficData[] {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const transactions = readCollection<Transaction>(StorageKeys.transactions).filter((tx) => {
    if (!tx.timestamp.startsWith(targetMonth)) return false;
    if (branchId && tx.branchId !== branchId) return false;
    return true;
  });

  // Initialize hourly slots from 09:00 to 21:00 (13 slots)
  const hourlySlots: Record<number, { count: number; revenue: number }> = {};
  for (let h = 9; h <= 21; h++) {
    hourlySlots[h] = { count: 0, revenue: 0 };
  }

  for (const tx of transactions) {
    try {
      const timePart = tx.timestamp.includes('T') ? tx.timestamp.split('T')[1] : tx.timestamp;
      const hour = parseInt(timePart.slice(0, 2), 10);
      if (!isNaN(hour) && hour >= 9 && hour <= 21) {
        hourlySlots[hour].count += 1;
        hourlySlots[hour].revenue += tx.total;
      }
    } catch {
      // Ignore malformed timestamps
    }
  }

  // Determine peak threshold
  const maxTxCount = Math.max(...Object.values(hourlySlots).map((s) => s.count), 0);

  const result: HourlyTrafficData[] = [];
  for (let h = 9; h <= 21; h++) {
    const slot = hourlySlots[h];
    const hourLabel = `${h.toString().padStart(2, '0')}:00`;
    const isPeakHour = maxTxCount > 0 && slot.count >= maxTxCount * 0.8;

    result.push({
      hour: h,
      hourLabel,
      transactionCount: slot.count,
      revenue: slot.revenue,
      isPeakHour,
    });
  }

  return result;
}

export function getPaymentMethodDistribution(
  branchId?: string,
  periodMonth?: string,
): PaymentDistributionData[] {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const transactions = readCollection<Transaction>(StorageKeys.transactions).filter((tx) => {
    if (!tx.timestamp.startsWith(targetMonth)) return false;
    if (branchId && tx.branchId !== branchId) return false;
    return true;
  });

  const methods: PaymentMethod[] = ['Cash', 'QRIS', 'Debit', 'Transfer', 'E-Wallet'];
  const methodMap: Record<PaymentMethod, { count: number; total: number }> = {
    Cash: { count: 0, total: 0 },
    QRIS: { count: 0, total: 0 },
    Debit: { count: 0, total: 0 },
    Transfer: { count: 0, total: 0 },
    'E-Wallet': { count: 0, total: 0 },
  };

  let grandTotal = 0;

  for (const tx of transactions) {
    if (methodMap[tx.method]) {
      methodMap[tx.method].count += 1;
      methodMap[tx.method].total += tx.total;
      grandTotal += tx.total;
    }
  }

  return methods.map((method) => {
    const entry = methodMap[method];
    const percentage = grandTotal > 0 ? (entry.total / grandTotal) * 100 : 0;
    return {
      method,
      transactionCount: entry.count,
      totalAmount: entry.total,
      percentage,
    };
  });
}
