import { StorageKeys, readCollection, todayDateString } from './storage';
import { getServices } from './catalog';
import { getProducts } from './catalog';
import type {
  Transaction,
  InventoryBalance,
  ServiceVelocityMetric,
  ProductVelocityMetric,
  CrossSellingInsight,
  MenuEngineeringSummary,
  ServiceQuadrant,
  ProductVelocityClassification,
} from './types';

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function getServiceVelocityMetrics(
  branchId?: string,
  periodMonth?: string,
): ServiceVelocityMetric[] {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const services = getServices();
  const allTransactions = readCollection<Transaction>(StorageKeys.transactions).filter((tx) => {
    if (!tx.timestamp.startsWith(targetMonth)) return false;
    if (branchId && tx.branchId !== branchId) return false;
    return true;
  });

  // Calculate volume and revenue per service
  const serviceSalesMap: Record<string, { qty: number; revenue: number }> = {};
  for (const s of services) {
    serviceSalesMap[s.id] = { qty: 0, revenue: 0 };
  }

  for (const tx of allTransactions) {
    for (const item of tx.items) {
      if (item.kind === 'service') {
        const matched = services.find(
          (s) => s.id === item.itemId || s.name.toLowerCase() === item.name.toLowerCase(),
        );
        if (matched) {
          serviceSalesMap[matched.id].qty += item.qty;
          serviceSalesMap[matched.id].revenue += item.price * item.qty;
        }
      }
    }
  }

  const baseMetrics = services.map((s) => {
    const sales = serviceSalesMap[s.id] || { qty: 0, revenue: 0 };
    // Estimated direct cost: ~35% barber commission + 5.000 materials/amenities
    const estimatedCost = Math.round(s.price * 0.35 + 5000);
    const unitMargin = Math.max(0, s.price - estimatedCost);
    const marginPercentage = s.price > 0 ? (unitMargin / s.price) * 100 : 0;
    const totalProfit = unitMargin * sales.qty;

    return {
      serviceId: s.id,
      serviceName: s.name,
      category: s.category,
      price: s.price,
      estimatedCost,
      unitMargin,
      marginPercentage,
      quantitySold: sales.qty,
      totalRevenue: sales.revenue,
      totalProfit,
    };
  });

  const totalVolume = baseMetrics.reduce((acc, m) => acc + m.quantitySold, 0);
  const avgVolume = baseMetrics.length > 0 ? totalVolume / baseMetrics.length : 0;
  const avgMargin =
    baseMetrics.length > 0
      ? baseMetrics.reduce((acc, m) => acc + m.marginPercentage, 0) / baseMetrics.length
      : 0;

  return baseMetrics.map((m) => {
    let quadrant: ServiceQuadrant;
    let quadrantLabel: string;
    let actionStrategy: string;

    const isHighVolume = m.quantitySold >= avgVolume && m.quantitySold > 0;
    const isHighMargin = m.marginPercentage >= avgMargin;

    if (isHighVolume && isHighMargin) {
      quadrant = 'stars';
      quadrantLabel = 'Stars (Layanan Bintang)';
      actionStrategy = 'Pertahankan konsistensi kualitas & jadikan materi promosi utama.';
    } else if (isHighVolume && !isHighMargin) {
      quadrant = 'workhorses';
      quadrantLabel = 'Workhorses (Pekerja Keras)';
      actionStrategy = 'Tingkatkan margin dengan paket bundling atau add-on perawatan tambahan.';
    } else if (!isHighVolume && isHighMargin) {
      quadrant = 'puzzles';
      quadrantLabel = 'Puzzles (Teka-Teki)';
      actionStrategy = 'Tingkatkan visibilitas promosi & berikan insentif rekomendasi kepada barber.';
    } else {
      quadrant = 'dogs';
      quadrantLabel = 'Dogs (Beban Menu)';
      actionStrategy = 'Evaluasi minat konsumen atau pertimbangkan untuk diganti dengan menu baru.';
    }

    return {
      ...m,
      quadrant,
      quadrantLabel,
      actionStrategy,
    };
  });
}

