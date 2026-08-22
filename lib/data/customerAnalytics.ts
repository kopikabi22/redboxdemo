import { StorageKeys, readCollection, todayDateString } from './storage';
import type {
  Customer,
  Transaction,
  CustomerRFMProfile,
  RFMSegment,
  RFMSegmentSummary,
  CustomerIntelligenceSummary,
} from './types';

const SEGMENT_METADATA: Record<
  RFMSegment,
  { label: string; action: string }
> = {
  champions: {
    label: 'Champions (Pelanggan Utama)',
    action: 'Berikan reward VIP eksklusif, preview program baru, pertahankan kepuasan tinggi.',
  },
  loyal: {
    label: 'Loyal Customers (Pelanggan Setia)',
    action: 'Tawarkan upgrade membership tier, upsell produk grooming retail.',
  },
  potential_loyalist: {
    label: 'Potential Loyalists (Potensial Setia)',
    action: 'Tawarkan promo loyalty point ganda untuk meningkatkan frekuensi kunjungan.',
  },
  new_customers: {
    label: 'New Customers (Konsumen Baru)',
    action: 'Berikan voucher diskon kunjungan kedua dalam kurun waktu 21 hari.',
  },
  at_risk: {
    label: 'At Risk (Risiko Churn)',
    action: 'Kirim pesan reminder WhatsApp personal + voucher win-back khusus.',
  },
  hibernating: {
    label: 'Hibernating (Tidak Aktif)',
    action: 'Kampanye reaktivasi agresif / voucher diskon comeback.',
  },
};

export function calculateCustomerRFM(
  customer: Customer,
  allTransactions?: Transaction[],
): CustomerRFMProfile {
  const todayStr = todayDateString();
  const todayTime = new Date(todayStr).getTime();

  const transactions = (
    allTransactions || readCollection<Transaction>(StorageKeys.transactions)
  )
    .filter(
      (tx) =>
        (tx.customer.customerId && tx.customer.customerId === customer.id) ||
        tx.customer.phone === customer.phone,
    )
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const frequency = transactions.length;
  const monetary = transactions.reduce((acc, tx) => acc + tx.total, 0);

  let lastVisitDate: string;
  let recencyDays: number;

  if (frequency > 0) {
    const lastTx = transactions[transactions.length - 1];
    lastVisitDate = lastTx.timestamp.slice(0, 10);
    const lastTxTime = new Date(lastVisitDate).getTime();
    recencyDays = Math.max(0, Math.floor((todayTime - lastTxTime) / (1000 * 60 * 60 * 24)));
  } else {
    lastVisitDate = (customer.createdAt || todayStr).slice(0, 10);
    const createdTime = new Date(lastVisitDate).getTime();
    recencyDays = Math.max(0, Math.floor((todayTime - createdTime) / (1000 * 60 * 60 * 24)));
  }

  // Calculate R Score (1 - 5)
  let rScore = 1;
  if (recencyDays <= 14) rScore = 5;
  else if (recencyDays <= 30) rScore = 4;
  else if (recencyDays <= 60) rScore = 3;
  else if (recencyDays <= 90) rScore = 2;
  else rScore = 1;

  // Calculate F Score (1 - 5)
  let fScore = 1;
  if (frequency >= 8) fScore = 5;
  else if (frequency >= 5) fScore = 4;
  else if (frequency >= 3) fScore = 3;
  else if (frequency === 2) fScore = 2;
  else fScore = 1;

  // Calculate M Score (1 - 5)
  let mScore = 1;
  if (monetary >= 800000) mScore = 5;
  else if (monetary >= 500000) mScore = 4;
  else if (monetary >= 250000) mScore = 3;
  else if (monetary >= 100000) mScore = 2;
  else mScore = 1;

  const rfmScore = `${rScore}${fScore}${mScore}`;

  // Segment classification
  let segment: RFMSegment = 'potential_loyalist';
  if (rScore <= 1) {
    segment = 'hibernating';
  } else if (rScore <= 2 && frequency >= 2) {
    segment = 'at_risk';
  } else if (rScore >= 4 && frequency >= 4 && mScore >= 4) {
    segment = 'champions';
  } else if (rScore >= 3 && frequency >= 3) {
    segment = 'loyal';
  } else if (rScore >= 4 && frequency <= 1) {
    segment = 'new_customers';
  } else if (rScore >= 4 && frequency <= 3) {
    segment = 'potential_loyalist';
  } else if (rScore <= 2) {
    segment = 'at_risk';
  } else {
    segment = 'potential_loyalist';
  }

  // Calculate estimated visit interval & predicted next visit
  let estimatedInterval = 28; // default 4 weeks
  if (transactions.length >= 2) {
    let totalIntervalDays = 0;
    for (let i = 1; i < transactions.length; i++) {
      const prevDate = new Date(transactions[i - 1].timestamp.slice(0, 10)).getTime();
      const currDate = new Date(transactions[i].timestamp.slice(0, 10)).getTime();
      const diff = Math.max(1, Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24)));
      totalIntervalDays += diff;
    }
    estimatedInterval = Math.round(totalIntervalDays / (transactions.length - 1));
    // clamp interval between 14 and 90 days
    estimatedInterval = Math.max(14, Math.min(estimatedInterval, 90));
  }

  const lastDateObj = new Date(lastVisitDate);
  const nextVisitObj = new Date(lastDateObj.getTime() + estimatedInterval * 24 * 60 * 60 * 1000);
  const predictedNextVisit = nextVisitObj.toISOString().slice(0, 10);
  const isOverdue = todayStr > predictedNextVisit;

  // Barber and Service affinity
  const barberCounts: Record<string, number> = {};
  const serviceCounts: Record<string, number> = {};

  for (const tx of transactions) {
    for (const item of tx.items) {
      if (item.kind === 'service') {
        serviceCounts[item.name] = (serviceCounts[item.name] || 0) + item.qty;
      }
      if (item.barberName) {
        barberCounts[item.barberName] = (barberCounts[item.barberName] || 0) + 1;
      }
    }
  }

  const favoriteBarberName = Object.entries(barberCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const favoriteServiceName = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    customerId: customer.id,
    name: customer.name,
    phone: customer.phone,
    tier: customer.tier,
    recencyDays,
    frequency,
    monetary,
    rScore,
    fScore,
    mScore,
    rfmScore,
    segment,
    favoriteBarberName,
    favoriteServiceName,
    lastVisitDate,
    predictedNextVisit,
    isOverdue,
  };
}

