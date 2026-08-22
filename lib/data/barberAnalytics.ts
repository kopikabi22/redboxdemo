import { StorageKeys, readCollection, todayDateString } from './storage';
import { getEmployees } from './employees';
import { getBranches } from './branches';
import { getServices } from './catalog';
import type {
  Transaction,
  AttendanceRecord,
  BarberProductivityMetric,
  BranchSeatUtilization,
  HeatmapCellData,
  BarberEfficiencySummary,
} from './types';

const BRANCH_SEAT_CAPACITIES: Record<string, number> = {
  br_cirebon_bypass: 5,
  br_cirebon_csb: 6,
  br_cirebon_samadikun: 4,
  br_cirebon_sumber: 4,
  br_tegal: 5,
};

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export function getBarberProductivityMetrics(
  branchId?: string,
  periodMonth?: string,
): BarberProductivityMetric[] {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const employees = getEmployees().filter((e) => e.role === 'Barber');
  const branches = getBranches();
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const relevantEmployees = branchId
    ? employees.filter((e) => e.branchId === branchId)
    : employees;

  const allAttendance = readCollection<AttendanceRecord>(StorageKeys.attendance).filter(
    (att) => att.date && att.date.startsWith(targetMonth),
  );

  const allTransactions = readCollection<Transaction>(StorageKeys.transactions).filter(
    (tx) => tx.timestamp.startsWith(targetMonth),
  );

  const services = getServices();
  const serviceDurationMap = new Map(services.map((s) => [s.id, s.durationMinutes || 45]));

  const metricsUnsorted = relevantEmployees.map((barber) => {
    // Count attendance days
    const barberAtt = allAttendance.filter((att) => att.employeeId === barber.id);
    const uniqueDays = new Set(barberAtt.map((att) => att.date)).size;

    let servicesCompleted = 0;
    let serviceRevenue = 0;
    let productRevenue = 0;
    let occupiedMinutes = 0;

    for (const tx of allTransactions) {
      for (const item of tx.items) {
        const isThisBarber =
          item.barberId === barber.id ||
          (item.barberName && item.barberName.toLowerCase() === barber.name.toLowerCase());

        if (isThisBarber) {
          if (item.kind === 'service') {
            servicesCompleted += item.qty;
            serviceRevenue += item.price * item.qty;
            const duration = serviceDurationMap.get(item.itemId) || 45;
            occupiedMinutes += duration * item.qty;
          } else if (item.kind === 'product') {
            productRevenue += item.price * item.qty;
          }
        }
      }
    }

    const totalRevenue = serviceRevenue + productRevenue;
    // Standard commission: 35% service + 5% retail product upsell
    const totalCommission = Math.round(serviceRevenue * 0.35 + productRevenue * 0.05);

    const effectiveDays = uniqueDays > 0 ? uniqueDays : servicesCompleted > 0 ? 1 : 0;
    const servicesPerDay =
      effectiveDays > 0 ? Math.round((servicesCompleted / effectiveDays) * 10) / 10 : 0;

    const availableWorkingMinutes = effectiveDays * 480; // 8 hours = 480 minutes
    const utilizationRate =
      availableWorkingMinutes > 0
        ? Math.min(100, Math.round((occupiedMinutes / availableWorkingMinutes) * 100))
        : 0;

    return {
      barberId: barber.id,
      barberName: barber.name,
      branchId: barber.branchId,
      branchName: branchMap.get(barber.branchId) || barber.branchId,
      attendanceDays: uniqueDays,
      servicesCompleted,
      servicesPerDay,
      serviceRevenue,
      productRevenue,
      totalRevenue,
      totalCommission,
      occupiedMinutes,
      utilizationRate,
      rank: 1,
    };
  });

  // Sort by total revenue descending, then services completed
  metricsUnsorted.sort((a, b) => b.totalRevenue - a.totalRevenue || b.servicesCompleted - a.servicesCompleted);

  return metricsUnsorted.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

export function getBranchSeatUtilization(periodMonth?: string): BranchSeatUtilization[] {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const branches = getBranches();
  const allTransactions = readCollection<Transaction>(StorageKeys.transactions).filter(
    (tx) => tx.timestamp.startsWith(targetMonth),
  );

  const services = getServices();
  const serviceDurationMap = new Map(services.map((s) => [s.id, s.durationMinutes || 45]));

  return branches.map((branch) => {
    const seatCapacity = BRANCH_SEAT_CAPACITIES[branch.id] || (branch.minBarberCoverage ? branch.minBarberCoverage * 2 : 4);
    // 720 minutes/day * 30 days = 21,600 minutes per seat per month
    const totalAvailableMinutes = seatCapacity * 720 * 30;

    const branchTxs = allTransactions.filter((tx) => tx.branchId === branch.id);
    let actualOccupiedMinutes = 0;

    for (const tx of branchTxs) {
      for (const item of tx.items) {
        if (item.kind === 'service') {
          const duration = serviceDurationMap.get(item.itemId) || 45;
          actualOccupiedMinutes += duration * item.qty;
        }
      }
    }

    const utilizationRate =
      totalAvailableMinutes > 0 ? (actualOccupiedMinutes / totalAvailableMinutes) * 100 : 0;

    let status: 'optimal' | 'moderate' | 'underutilized';
    if (utilizationRate >= 60) {
      status = 'optimal';
    } else if (utilizationRate >= 40) {
      status = 'moderate';
    } else {
      status = 'underutilized';
    }

    return {
      branchId: branch.id,
      branchName: branch.name,
      seatCapacity,
      totalAvailableMinutes,
      actualOccupiedMinutes,
      utilizationRate,
      status,
    };
  });
}

export function getEfficiencyHeatmapData(
  branchId?: string,
  periodMonth?: string,
): HeatmapCellData[] {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const allTransactions = readCollection<Transaction>(StorageKeys.transactions).filter((tx) => {
    if (!tx.timestamp.startsWith(targetMonth)) return false;
    if (branchId && tx.branchId !== branchId) return false;
    return true;
  });

  // Matrix 7 days x 13 hours (9 to 21)
  const matrix: Record<string, { count: number; revenue: number }> = {};
  for (let d = 0; d < 7; d++) {
    for (let h = 9; h <= 21; h++) {
      matrix[`${d}-${h}`] = { count: 0, revenue: 0 };
    }
  }

  for (const tx of allTransactions) {
    try {
      if (!tx.timestamp || tx.timestamp.length < 13) continue;

      const dateStr = tx.timestamp.slice(0, 10);
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!year || !month || !day) continue;

      const utcDate = new Date(Date.UTC(year, month - 1, day));
      const jsDay = utcDate.getUTCDay(); // 0 is Sunday, 1 is Monday, ...
      const dayIndex = (jsDay + 6) % 7; // 0 is Senin, 6 is Minggu

      const hour = parseInt(tx.timestamp.slice(11, 13), 10);

      if (hour >= 9 && hour <= 21 && dayIndex >= 0 && dayIndex < 7) {
        const key = `${dayIndex}-${hour}`;
        if (matrix[key]) {
          matrix[key].count += 1;
          matrix[key].revenue += tx.total;
        }
      }
    } catch {
      // Ignore malformed timestamps
    }
  }

  const result: HeatmapCellData[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 9; h <= 21; h++) {
      const key = `${d}-${h}`;
      const cell = matrix[key] || { count: 0, revenue: 0 };

      let intensityLevel = 0;
      if (cell.count > 5) intensityLevel = 3;
      else if (cell.count >= 3) intensityLevel = 2;
      else if (cell.count >= 1) intensityLevel = 1;

      result.push({
        dayIndex: d,
        dayName: DAY_NAMES[d],
        hour: h,
        hourLabel: `${h.toString().padStart(2, '0')}:00`,
        transactionCount: cell.count,
        revenue: cell.revenue,
        intensityLevel,
      });
    }
  }

  return result;
}

