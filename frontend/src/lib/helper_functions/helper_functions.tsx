import { useCallback } from "react";

export const getDurationMinutes = useCallback(
  (start?: string | null, end?: string | null) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate <= startDate) return 0;

    const startH = 9,
      startM = 30;
    const endH = 18,
      endM = 30;
    const breakStartH = 13,
      breakStartM = 30;
    const breakEndH = 14,
      breakEndM = 30;

    let totalMinutes = 0;
    let current = new Date(startDate);

    const getDateStr = (d: Date) =>
      d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    const endStr = getDateStr(endDate);

    while (getDateStr(current) <= endStr) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        const morningStart = new Date(current);
        morningStart.setHours(startH, startM, 0, 0);
        const morningEnd = new Date(current);
        morningEnd.setHours(breakStartH, breakStartM, 0, 0);
        const afternoonStart = new Date(current);
        afternoonStart.setHours(breakEndH, breakEndM, 0, 0);
        const afternoonEnd = new Date(current);
        afternoonEnd.setHours(endH, endM, 0, 0);

        const mFrom = Math.max(startDate.getTime(), morningStart.getTime());
        const mTo = Math.min(endDate.getTime(), morningEnd.getTime());
        if (mTo > mFrom) totalMinutes += (mTo - mFrom) / 60000;

        const aFrom = Math.max(startDate.getTime(), afternoonStart.getTime());
        const aTo = Math.min(endDate.getTime(), afternoonEnd.getTime());
        if (aTo > aFrom) totalMinutes += (aTo - aFrom) / 60000;
      }
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }

    return totalMinutes;
  },
  [],
);

export const formatMinutes = useCallback((mins: number) => {
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}, []);

export const getDuration = useCallback(
  (start?: string | null, end?: string | null) => {
    if (!start || !end) return null;
    const mins = getDurationMinutes(start, end);
    if (mins === 0) return "0m";
    return formatMinutes(mins);
  },
  [getDurationMinutes, formatMinutes],
);
