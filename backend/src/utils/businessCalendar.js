/**
 * Business Calendar Utility
 *
 * Handles working minutes calculations factoring in:
 * - Office Hours (from companies.work_start_time / work_end_time) — stored as IST
 * - Working Days (from companies.working_days jsonb)
 * - Company Holidays (from company_holidays table — stored as 'YYYY-MM-DD' IST dates)
 * - 1-hour lunch break (13:30–14:30 IST) baked in
 *
 * Timezone: All calendar comparisons are done in Asia/Kolkata (IST) so that
 * holiday dates, day-of-week names, and office hours always align with the
 * company's actual working day, regardless of the server's OS timezone.
 *
 * Effective working minutes per day:
 *   09:30 → 13:30  = 4 h = 240 min  (morning)
 *   13:30 → 14:30  = 1 h break       (skipped)
 *   14:30 → 18:30  = 4 h = 240 min  (afternoon)
 *   TOTAL = 480 working min = 8 working hours
 */

import { getSupabase } from "../config/supabase.js";

// ─── IST Timezone Helpers ─────────────────────────────────────────────────────

const TZ = 'Asia/Kolkata';

/** 'Monday', 'Tuesday', … in IST — consistent regardless of server OS timezone */
function istDayName(date) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: TZ }).format(date);
}

/** 'YYYY-MM-DD' in IST — matches holiday_date values stored in the DB */
function istDateStr(date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

/**
 * Build a Date whose wall-clock time equals `hour:minute` IST on the same
 * IST calendar-day as `refDate`. Works correctly even when the server runs UTC.
 */
function istTimeOnSameDay(refDate, hour, minute) {
    const ymd = istDateStr(refDate); // 'YYYY-MM-DD' in IST
    return new Date(`${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`);
}

// ─── Break period (IST) ───────────────────────────────────────────────────────
const BREAK = { h: 13, m: 30, dh: 14, dm: 30 }; // 13:30–14:30 IST

// ─── Segment helpers ──────────────────────────────────────────────────────────

/**
 * For a given calendar day (any Date within that day) return the two working
 * segments as [startMs, endMs] pairs, based on parsed office hours.
 */
function daySegments(date, startH, startM, endH, endM) {
    return [
        [istTimeOnSameDay(date, startH, startM).getTime(),
        istTimeOnSameDay(date, BREAK.h, BREAK.m).getTime()],  // morning
        [istTimeOnSameDay(date, BREAK.dh, BREAK.dm).getTime(),
        istTimeOnSameDay(date, endH, endM).getTime()],         // afternoon
    ];
}

// ─── calculateWorkingMinutes ─────────────────────────────────────────────────

/**
 * Calculates actual working minutes between two timestamps,
 * respecting office hours (IST), working days, holidays, and the lunch break.
 */
export function calculateWorkingMinutes(start, end, companySettings, holidays) {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate <= startDate) return 0;

    const workingDays = companySettings?.working_days ||
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const rawStart = companySettings?.work_start_time || '09:30';
    const rawEnd = companySettings?.work_end_time || '18:30';
    const [startH, startM] = rawStart.split(':').map(Number);
    const [endH, endM] = rawEnd.split(':').map(Number);

    const holidaySet = new Set((holidays || []).map(h => h.holiday_date));

    let totalMinutes = 0;
    let current = new Date(startDate);
    // Advance day-by-day (in UTC, but we check using IST helpers)
    while (istDateStr(current) <= istDateStr(endDate)) {
        const dayName = istDayName(current);
        const dateStr = istDateStr(current);
        const isWorkingDay = workingDays.includes(dayName) && !holidaySet.has(dateStr);

        if (isWorkingDay) {
            for (const [segStartMs, segEndMs] of daySegments(current, startH, startM, endH, endM)) {
                const from = Math.max(startDate.getTime(), segStartMs);
                const to = Math.min(endDate.getTime(), segEndMs);
                if (to > from) totalMinutes += Math.floor((to - from) / 60000);
            }
        }

        // Advance to next calendar day (midnight IST → next day 00:00 IST)
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }

    return totalMinutes;
}

// ─── addWorkingMinutes ────────────────────────────────────────────────────────

/**
 * Adds `minutesToAdd` working minutes to `startDate`, skipping:
 *   - non-working days (weekends + holidays)
 *   - before-office hours  (before 09:30 IST → snap forward)
 *   - after-office hours   (after  18:30 IST → next working day)
 *   - lunch break          (13:30–14:30 IST → skip)
 *
 * @param {Date}   startDate
 * @param {number} minutesToAdd
 * @param {string} company_id
 * @returns {Promise<string>} ISO timestamp of the deadline
 */
