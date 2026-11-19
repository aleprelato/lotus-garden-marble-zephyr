export type CallRecord = {
  id: string;
  seconds: number;
  derived: boolean;
  day: string;
};

export type ReferralBase = {
  prevPct: number;
  monthCalls: number;
  cleanNeeded: number;
};

export type ReferralProjection = {
  ok: true;
  impliedGoalPct: number;
  livePct: number;
  /** Whole non-referred calls still required. Null when the goal is 0% and a referral already happened. */
  cleanStill: number | null;
  slack: number;
  todayCount: number;
  todayDerived: number;
  todayClean: number;
  todayPct: number | null;
  startNeeded: number;
};

export type ReferralFailure = { ok: false; reason: string };

const EPS = 1e-8;

export function parsePct(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (!/^\d{1,3}([.,]\d+)?$/.test(text)) return null;
  const n = Number(text.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export function parseCount(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : null;
}

/** MM:SS or M:SS. Empty is unset (null). Invalid shape is null as well — callers distinguish with trim. */
export function parseClock(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(text);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function maskClock(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—:—";
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatPct(value: number): string {
  return `${value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function averageSeconds(calls: { seconds: number }[]): number | null {
  if (!calls.length) return null;
  return calls.reduce((sum, call) => sum + call.seconds, 0) / calls.length;
}

export function validateBase(base: ReferralBase): string | null {
  if (!Number.isInteger(base.monthCalls) || base.monthCalls < 1) {
    return "Las llamadas del mes tienen que ser un entero mayor a 0.";
  }
  if (!(base.prevPct >= 0 && base.prevPct <= 100)) {
    return "El porcentaje tiene que estar entre 0 y 100.";
  }
  if (!Number.isInteger(base.cleanNeeded) || base.cleanNeeded < 0) {
    return "El faltante tiene que ser un entero de 0 o más.";
  }
  if (base.prevPct === 0 && base.cleanNeeded > 0) {
    return "Con 0% no hay derivaciones que compensar. Si el tablero marca un faltante, el porcentaje no es 0.";
  }
  return null;
}

export function parseStoredBase(input: {
  prevDer: string;
  monthCalls: string;
  cleanNeeded: string;
}): ReferralBase | null {
  const prevPct = parsePct(input.prevDer);
  const monthCalls = parseCount(input.monthCalls);
  const cleanNeeded = parseCount(input.cleanNeeded);
  if (prevPct === null || monthCalls === null || cleanNeeded === null) return null;
  const base = { prevPct, monthCalls, cleanNeeded };
  if (validateBase(base)) return null;
  return base;
}

/**
 * Non-referred calls still required so referrals/total <= goal.
 * Null means the goal is 0% and there is already a referral — it cannot be walked back.
 */
export function callsNeeded(referrals: number, total: number, goal: number): number | null {
  if (!(total > 0) || !Number.isFinite(referrals) || !Number.isFinite(goal)) return null;
  if (goal <= 0) return referrals <= EPS ? 0 : null;
  if (goal >= 1) return 0;
  if (referrals / total <= goal + 1e-10) return 0;
  const exact = referrals / goal - total;
  return Math.max(0, Math.ceil(exact - EPS));
}

/** How many additional referrals still keep the rate at or under the goal. */
export function referralSlack(referrals: number, total: number, goal: number): number {
  if (!(total > 0) || goal <= 0 || goal >= 1) return 0;
  if (referrals / total > goal + 1e-10) return 0;
  const exact = (goal * total - referrals) / (1 - goal);
  return Math.max(0, Math.floor(exact + EPS));
}

/**
 * Power BI gives the month-to-date rate P, the call volume T and how many
 * clean calls N land exactly on target. That fixes the goal:
 *   g = (P/100 * T) / (T + N)
 * A clean call today reduces the gap by 1. A referral raises it by 1/g - 1.
 * When N is 0 the cushion under the real company goal is unknown, so the
 * current rate is treated as the line.
 */
export function projectReferral(
  base: ReferralBase,
  today: { derived: boolean }[],
): ReferralProjection | ReferralFailure {
  const reason = validateBase(base);
  if (reason) return { ok: false, reason };

  const total = base.monthCalls;
  const referrals = (base.prevPct / 100) * total;
  const goal = base.cleanNeeded === 0 ? base.prevPct / 100 : referrals / (total + base.cleanNeeded);

  const todayDerived = today.reduce((count, call) => count + (call.derived ? 1 : 0), 0);
  const todayCount = today.length;
  const liveReferrals = referrals + todayDerived;
  const liveTotal = total + todayCount;

  const cleanStill = callsNeeded(liveReferrals, liveTotal, goal);

  return {
    ok: true,
    impliedGoalPct: goal * 100,
    livePct: (liveReferrals / liveTotal) * 100,
    cleanStill,
    slack: cleanStill === 0 ? referralSlack(liveReferrals, liveTotal, goal) : 0,
    todayCount,
    todayDerived,
    todayClean: todayCount - todayDerived,
    todayPct: todayCount ? (todayDerived / todayCount) * 100 : null,
    startNeeded: base.cleanNeeded,
  };
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
    .format(new Date(year, month - 1, day))
    .replace(".", "")
    .toUpperCase();
}
