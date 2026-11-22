import type { FocusSessionRecord, SavedPrayerEntry } from "../types/prayer";

const PRAYERS_KEY = "oratorio_saved_prayers_v1";
const SESSIONS_KEY = "oratorio_focus_sessions_v1";

export function loadSavedPrayers(): SavedPrayerEntry[] {
  try {
    const raw = localStorage.getItem(PRAYERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSavedPrayers(entries: SavedPrayerEntry[]): void {
  try {
    localStorage.setItem(PRAYERS_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadFocusSessions(): FocusSessionRecord[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistFocusSessions(records: FocusSessionRecord[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota errors
  }
}

export function calculateStreakDays(
  prayers: SavedPrayerEntry[],
  sessions: FocusSessionRecord[]
): number {
  const dayKeys = new Set<string>();

  for (const p of prayers) {
    const d = new Date(p.createdAt);
    if (!Number.isNaN(d.getTime())) {
      dayKeys.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }
  for (const s of sessions) {
    const d = new Date(s.completedAt);
    if (!Number.isNaN(d.getTime())) {
      dayKeys.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }

  if (dayKeys.size === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;

  // Allow streak to start from today or yesterday
  if (!dayKeys.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (dayKeys.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
