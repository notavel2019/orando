/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useMemo, useState } from "react";
import { TopBar } from "./components/TopBar";
import { PrayerBuilderView, type WizardStep } from "./components/PrayerBuilderView";
import { DailyThemesView } from "./components/DailyThemesView";
import { FocusTimerView } from "./components/FocusTimerView";
import { JournalView } from "./components/JournalView";
import { UpdateView } from "./components/UpdateView";
import { getTodayTheme } from "./data/dailyThemes";
import { APP_VERSION } from "./utils/appUpdate";
import type {
  AppView,
  ComposedPrayer,
  DailyBiblicalTheme,
  FocusSessionRecord,
  HeartInput,
  QuestionsResponse,
  SavedPrayerEntry,
} from "./types/prayer";
import {
  loadFocusSessions,
  loadSavedPrayers,
  persistFocusSessions,
  persistSavedPrayers,
} from "./utils/storage";

const EMPTY_HEART: HeartInput = {
  feelings: "",
  desires: "",
  fears: "",
  courage: "",
  freeText: "",
};

export default function App() {
  const todayTheme = useMemo(() => getTodayTheme(), []);

  const [activeView, setActiveView] = useState<AppView>("builder");
  const [selectedTheme, setSelectedTheme] = useState<DailyBiblicalTheme | null>(null);

  // 8-step wizard state
  const [heart, setHeart] = useState<HeartInput>(EMPTY_HEART);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [questionsData, setQuestionsData] = useState<QuestionsResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [composedPrayer, setComposedPrayer] = useState<ComposedPrayer | null>(null);
  const [savedCurrentId, setSavedCurrentId] = useState<string | null>(null);

  // Focus timer active state
  const [timerPrayer, setTimerPrayer] = useState<ComposedPrayer | null>(null);
  const [timerTheme, setTimerTheme] = useState<DailyBiblicalTheme>(todayTheme);
  const [timerMinutes, setTimerMinutes] = useState<number>(todayTheme.suggestedMinutes);

  // Persisted journal & sessions
  const [savedPrayers, setSavedPrayers] = useState<SavedPrayerEntry[]>(() =>
    loadSavedPrayers()
  );
  const [focusSessions, setFocusSessions] = useState<FocusSessionRecord[]>(() =>
    loadFocusSessions()
  );

  const totalMinutesLogged = useMemo(
    () => focusSessions.reduce((acc, s) => acc + s.durationMinutes, 0),
    [focusSessions]
  );

  const handleResetBuilder = useCallback(() => {
    setHeart(EMPTY_HEART);
    setWizardStep(1);
    setQuestionsData(null);
    setAnswers({});
    setComposedPrayer(null);
    setSavedCurrentId(null);
    setSelectedTheme(null);
    setActiveView("builder");
  }, []);

  const handlePrayWithTheme = useCallback((theme: DailyBiblicalTheme) => {
    setSelectedTheme(theme);
    setWizardStep(1);
    setQuestionsData(null);
    setComposedPrayer(null);
    setSavedCurrentId(null);
    setActiveView("builder");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleFocusWithTheme = useCallback((theme: DailyBiblicalTheme) => {
    setTimerPrayer(null);
    setTimerTheme(theme);
    setTimerMinutes(theme.suggestedMinutes);
    setActiveView("timer");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSendPrayerToTimer = useCallback((prayer: ComposedPrayer) => {
    setTimerPrayer(prayer);
    setTimerMinutes(10);
    setActiveView("timer");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSavePrayer = useCallback(
    (prayer: ComposedPrayer) => {
      const id = `prayer-${Date.now()}`;
      const newEntry: SavedPrayerEntry = {
        id,
        createdAt: new Date().toISOString(),
        title: prayer.title,
        themeTitle: selectedTheme?.title,
        heart: { ...heart },
        organizedSummary: prayer.organizedSummary,
        prayerParagraphs: prayer.prayerParagraphs,
        structureNotes: prayer.structureNotes,
        anchorVerse: prayer.anchorVerse,
        faithStep: prayer.faithStep,
        answered: false,
        testimonyNote: "",
      };
      setSavedPrayers((prev) => {
        const next = [newEntry, ...prev];
        persistSavedPrayers(next);
        return next;
      });
      setSavedCurrentId(id);
    },
    [heart, selectedTheme]
  );

  const handleLogFocusSession = useCallback(
    (durationMinutes: number, prayerTitle?: string) => {
      const record: FocusSessionRecord = {
        id: `session-${Date.now()}`,
        completedAt: new Date().toISOString(),
        durationMinutes,
        prayerTitle,
      };
      setFocusSessions((prev) => {
        const next = [record, ...prev];
        persistFocusSessions(next);
        return next;
      });
    },
    []
  );

  const handleToggleAnswered = useCallback((id: string) => {
    setSavedPrayers((prev) => {
      const next = prev.map((entry) =>
        entry.id === id ? { ...entry, answered: !entry.answered } : entry
      );
      persistSavedPrayers(next);
      return next;
    });
  }, []);

  const handleUpdateTestimony = useCallback((id: string, note: string) => {
    setSavedPrayers((prev) => {
      const next = prev.map((entry) =>
        entry.id === id ? { ...entry, testimonyNote: note } : entry
      );
      persistSavedPrayers(next);
      return next;
    });
  }, []);

  const handleDeletePrayer = useCallback((id: string) => {
    setSavedPrayers((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      persistSavedPrayers(next);
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-[#111827] font-light">
      <TopBar
        activeView={activeView}
        onSelectView={(view) => {
          setActiveView(view);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onStartFreshPrayer={handleResetBuilder}
      />

      <main className="flex-1">
        {activeView === "builder" && (
          <PrayerBuilderView
            todayTheme={todayTheme}
            selectedTheme={selectedTheme}
            onClearTheme={() => setSelectedTheme(null)}
            onSelectTodayTheme={() => handlePrayWithTheme(todayTheme)}
            heart={heart}
            onHeartChange={setHeart}
            wizardStep={wizardStep}
            onWizardStepChange={setWizardStep}
            questionsData={questionsData}
            onQuestionsDataChange={setQuestionsData}
            answers={answers}
            onAnswersChange={setAnswers}
            composedPrayer={composedPrayer}
            onComposedPrayerChange={(prayer) => {
              setComposedPrayer(prayer);
              setSavedCurrentId(null);
            }}
            isSavedCurrent={Boolean(savedCurrentId)}
            onSavePrayer={handleSavePrayer}
            onSendToTimer={handleSendPrayerToTimer}
            onResetAll={handleResetBuilder}
          />
        )}

        {activeView === "daily" && (
          <DailyThemesView
            todayTheme={todayTheme}
            onPrayWithTheme={handlePrayWithTheme}
            onFocusWithTheme={handleFocusWithTheme}
          />
        )}

        {activeView === "timer" && (
          <FocusTimerView
            activePrayer={timerPrayer}
            activeTheme={timerTheme}
            initialMinutes={timerMinutes}
            totalMinutesLogged={totalMinutesLogged}
            onLogSession={handleLogFocusSession}
            onGoToBuilder={() => setActiveView("builder")}
          />
        )}

        {activeView === "journal" && (
          <JournalView
            prayers={savedPrayers}
            sessions={focusSessions}
            onToggleAnswered={handleToggleAnswered}
            onUpdateTestimony={handleUpdateTestimony}
            onDeletePrayer={handleDeletePrayer}
            onSendToTimer={handleSendPrayerToTimer}
            onGoToBuilder={() => setActiveView("builder")}
          />
        )}

        {activeView === "update" && <UpdateView />}
      </main>

      <footer className="border-t border-[#E5E7EB] mt-16 bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#525C6B]">
          <div className="flex flex-wrap items-center gap-2 font-light">
            <span>
              Oratório — Um auxílio para fortalecer a oração, nunca para substituí-la.
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                setActiveView("update");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="font-bold text-[#0F3D34] hover:underline underline-offset-4 whitespace-nowrap"
            >
              v{APP_VERSION} · Atualizar APK
            </button>
          </div>
          <p className="text-xs font-light italic text-[#111827]">
            “Perseverem na oração, vigiando com ações de graças.” — Colossenses 4:2
          </p>
        </div>
      </footer>
    </div>
  );
}
