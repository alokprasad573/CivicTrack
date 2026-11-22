import { ComplaintCategory, ComplaintPriority } from "@civictrack/contracts";

/**
 * Standard Municipal Service Level Agreement (SLA) Resolution Thresholds
 * Configured in hours per priority tier
 */
export const DEFAULT_SLA_HOURS: Record<ComplaintPriority, number> = {
  [ComplaintPriority.CRITICAL]: 12, // 12 hours (emergencies, live wires, hazardous leaks)
  [ComplaintPriority.HIGH]: 24,     // 24 hours (major water pipe burst, obstructed traffic)
  [ComplaintPriority.MEDIUM]: 48,   // 48 hours (potholes, garbage accumulation, streetlights)
  [ComplaintPriority.LOW]: 72,      // 72 hours (minor repairs, cosmetic civic issues)
};

/**
 * Category-specific SLA overrides (if stricter turnaround is required)
 */
export const CATEGORY_SLA_HOURS_OVERRIDE: Partial<Record<ComplaintCategory, number>> = {
  [ComplaintCategory.ELECTRICITY]: 18,
  [ComplaintCategory.WATER_SUPPLY]: 24,
};

/**
 * Calculate deterministic SLA due date
 */
export function calculateDueAt(
  priority: ComplaintPriority,
  category?: ComplaintCategory,
  fromDate: Date = new Date()
): Date {
  const baseHours = DEFAULT_SLA_HOURS[priority] || 48;
  const categoryOverride = category ? CATEGORY_SLA_HOURS_OVERRIDE[category] : undefined;

  // Use the stricter (minimum) SLA duration if category override exists
  const effectiveHours = categoryOverride
    ? Math.min(baseHours, categoryOverride)
    : baseHours;

  const dueTime = fromDate.getTime() + effectiveHours * 60 * 60 * 1000;
  return new Date(dueTime);
}
