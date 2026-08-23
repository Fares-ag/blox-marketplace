export function weekBuckets(count: number): Array<{ label: string; start: Date; end: Date }> {
  const buckets: Array<{ label: string; start: Date; end: Date }> = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    buckets.push({
      label: start.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
      start,
      end,
    });
  }
  return buckets;
}

export function countInRange<T extends { createdAt: Date }>(
  items: T[],
  start: Date,
  end: Date,
): number {
  return items.filter((item) => item.createdAt >= start && item.createdAt <= end).length;
}