export function getProductVelocityMetrics(
  branchId?: string,
  periodMonth?: string,
): ProductVelocityMetric[] {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const products = getProducts();
  const allTransactions = readCollection<Transaction>(StorageKeys.transactions).filter((tx) => {
    if (!tx.timestamp.startsWith(targetMonth)) return false;
    if (branchId && tx.branchId !== branchId) return false;
    return true;
  });

  // Calculate product sales
  const productSalesMap: Record<string, { qty: number; revenue: number }> = {};
  for (const p of products) {
    productSalesMap[p.id] = { qty: 0, revenue: 0 };
  }

  for (const tx of allTransactions) {
    for (const item of tx.items) {
      if (item.kind === 'product') {
        const matched = products.find(
          (p) => p.id === item.itemId || p.name.toLowerCase() === item.name.toLowerCase(),
        );
        if (matched) {
          productSalesMap[matched.id].qty += item.qty;
          productSalesMap[matched.id].revenue += item.price * item.qty;
        }
      }
    }
  }

  const balances = readCollection<InventoryBalance>(StorageKeys.inventoryBalances);

  return products.map((p) => {
    const sales = productSalesMap[p.id] || { qty: 0, revenue: 0 };
    const marginPercentage = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
    const totalGrossProfit = sales.qty * (p.price - p.cost);
    const currentStock = branchId
      ? balances.find((b) => b.productId === p.id && b.branchId === branchId)?.qty ?? 0
      : balances.filter((b) => b.productId === p.id).reduce((acc, b) => acc + b.qty, 0);

    let velocity: ProductVelocityClassification;
    let velocityLabel: string;
    let actionStrategy: string;

    if (sales.qty >= 10) {
      velocity = 'fast_moving';
      velocityLabel = 'Fast Moving';
      actionStrategy = 'Perputaran cepat. Jaga reorder point & pastikan stok selalu tersedia.';
    } else if (sales.qty >= 4) {
      velocity = 'medium_moving';
      velocityLabel = 'Medium Moving';
      actionStrategy = 'Perputaran stabil. Monitor stok fisik secara berkala.';
    } else if (sales.qty >= 1) {
      velocity = 'slow_moving';
      velocityLabel = 'Slow Moving';
      actionStrategy = 'Perputaran lambat. Berikan komisi upselling ke barber atau bundle diskon.';
    } else {
      velocity = 'dead_stock';
      velocityLabel = 'Dead Stock';
      actionStrategy = 'Tidak ada penjualan. Buat promo clearance sale atau bundling cuci gudang.';
    }

    return {
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      category: p.category,
      price: p.price,
      cost: p.cost,
      marginPercentage,
      quantitySold: sales.qty,
      totalRevenue: sales.revenue,
      totalGrossProfit,
      currentStock,
      velocity,
      velocityLabel,
      actionStrategy,
    };
  });
}

export function getTopCrossSellingPairs(
  branchId?: string,
  periodMonth?: string,
): CrossSellingInsight[] {
  const targetMonth = periodMonth || todayDateString().slice(0, 7);
  const allTransactions = readCollection<Transaction>(StorageKeys.transactions).filter((tx) => {
    if (!tx.timestamp.startsWith(targetMonth)) return false;
    if (branchId && tx.branchId !== branchId) return false;
    return true;
  });

  const serviceCountMap: Record<string, number> = {};
  const pairCountMap: Record<string, { serviceName: string; productName: string; count: number }> =
    {};

  for (const tx of allTransactions) {
    const services = tx.items.filter((i) => i.kind === 'service');
    const products = tx.items.filter((i) => i.kind === 'product');

    for (const s of services) {
      serviceCountMap[s.name] = (serviceCountMap[s.name] || 0) + 1;

      for (const p of products) {
        const pairKey = `${s.name} -> ${p.name}`;
        if (!pairCountMap[pairKey]) {
          pairCountMap[pairKey] = {
            serviceName: s.name,
            productName: p.name,
            count: 0,
          };
        }
        pairCountMap[pairKey].count += 1;
      }
    }
  }

  const pairs = Object.values(pairCountMap).map((pair) => {
    const totalServiceTrx = serviceCountMap[pair.serviceName] || 1;
    const crossSellRate = Math.round((pair.count / totalServiceTrx) * 100);
    return {
      serviceName: pair.serviceName,
      productName: pair.productName,
      pairCount: pair.count,
      crossSellRate,
    };
  });

  // Sort by highest count
  pairs.sort((a, b) => b.pairCount - a.pairCount);

  return pairs.slice(0, 5);
}

export function getMenuEngineeringSummary(
  branchId?: string,
  periodMonth?: string,
): MenuEngineeringSummary {
  const services = getServiceVelocityMetrics(branchId, periodMonth);
  const products = getProductVelocityMetrics(branchId, periodMonth);
  const topCrossSells = getTopCrossSellingPairs(branchId, periodMonth);

  return {
    totalServicesAnalyzed: services.length,
    totalProductsAnalyzed: products.length,
    starsCount: services.filter((s) => s.quadrant === 'stars').length,
    workhorsesCount: services.filter((s) => s.quadrant === 'workhorses').length,
    puzzlesCount: services.filter((s) => s.quadrant === 'puzzles').length,
    dogsCount: services.filter((s) => s.quadrant === 'dogs').length,
    fastMovingCount: products.filter((p) => p.velocity === 'fast_moving').length,
    deadStockCount: products.filter((p) => p.velocity === 'dead_stock').length,
    services,
    products,
    topCrossSells,
  };
}