export function getBarberEfficiencySummary(
  branchId?: string,
  periodMonth?: string,
): BarberEfficiencySummary {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const barbers = getBarberProductivityMetrics(branchId, targetMonth);
  const branchSeats = getBranchSeatUtilization(targetMonth);
  const heatmap = getEfficiencyHeatmapData(branchId, targetMonth);

  const totalBarbers = barbers.length;
  const topBarberName = barbers.length > 0 ? barbers[0].barberName : '-';

  const totalServicesPerDay = barbers.reduce((acc, b) => acc + b.servicesPerDay, 0);
  const averageServicesPerDay =
    totalBarbers > 0 ? Math.round((totalServicesPerDay / totalBarbers) * 10) / 10 : 0;

  const totalUtilization = barbers.reduce((acc, b) => acc + b.utilizationRate, 0);
  const averageBarberUtilization =
    totalBarbers > 0 ? Math.round(totalUtilization / totalBarbers) : 0;

  const relevantSeats = branchId ? branchSeats.filter((b) => b.branchId === branchId) : branchSeats;
  const totalOccupied = relevantSeats.reduce((acc, b) => acc + b.actualOccupiedMinutes, 0);
  const totalAvailable = relevantSeats.reduce((acc, b) => acc + b.totalAvailableMinutes, 0);
  const holdingSeatUtilization =
    totalAvailable > 0 ? (totalOccupied / totalAvailable) * 100 : 0;

  return {
    periodMonth: targetMonth,
    totalBarbers,
    topBarberName,
    averageServicesPerDay,
    averageBarberUtilization,
    holdingSeatUtilization,
    barbers,
    branchSeats,
    heatmap,
  };
}
