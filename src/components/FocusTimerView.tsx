import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { ComposedPrayer, DailyBiblicalTheme } from "../types/prayer";
import { playGentleChime } from "../utils/chime";

interface FocusTimerViewProps {
  activePrayer: ComposedPrayer | null;
  activeTheme: DailyBiblicalTheme;
  initialMinutes?: number;
  totalMinutesLogged: number;
  onLogSession: (durationMinutes: number, prayerTitle?: string) => void;
  onGoToBuilder: () => void;
}

const DURATION_PRESETS = [3, 5, 10, 15, 20];

const GUIDED_PHASES = [
  {
    index: "01",
    title: "Silêncio e Adoração",
    guidance:
      "Respire devagar e reconheça a presença fiel de Deus. Não há pressa — apenas permaneça diante do Pai.",
  },
  {
    index: "02",
    title: "Sinceridade e Entrega",
    guidance:
      "Traga com verdade seus sentimentos, cansaços e medos. Entregue a Ele o que foge ao seu controle.",
  },
  {
    index: "03",
    title: "Petição e Propósito",
    guidance:
      "Apresente seus desejos, decisões e pessoas que você ama, pedindo sabedoria e coragem segundo a vontade de Deus.",
  },
  {
    index: "04",
    title: "Gratidão e Descanso",
    guidance:
      "Agradeça pela bondade que já sustenta sua vida e descanse na paz de Cristo antes de concluir.",
  },
];

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function FocusTimerView({
  activePrayer,
  activeTheme,
  initialMinutes = 10,
  totalMinutesLogged,
  onLogSession,
  onGoToBuilder,
}: FocusTimerViewProps) {
  const [selectedMinutes, setSelectedMinutes] = useState(initialMinutes);
  const [remainingSeconds, setRemainingSeconds] = useState(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loggedThisRun, setLoggedThisRun] = useState(false);
  const [guidedMode, setGuidedMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const endTimestampRef = useRef<number | null>(null);
  const totalSeconds = selectedMinutes * 60;
  const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
  const progress = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;

  useEffect(() => {
    setSelectedMinutes(initialMinutes);
    setRemainingSeconds(initialMinutes * 60);
    setIsRunning(false);
    setCompleted(false);
    setLoggedThisRun(false);
    endTimestampRef.current = null;
  }, [initialMinutes, activePrayer, activeTheme.id]);

  useEffect(() => {
    if (!isRunning) return;

    endTimestampRef.current = Date.now() + remainingSeconds * 1000;

    const id = window.setInterval(() => {
      if (!endTimestampRef.current) return;
      const diffSec = Math.ceil((endTimestampRef.current - Date.now()) / 1000);
      if (diffSec <= 0) {
        setRemainingSeconds(0);
        setIsRunning(false);
        setCompleted(true);
        endTimestampRef.current = null;
        if (soundEnabled) {
          playGentleChime("complete");
        }
      } else {
        setRemainingSeconds(diffSec);
      }
    }, 250);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, soundEnabled]);

  useEffect(() => {
    if (completed && !loggedThisRun) {
      setLoggedThisRun(true);
      onLogSession(
        selectedMinutes,
        activePrayer ? activePrayer.title : activeTheme.title
      );
    }
  }, [completed, loggedThisRun, onLogSession, selectedMinutes, activePrayer, activeTheme.title]);

  const currentPhase = useMemo(() => {
    const phaseIdx = Math.min(
      GUIDED_PHASES.length - 1,
      Math.floor(progress * GUIDED_PHASES.length)
    );
    return GUIDED_PHASES[phaseIdx];
  }, [progress]);

  const handleSelectPreset = (minutes: number) => {
    setIsRunning(false);
    setCompleted(false);
    setLoggedThisRun(false);
    setSelectedMinutes(minutes);
    setRemainingSeconds(minutes * 60);
    endTimestampRef.current = null;
  };

  const handleTogglePlay = () => {
    if (completed) {
      setRemainingSeconds(selectedMinutes * 60);
      setCompleted(false);
      setLoggedThisRun(false);
      if (soundEnabled) playGentleChime("start");
      setIsRunning(true);
      return;
    }
    if (!isRunning && remainingSeconds === totalSeconds && soundEnabled) {
      playGentleChime("start");
    }
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    setCompleted(false);
    setLoggedThisRun(false);
    setRemainingSeconds(selectedMinutes * 60);
    endTimestampRef.current = null;
  };

  const handleFinishEarly = () => {
    setIsRunning(false);
    setCompleted(true);
    if (!loggedThisRun) {
      const minutesSpent = Math.max(1, Math.round(elapsedSeconds / 60));
      setLoggedThisRun(true);
      onLogSession(
        minutesSpent,
        activePrayer ? activePrayer.title : activeTheme.title
      );
    }
    if (soundEnabled) {
      playGentleChime("complete");
    }
  };

  const radius = 112;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 lg:py-12">
      <div className="mb-10 pb-5 border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[#0F3D34] mb-1.5">
            Tempo Separado de Oração
          </p>
          <h1 className="font-display-condensed text-4xl sm:text-5xl text-[#111827] leading-none">
            Cronômetro de Foco
          </h1>
        </div>
        <p className="text-xs font-medium text-[#525C6B] font-mono tabular-nums">
          Total dedicado: {totalMinutesLogged} min
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-10 items-start">
        {/* Left: Focal Timer Stage */}
        <section
          aria-label="Cronômetro de oração"
          className="bg-white border border-[#E5E7EB] rounded-2xl p-7 sm:p-10 flex flex-col items-center text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
        >
          {/* Mode & Sound Controls */}
          <div className="w-full flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-[#E5E7EB]">
            <div
              role="group"
              aria-label="Modo do cronômetro"
              className="flex items-center gap-1 p-1 bg-[#F2F4F7] rounded-xl"
            >
              <button
                type="button"
                onClick={() => setGuidedMode(true)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  guidedMode
                    ? "bg-white text-[#0F3D34] font-bold shadow-xs"
                    : "text-[#525C6B] font-light hover:text-[#111827]"
                }`}
              >
                Fases guiadas
              </button>
              <button
                type="button"
                onClick={() => setGuidedMode(false)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  !guidedMode
                    ? "bg-white text-[#0F3D34] font-bold shadow-xs"
                    : "text-[#525C6B] font-light hover:text-[#111827]"
                }`}
              >
                Silêncio livre
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#525C6B] hover:text-[#111827] rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-[#0F3D34]" />
                  Sino suave
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-[#7B8494]" />
                  Sem som
                </>
              )}
            </button>
          </div>

          {/* Precision Ring + Tabular Time */}
          <div className="relative my-8 w-64 h-64 flex items-center justify-center">
            <svg
              className="w-full h-full -rotate-90"
              viewBox="0 0 256 256"
              aria-hidden="true"
            >
              <circle
                cx="128"
                cy="128"
                r={radius}
                fill="none"
                stroke="#EAECEF"
                strokeWidth="3.5"
              />
              <circle
                cx="128"
                cy="128"
                r={radius}
                fill="none"
                stroke="#0F3D34"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-[stroke-dashoffset] duration-300 ease-out"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
              <span className="font-mono text-5xl font-medium tracking-tight text-[#111827] tabular-nums">
                {formatTimer(remainingSeconds)}
              </span>
              <span className="mt-2 text-xs font-light text-[#525C6B]">
                {completed
                  ? "Tempo concluído"
                  : isRunning
                    ? guidedMode
                      ? `${currentPhase.index} · ${currentPhase.title}`
                      : "Em oração"
                    : "Pronto para começar"}
              </span>
            </div>
          </div>

          {/* Guided phase cue or completion acknowledgment */}
          <div className="min-h-[76px] max-w-md">
            {completed ? (
              <div className="flex flex-col items-center">
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0F3D34]">
                  <CheckCircle2 className="w-4 h-4" />
                  Momento de oração registrado
                </p>
                <p className="mt-1.5 text-sm font-light text-[#525C6B] leading-relaxed">
                  Que a paz de Deus guarde o seu coração e a sua mente ao longo deste dia.
                </p>
              </div>
            ) : guidedMode ? (
              <div>
                <p className="text-xs font-bold text-[#0F3D34]">
                  {currentPhase.index}. {currentPhase.title}
                </p>
                <p className="mt-1.5 text-sm font-light text-[#525C6B] leading-relaxed">
                  {currentPhase.guidance}
                </p>
              </div>
            ) : (
              <p className="text-sm font-light text-[#525C6B] leading-relaxed">
                Deixe as distrações de lado e converse livremente com Deus no seu ritmo.
              </p>
            )}
          </div>

          {/* Duration selector */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-1.5">
            {DURATION_PRESETS.map((mins) => {
              const active = selectedMinutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleSelectPreset(mins)}
                  className={`px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                    active
                      ? "bg-[#EAF3F0] border-[#0F3D34] text-[#0F3D34] font-bold"
                      : "bg-white border-[#E5E7EB] text-[#525C6B] hover:border-[#0F3D34]"
                  }`}
                >
                  {mins} min
                </button>
              );
            })}
          </div>

          {/* Primary Play / Pause / Reset controls */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-[#0F3D34] rounded-lg hover:bg-[#0A2C25] transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {completed
                    ? "Orar novamente"
                    : remainingSeconds < totalSeconds
                      ? "Retomar"
                      : "Iniciar"}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-[#525C6B] hover:text-[#111827] border border-[#E5E7EB] rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4" />
              Reiniciar
            </button>

            {elapsedSeconds >= 30 && !completed && (
              <button
                type="button"
                onClick={handleFinishEarly}
                className="px-4 py-3 text-sm font-bold text-[#0F3D34] hover:underline underline-offset-4 whitespace-nowrap shrink-0 min-h-[44px]"
              >
                Concluir e registrar
              </button>
            )}
          </div>
        </section>

        {/* Right: Reading Companion (Active Prayer or Daily Theme) */}
        <aside className="space-y-6">
          {activePrayer ? (
            <div>
              <p className="text-xs font-bold text-[#0F3D34] mb-1.5">
                Oração em Foco
              </p>
              <h2 className="font-display-condensed text-3xl sm:text-4xl text-[#111827] leading-tight">
                {activePrayer.title}
              </h2>

              <div className="mt-6 space-y-4 max-w-prose">
                {activePrayer.prayerParagraphs.map((para, idx) => (
                  <p
                    key={idx}
                    className="text-base sm:text-[1.06rem] font-light leading-[1.85] text-[#111827]"
                  >
                    {para}
                  </p>
                ))}
              </div>

              <blockquote className="mt-8 py-5 border-y border-[#E5E7EB]">
                <p className="text-base sm:text-lg font-light italic text-[#111827] leading-relaxed">
                  “{activePrayer.anchorVerse.text}”
                </p>
                <footer className="mt-2 text-xs font-bold text-[#0F3D34]">
                  {activePrayer.anchorVerse.reference}
                </footer>
              </blockquote>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold text-[#0F3D34] mb-1.5">
                Roteiro de Meditação · {activeTheme.category}
              </p>
              <h2 className="font-display-condensed text-3xl sm:text-4xl text-[#111827] leading-tight">
                {activeTheme.title}
              </h2>

              <blockquote className="mt-6 py-5 border-y border-[#E5E7EB]">
                <p className="text-lg font-light italic text-[#111827] leading-relaxed">
                  “{activeTheme.verseText}”
                </p>
                <footer className="mt-2 text-xs font-bold text-[#0F3D34]">
                  {activeTheme.verseReference}
                </footer>
              </blockquote>

              <ol className="mt-6 space-y-4">
                {activeTheme.prayerDirections.map((dir, idx) => (
                  <li key={dir.label} className="text-sm font-light text-[#525C6B] leading-relaxed">
                    <span className="font-bold text-[#0F3D34]">
                      0{idx + 1}. {dir.label}:{" "}
                    </span>
                    {dir.prompt}
                  </li>
                ))}
              </ol>

              <div className="mt-7 pt-6 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={onGoToBuilder}
                  className="text-sm font-bold text-[#0F3D34] hover:underline underline-offset-4"
                >
                  Quer montar uma oração personalizada com seus sentimentos de hoje?
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
