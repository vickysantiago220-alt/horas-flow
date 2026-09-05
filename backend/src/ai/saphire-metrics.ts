export type SaphireMetrics = {
  totalDemands: number;
  completedDemands: number;
  analyzedDemands: number;
  pendingDemands: number;
  totalHours: number;
  analysisHours: number;
  requiredHours: number;
  completionRate: number;
  averageHoursPerDemand: number;
};

function toNumber(value: unknown): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

export function calculateSaphireMetrics(
  summary: Record<string, unknown>
): SaphireMetrics {
  const totalDemands = toNumber(summary.totalDemands);
  const completedDemands = toNumber(summary.completedDemands);
  const analyzedDemands = toNumber(summary.analyzedDemands);
  const pendingDemands = toNumber(summary.pendingDemands);

  const totalHours = toNumber(summary.totalHours);
  const analysisHours = toNumber(summary.analysisHours);
  const requiredHours = toNumber(summary.requiredHours);

  const completionRate =
    totalDemands > 0
      ? Number(((completedDemands / totalDemands) * 100).toFixed(2))
      : 0;

  const averageHoursPerDemand =
    totalDemands > 0
      ? Number((totalHours / totalDemands).toFixed(2))
      : 0;

  return {
    totalDemands,
    completedDemands,
    analyzedDemands,
    pendingDemands,
    totalHours,
    analysisHours,
    requiredHours,
    completionRate,
    averageHoursPerDemand,
  };
}