export async function addWorkingMinutes(startDate, minutesToAdd, company_id, env) {
    if (!minutesToAdd || minutesToAdd <= 0) return new Date(startDate).toISOString();

    const supabase = getSupabase(env);

    // ── Fetch company settings ───────────────────────────────────────────────
    let cq = supabase.from('companies').select('work_start_time, work_end_time, working_days');
    if (company_id) cq = cq.eq('id', company_id);
    const { data: company } = await cq.limit(1).single();

    let hq = supabase.from('company_holidays').select('holiday_date');
    if (company_id) hq = hq.eq('company_id', company_id);
    const { data: holidays } = await hq;

    const workingDays = company?.working_days ||
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const rawStart = company?.work_start_time || '09:30';
    const rawEnd = company?.work_end_time || '18:30';
    const [startH, startM] = rawStart.split(':').map(Number);
    const [endH, endM] = rawEnd.split(':').map(Number);
    const holidaySet = new Set((holidays || []).map(h => h.holiday_date));

    // ── Helpers ──────────────────────────────────────────────────────────────

    const isWorkingDay = (date) =>
        workingDays.includes(istDayName(date)) && !holidaySet.has(istDateStr(date));

    const advanceToNextWorkingDay = (date) => {
        // Move to 09:30 IST of the next calendar day
        const ymd = istDateStr(date);
        const [y, mo, d] = ymd.split('-').map(Number);
        const next = new Date(Date.UTC(y, mo - 1, d + 1)); // midnight UTC next day
        return new Date(`${istDateStr(next)}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00+05:30`);
    };

    // ── Initialise current position ──────────────────────────────────────────
    let current = new Date(startDate);

    // 1. Snap forward to office start if it's before 09:30 on a working day
    const todayOfficeStart = istTimeOnSameDay(current, startH, startM);
    if (current < todayOfficeStart) current = todayOfficeStart;

    // 2. Skip to next working day if today is non-working
    while (!isWorkingDay(current)) {
        current = advanceToNextWorkingDay(current);
    }

    // 3. If we're within the break, advance to break end
    const todayBreakEnd = istTimeOnSameDay(current, BREAK.dh, BREAK.dm);
    const todayBreakStart = istTimeOnSameDay(current, BREAK.h, BREAK.m);
    if (current >= todayBreakStart && current < todayBreakEnd) {
        current = new Date(todayBreakEnd);
    }

    // 4. If we're at or after today's office end, jump to next working day
    const todayOfficeEnd = istTimeOnSameDay(current, endH, endM);
    if (current >= todayOfficeEnd) {
        current = advanceToNextWorkingDay(current);
        while (!isWorkingDay(current)) current = advanceToNextWorkingDay(current);
    }

    // ── Walk through working minutes ─────────────────────────────────────────
    let remaining = minutesToAdd;

    while (remaining > 0) {
        const officeEnd = istTimeOnSameDay(current, endH, endM);
        const breakStart = istTimeOnSameDay(current, BREAK.h, BREAK.m);
        const breakEnd = istTimeOnSameDay(current, BREAK.dh, BREAK.dm);

        // Past office end → next working day
        if (current >= officeEnd) {
            current = advanceToNextWorkingDay(current);
            while (!isWorkingDay(current)) current = advanceToNextWorkingDay(current);
            continue;
        }

        // In break → jump to break end
        if (current >= breakStart && current < breakEnd) {
            current = new Date(breakEnd);
            continue;
        }

        // Determine how far we can go without hitting the break or office end
        let wallTarget;
        if (current < breakStart) {
            // Pre-break segment: work until whichever comes first
            wallTarget = breakStart;
        } else {
            // Post-break segment: work until office end
            wallTarget = officeEnd;
        }

        const availableMins = Math.floor((wallTarget.getTime() - current.getTime()) / 60000);

        if (remaining <= availableMins) {
            // Fits within this segment
            current = new Date(current.getTime() + remaining * 60000);
            remaining = 0;
        } else {
            remaining -= availableMins;
            if (current < breakStart) {
                // Consumed pre-break segment → jump to break end and continue
                current = new Date(breakEnd);
            } else {
                // Consumed post-break segment → next working day
                current = advanceToNextWorkingDay(current);
                while (!isWorkingDay(current)) current = advanceToNextWorkingDay(current);
            }
        }
    }

    return current.toISOString();
}
