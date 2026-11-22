export type AppView = "builder" | "daily" | "timer" | "journal" | "update";

export type ThemeCategory =
  | "Paz e Medo"
  | "Direção e Coragem"
  | "Gratidão"
  | "Família e Perdão"
  | "Propósito";

export interface PrayerDirection {
  label: string;
  prompt: string;
}

export interface DailyBiblicalTheme {
  id: string;
  title: string;
  category: ThemeCategory;
  suggestedMinutes: number;
  verseReference: string;
  verseText: string;
  meditation: string;
  prayerDirections: PrayerDirection[];
}

export interface HeartInput {
  feelings: string;
  desires: string;
  fears: string;
  courage: string;
  freeText: string;
}

export interface ReflectiveQuestion {
  id: string;
  focus: string;
  question: string;
  hint: string;
}

export interface QuestionsResponse {
  acknowledgment: string;
  questions: ReflectiveQuestion[];
}

export interface StructureNote {
  stepLabel: string;
  lesson: string;
}

export interface AnchorVerse {
  reference: string;
  text: string;
  reflection: string;
}

export interface ComposedPrayer {
  title: string;
  prayerParagraphs: string[];
  structureNotes: StructureNote[];
  anchorVerse: AnchorVerse;
  faithStep: string;
}

export interface SavedPrayerEntry {
  id: string;
  createdAt: string;
  title: string;
  themeTitle?: string;
  heart: HeartInput;
  prayerParagraphs: string[];
  structureNotes: StructureNote[];
  anchorVerse: AnchorVerse;
  faithStep: string;
  answered: boolean;
  testimonyNote: string;
}

export interface FocusSessionRecord {
  id: string;
  completedAt: string;
  durationMinutes: number;
  prayerTitle?: string;
}