export function getCustomerRFMProfiles(
  branchId?: string,
  segment?: RFMSegment,
): CustomerRFMProfile[] {
  const customers = readCollection<Customer>(StorageKeys.customers);
  const allTransactions = readCollection<Transaction>(StorageKeys.transactions);

  const relevantTransactions = branchId
    ? allTransactions.filter((tx) => tx.branchId === branchId)
    : allTransactions;

  let profiles = customers.map((c) => calculateCustomerRFM(c, relevantTransactions));

  if (branchId) {
    // If branch-scoped, only include customers who have transacted in this branch
    profiles = profiles.filter((p) => p.frequency > 0);
  }

  if (segment) {
    profiles = profiles.filter((p) => p.segment === segment);
  }

  // Sort by monetary descending, then frequency descending
  profiles.sort((a, b) => b.monetary - a.monetary || b.frequency - a.frequency);

  return profiles;
}

export function getCustomerIntelligenceSummary(branchId?: string): CustomerIntelligenceSummary {
  const profiles = getCustomerRFMProfiles(branchId);
  const totalAnalyzedCustomers = profiles.length;

  const segmentKeys: RFMSegment[] = [
    'champions',
    'loyal',
    'potential_loyalist',
    'new_customers',
    'at_risk',
    'hibernating',
  ];

  const totalHoldingRevenue = profiles.reduce((acc, p) => acc + p.monetary, 0);
  const totalRecencyDays = profiles.reduce((acc, p) => acc + p.recencyDays, 0);
  const averageRecencyDays =
    totalAnalyzedCustomers > 0 ? Math.round(totalRecencyDays / totalAnalyzedCustomers) : 0;

  const atRiskCustomerCount = profiles.filter(
    (p) => p.segment === 'at_risk' || p.segment === 'hibernating',
  ).length;

  const segments: RFMSegmentSummary[] = segmentKeys.map((segKey) => {
    const segProfiles = profiles.filter((p) => p.segment === segKey);
    const count = segProfiles.length;
    const percentage = totalAnalyzedCustomers > 0 ? (count / totalAnalyzedCustomers) * 100 : 0;
    const totalRev = segProfiles.reduce((acc, p) => acc + p.monetary, 0);
    const avgSpend = count > 0 ? Math.round(totalRev / count) : 0;

    return {
      segment: segKey,
      segmentLabel: SEGMENT_METADATA[segKey].label,
      customerCount: count,
      percentage,
      totalRevenue: totalRev,
      avgSpend,
      recommendedAction: SEGMENT_METADATA[segKey].action,
    };
  });

  return {
    totalAnalyzedCustomers,
    averageRecencyDays,
    averageVisitInterval: 28, // Standard haircut cadence in days
    atRiskCustomerCount,
    segments,
  };
}
