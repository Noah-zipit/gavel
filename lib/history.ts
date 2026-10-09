"use client";

/**
 * Debate history: past verdicts persisted in localStorage.
 * Quiet, client-only, capped. The setup screen lists them newest-first.
 */

import type { DebateDomain } from "./evidence/types";

const KEY = "gavel:history:v1";
const MAX_ENTRIES = 20;

export interface VetoRecord {
  by: string;
  candidate: string;
  reason: string;
}

export interface HistoryEntry {
  id: string;
  date: string; // ISO
  domain: DebateDomain;
  people: string[];
  candidates: string[];
  winner: string;
  veto: VetoRecord | null;
  summary: string;
}

function readAll(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as HistoryEntry).id === "string" &&
        typeof (e as HistoryEntry).winner === "string"
    );
  } catch {
    return [];
  }
}

export function loadHistory(): HistoryEntry[] {
  return readAll().sort((a, b) => b.date.localeCompare(a.date));
}

export function saveVerdict(entry: Omit<HistoryEntry, "id" | "date">): void {
  if (typeof window === "undefined") return;
  try {
    const full: HistoryEntry = {
      ...entry,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(),
    };
    const next = [full, ...readAll()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_ENTRIES);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable: history is a nicety, never fatal.
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
