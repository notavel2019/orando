import { useCallback, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  Clock,
  Copy,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  X,
} from "lucide-react";
import type {
  ComposedPrayer,
  DailyBiblicalTheme,
  HeartInput,
  QuestionsResponse,
} from "../types/prayer";
import { useSpeechInput } from "../hooks/useSpeechInput";
import { formatPortugueseDate } from "../data/dailyThemes";
import { apiUrl, isStandaloneOfflineOrigin } from "../utils/appUpdate";
import {
  composeOfflinePrayer,
  generateOfflineQuestions,
} from "../utils/offlinePrayerGuide";

interface PrayerBuilderViewProps {
  todayTheme: DailyBiblicalTheme;
  selectedTheme: DailyBiblicalTheme | null;
  onClearTheme: () => void;
  onSelectTodayTheme: () => void;
  heart: HeartInput;
  onHeartChange: (next: HeartInput) => void;
  step: 1 | 2 | 3;
  onStepChange: (step: 1 | 2 | 3) => void;
  questionsData: QuestionsResponse | null;
  onQuestionsDataChange: (data: QuestionsResponse | null) => void;
  answers: Record<string, string>;
  onAnswersChange: (answers: Record<string, string>) => void;
  composedPrayer: ComposedPrayer | null;
  onComposedPrayerChange: (prayer: ComposedPrayer | null) => void;
  isSavedCurrent: boolean;
  onSavePrayer: (prayer: ComposedPrayer) => void;
  onSendToTimer: (prayer: ComposedPrayer) => void;
  onResetAll: () => void;
}

const STARTER_PROMPTS: { label: string; patch: Partial<HeartInput> }[] = [
  {
    label: "Ansiedade diante de uma decisão",
    patch: {
      feelings: "Inquietação e peso no coração ao pensar no futuro.",
      fears: "Medo de escolher o caminho errado e decepcionar quem amo.",
      courage: "Coragem para confiar no tempo de Deus e dar o passo certo.",
    },
  },
  {
    label: "Cansaço e busca por renovo",
    patch: {
      feelings: "Cansaço acumulado, mas ainda com gratidão por estar de pé.",
      desires: "Reencontrar descanso verdadeiro e leveza na rotina.",
      fears: "Receio de perder o ânimo nas responsabilidades diárias.",
    },
  },
  {
    label: "Coragem para perdoar e recomeçar",
    patch: {
      feelings: "Mágoa misturada com vontade sincera de ter paz interior.",
      desires: "Que Deus cure meu coração e restaure a mansidão nas minhas palavras.",
      courage: "Coragem para soltar o ressentimento e agir com amor cristão.",
    },
  },
];

export function PrayerBuilderView({
  todayTheme,
  selectedTheme,
  onClearTheme,
  onSelectTodayTheme,
  heart,
  onHeartChange,
  step,
  onStepChange,
  questionsData,
  onQuestionsDataChange,
  answers,
  onAnswersChange,
  composedPrayer,
  onComposedPrayerChange,
  isSavedCurrent,
  onSavePrayer,
  onSendToTimer,
  onResetAll,
}: PrayerBuilderViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingOfflineMode, setUsingOfflineMode] = useState(false);
  const [copied, setCopied] = useState(false);

  const heartRef = useRef(heart);
  heartRef.current = heart;
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const handleVoiceTranscript = useCallback(
    (fieldKey: string, spoken: string) => {
      if (fieldKey.startsWith("answer:")) {
        const qId = fieldKey.slice("answer:".length);
        const curAnswers = answersRef.current;
        const current = curAnswers[qId] ?? "";
        onAnswersChange({
          ...curAnswers,
          [qId]: current ? `${current} ${spoken}` : spoken,
        });
        return;
      }

      const key = fieldKey as keyof HeartInput;
      const curHeart = heartRef.current;
      const current = curHeart[key] ?? "";
      onHeartChange({
        ...curHeart,
        [key]: current ? `${current} ${spoken}` : spoken,
      });
    },
    [onAnswersChange, onHeartChange]
  );

  const speech = useSpeechInput<string>(handleVoiceTranscript);

  const toggleVoiceForField = (fieldKey: string, promptLabel: string) => {
    speech.toggleField(fieldKey, promptLabel);
  };

  const hasHeartContent = Boolean(
    heart.feelings.trim() ||
      heart.desires.trim() ||
      heart.fears.trim() ||
      heart.courage.trim() ||
      heart.freeText.trim()
  );

  const handleGenerateQuestions = async () => {
    if (!hasHeartContent) {
      setError("Compartilhe ao menos um sentimento, desejo, medo ou relato livre para continuarmos.");
      return;
    }
    if (speech.isListening) {
      speech.stop();
    }

    setError(null);
    setLoading(true);
    const themeContext = selectedTheme
      ? `${selectedTheme.title} (${selectedTheme.verseReference}: "${selectedTheme.verseText}")`
      : "";

    try {
      if (isStandaloneOfflineOrigin()) {
        const offline = generateOfflineQuestions(heart, themeContext);
        setUsingOfflineMode(true);
        onQuestionsDataChange(offline);
        onAnswersChange({});
        onStepChange(2);
        return;
      }

      const res = await fetch(apiUrl("/api/prayer/questions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...heart,
          themeContext,
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const offline = generateOfflineQuestions(heart, themeContext);
        setUsingOfflineMode(true);
        onQuestionsDataChange(offline);
        onAnswersChange({});
        onStepChange(2);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível preparar as perguntas agora.");
      }
      setUsingOfflineMode(false);
      onQuestionsDataChange(data as QuestionsResponse);
      onAnswersChange({});
      onStepChange(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleComposePrayer = async () => {
    setError(null);
    setLoading(true);
    const formattedAnswers = (questionsData?.questions ?? [])
      .map((q) => ({
        question: q.question,
        answer: (answers[q.id] ?? "").trim(),
      }))
      .filter((item) => item.answer.length > 0);
    const themeContext = selectedTheme
      ? `${selectedTheme.title} (${selectedTheme.verseReference})`
      : "";

    try {
      if (isStandaloneOfflineOrigin()) {
        const offlinePrayer = composeOfflinePrayer(heart, formattedAnswers, themeContext);
        setUsingOfflineMode(true);
        onComposedPrayerChange(offlinePrayer);
        onStepChange(3);
        return;
      }

      const res = await fetch(apiUrl("/api/prayer/compose"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heart,
          answers: formattedAnswers,
          themeContext,
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const offlinePrayer = composeOfflinePrayer(heart, formattedAnswers, themeContext);
        setUsingOfflineMode(true);
        onComposedPrayerChange(offlinePrayer);
        onStepChange(3);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível montar sua oração agora.");
      }
      setUsingOfflineMode(false);
      onComposedPrayerChange(data as ComposedPrayer);
      onStepChange(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao montar a oração.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrayer = async () => {
    if (!composedPrayer) return;
    const text = [
      composedPrayer.title,
      "",
      ...composedPrayer.prayerParagraphs,
      "",
      `"${composedPrayer.anchorVerse.text}" — ${composedPrayer.anchorVerse.reference}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in iframe fallback ignored silently
    }
  };

  const stepLabels = [
    { num: 1 as const, label: "01. Abrir o coração" },
    { num: 2 as const, label: "02. Perguntas reflexivas" },
    { num: 3 as const, label: "03. Oração estruturada" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 lg:py-14">
      {/* Editorial Step Indicator */}
      <div className="mb-10 pb-5 border-b border-[#E5E1D8] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium tracking-wide">
          {stepLabels.map((s, idx) => {
            const canClick =
              s.num === 1 ||
              (s.num === 2 && Boolean(questionsData)) ||
              (s.num === 3 && Boolean(composedPrayer));
            const isCurrent = step === s.num;
            return (
              <div key={s.num} className="flex items-center gap-5">
                <button
                  type="button"
                  disabled={!canClick}
                  onClick={() => canClick && onStepChange(s.num)}
                  className={`transition-colors whitespace-nowrap shrink-0 ${
                    isCurrent
                      ? "text-[#1B3B2F] font-semibold"
                      : canClick
                        ? "text-[#5E5B52] hover:text-[#1C1B18]"
                        : "text-[#8A8578]/70 cursor-default"
                  }`}
                >
                  {s.label}
                </button>
                {idx < stepLabels.length - 1 && (
                  <span aria-hidden="true" className="text-[#D6CEBE]">
                    /
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-[#5E5B52] capitalize">
          {formatPortugueseDate()}
        </p>
      </div>

      {/* STEP 1: OPEN YOUR HEART */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-12 items-start">
          <section aria-labelledby="heart-heading">
            <p className="text-xs uppercase tracking-[0.14em] text-[#5E5B52] mb-3">
              Guia de Oração Pessoal
            </p>
            <h1
              id="heart-heading"
              className="font-serif text-4xl sm:text-5xl font-medium tracking-tight text-[#1C1B18] leading-[1.12] max-w-2xl"
            >
              Traga com verdade o que está no seu coração hoje.
            </h1>
            <p className="mt-4 text-base text-[#5E5B52] leading-relaxed max-w-2xl">
              Compartilhe seus sentimentos, desejos, pretensões, medos e onde busca coragem.
              Depois, faremos três perguntas breves para ajudar você a organizar uma oração
              genuína e alinhada aos propósitos de Deus.
            </p>

            {selectedTheme && (
              <div className="mt-6 p-4 bg-[#F2EFE8] border border-[#E5E1D8] rounded-md flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-[#5E5B52]">
                    Tema bíblico selecionado · {selectedTheme.verseReference}
                  </p>
                  <p className="mt-1 font-serif text-lg font-medium text-[#1C1B18]">
                    {selectedTheme.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClearTheme}
                  className="p-1.5 text-[#5E5B52] hover:text-[#1C1B18] rounded transition-colors shrink-0"
                  aria-label="Remover tema selecionado"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Quick starters for users who don't know where to begin */}
            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#5E5B52]">
              <span className="text-[#8A8578]">Não sabe por onde começar?</span>
              {STARTER_PROMPTS.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  onClick={() =>
                    onHeartChange({
                      ...heart,
                      ...starter.patch,
                    })
                  }
                  className="underline decoration-[#D6CEBE] underline-offset-4 hover:text-[#1B3B2F] hover:decoration-[#1B3B2F] transition-colors whitespace-nowrap"
                >
                  {starter.label}
                </button>
              ))}
            </div>

            {/* Live voice status or error notice */}
            {(speech.isListening || speech.isTranscribing || speech.errorMessage) && (
              <div className="mt-6">
                {speech.isListening && (
                  <div className="p-3.5 rounded-md bg-[#EBF1EE] border border-[#C8DBD2] text-sm text-[#1B3B2F] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">Ouvindo sua voz em português...</p>
                      {speech.interimText && (
                        <p className="mt-0.5 text-xs text-[#4C6459] truncate">
                          “{speech.interimText}”
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={speech.stop}
                      className="px-3 py-1.5 text-xs font-medium bg-[#1B3B2F] text-[#F9F8F4] rounded whitespace-nowrap shrink-0"
                    >
                      Concluir fala
                    </button>
                  </div>
                )}

                {speech.isTranscribing && (
                  <div className="p-3.5 rounded-md bg-[#F2EFE8] border border-[#E5E1D8] text-sm text-[#1C1B18] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1B3B2F]" />
                    <span>Transcrevendo o que você falou...</span>
                  </div>
                )}

                {speech.errorMessage && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-md bg-[#FDF2F2] border border-[#EBCACA] text-sm text-[#7F1D1D] flex items-start justify-between gap-3"
                  >
                    <span>{speech.errorMessage}</span>
                    <button
                      type="button"
                      onClick={speech.clearError}
                      aria-label="Fechar aviso"
                      className="p-0.5 text-[#7F1D1D] shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Structured dimensions directly honoring the audio prompt */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="field-feelings"
                    className="text-sm font-medium text-[#1C1B18]"
                  >
                    Sentimentos de hoje
                  </label>
                  {speech.isSupported && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleVoiceForField("feelings", "Fale seus sentimentos de hoje...")
                      }
                      className={`inline-flex items-center gap-1 text-xs transition-colors whitespace-nowrap min-h-[32px] px-1.5 ${
                        speech.isListening && speech.activeField === "feelings"
                          ? "text-[#1B3B2F] font-semibold"
                          : "text-[#5E5B52] hover:text-[#1C1B18]"
                      }`}
                    >
                      {speech.isListening && speech.activeField === "feelings" ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          Parar voz
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          Falar
                        </>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  id="field-feelings"
                  rows={3}
                  value={heart.feelings}
                  onChange={(e) => onHeartChange({ ...heart, feelings: e.target.value })}
                  placeholder="Ex.: gratidão pela família, cansaço no trabalho, inquietação..."
                  className="w-full rounded-md bg-white border border-[#E5E1D8] px-3.5 py-3 text-sm text-[#1C1B18] placeholder:text-[#8A8578] focus:border-[#1B3B2F] transition-colors resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="field-desires"
                    className="text-sm font-medium text-[#1C1B18]"
                  >
                    Desejos e pretensões
                  </label>
                  {speech.isSupported && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleVoiceForField("desires", "Fale seus desejos e pretensões...")
                      }
                      className={`inline-flex items-center gap-1 text-xs transition-colors whitespace-nowrap min-h-[32px] px-1.5 ${
                        speech.isListening && speech.activeField === "desires"
                          ? "text-[#1B3B2F] font-semibold"
                          : "text-[#5E5B52] hover:text-[#1C1B18]"
                      }`}
                    >
                      {speech.isListening && speech.activeField === "desires" ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          Parar voz
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          Falar
                        </>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  id="field-desires"
                  rows={3}
                  value={heart.desires}
                  onChange={(e) => onHeartChange({ ...heart, desires: e.target.value })}
                  placeholder="O que você deseja construir, alcançar ou apresentar diante de Deus?"
                  className="w-full rounded-md bg-white border border-[#E5E1D8] px-3.5 py-3 text-sm text-[#1C1B18] placeholder:text-[#8A8578] focus:border-[#1B3B2F] transition-colors resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="field-fears"
                    className="text-sm font-medium text-[#1C1B18]"
                  >
                    O que você teme ou tem medo
                  </label>
                  {speech.isSupported && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleVoiceForField("fears", "Fale o que você teme ou tem medo...")
                      }
                      className={`inline-flex items-center gap-1 text-xs transition-colors whitespace-nowrap min-h-[32px] px-1.5 ${
                        speech.isListening && speech.activeField === "fears"
                          ? "text-[#1B3B2F] font-semibold"
                          : "text-[#5E5B52] hover:text-[#1C1B18]"
                      }`}
                    >
                      {speech.isListening && speech.activeField === "fears" ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          Parar voz
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          Falar
                        </>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  id="field-fears"
                  rows={3}
                  value={heart.fears}
                  onChange={(e) => onHeartChange({ ...heart, fears: e.target.value })}
                  placeholder="Receios, incertezas ou pesos que têm roubado sua paz..."
                  className="w-full rounded-md bg-white border border-[#E5E1D8] px-3.5 py-3 text-sm text-[#1C1B18] placeholder:text-[#8A8578] focus:border-[#1B3B2F] transition-colors resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="field-courage"
                    className="text-sm font-medium text-[#1C1B18]"
                  >
                    Onde precisa de coragem
                  </label>
                  {speech.isSupported && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleVoiceForField("courage", "Fale onde você precisa de coragem...")
                      }
                      className={`inline-flex items-center gap-1 text-xs transition-colors whitespace-nowrap min-h-[32px] px-1.5 ${
                        speech.isListening && speech.activeField === "courage"
                          ? "text-[#1B3B2F] font-semibold"
                          : "text-[#5E5B52] hover:text-[#1C1B18]"
                      }`}
                    >
                      {speech.isListening && speech.activeField === "courage" ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          Parar voz
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          Falar
                        </>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  id="field-courage"
                  rows={3}
                  value={heart.courage}
                  onChange={(e) => onHeartChange({ ...heart, courage: e.target.value })}
                  placeholder="Qual atitude, conversa ou passo de fé exige firmeza agora?"
                  className="w-full rounded-md bg-white border border-[#E5E1D8] px-3.5 py-3 text-sm text-[#1C1B18] placeholder:text-[#8A8578] focus:border-[#1B3B2F] transition-colors resize-none"
                />
              </div>
            </div>

            {/* Free-form heart note */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="field-free"
                  className="text-sm font-medium text-[#1C1B18]"
                >
                  Ou escreva livremente o que quiser dizer a Deus{" "}
                  <span className="font-normal text-[#8A8578]">(opcional)</span>
                </label>
                {speech.isSupported && (
                  <button
                    type="button"
                    onClick={() =>
                      toggleVoiceForField("freeText", "Fale livremente o que está no seu coração...")
                    }
                    className={`inline-flex items-center gap-1.5 text-xs transition-colors whitespace-nowrap min-h-[32px] px-1.5 ${
                      speech.isListening && speech.activeField === "freeText"
                        ? "text-[#1B3B2F] font-semibold"
                        : "text-[#5E5B52] hover:text-[#1C1B18]"
                    }`}
                  >
                    {speech.isListening && speech.activeField === "freeText" ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        Ouvindo — tocar para parar
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        Falar pelo microfone
                      </>
                    )}
                  </button>
                )}
              </div>
              <textarea
                id="field-free"
                rows={4}
                value={heart.freeText}
                onChange={(e) => onHeartChange({ ...heart, freeText: e.target.value })}
                placeholder="Fale como conversaria com um amigo fiel. Não precisa usar palavras difíceis..."
                className="w-full rounded-md bg-white border border-[#E5E1D8] px-4 py-3 text-sm text-[#1C1B18] placeholder:text-[#8A8578] focus:border-[#1B3B2F] transition-colors"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 p-3.5 rounded-md bg-[#FDF2F2] border border-[#EBCACA] text-sm text-[#7F1D1D]"
              >
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-[#5E5B52]">
                Suas reflexões ficam apenas no seu navegador e não são publicadas.
              </p>
              <button
                type="button"
                onClick={handleGenerateQuestions}
                disabled={loading || !hasHeartContent}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-[#F9F8F4] bg-[#1B3B2F] rounded-md hover:bg-[#142D24] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Preparando perguntas...
                  </>
                ) : (
                  <>
                    Continuar para as perguntas
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Editorial Right Rail: Daily Verse + Purpose */}
          <aside className="lg:border-l lg:border-[#E5E1D8] lg:pl-9 space-y-8">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#5E5B52] mb-2">
                Sugestão de Hoje · {todayTheme.category}
              </p>
              <h2 className="font-serif text-2xl font-medium text-[#1C1B18] leading-snug">
                {todayTheme.title}
              </h2>
              <blockquote className="mt-4 py-4 border-y border-[#E5E1D8]">
                <p className="font-serif italic text-lg text-[#1C1B18] leading-relaxed">
                  “{todayTheme.verseText}”
                </p>
                <footer className="mt-2 text-xs text-[#5E5B52]">
                  {todayTheme.verseReference}
                </footer>
              </blockquote>
              <p className="mt-4 text-sm text-[#5E5B52] leading-relaxed">
                {todayTheme.meditation}
              </p>
              <button
                type="button"
                onClick={onSelectTodayTheme}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#1B3B2F] hover:underline underline-offset-4 whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4" />
                Usar este tema na oração
              </button>
            </div>

            <div className="pt-7 border-t border-[#E5E1D8]">
              <h3 className="text-sm font-semibold text-[#1C1B18]">
                Para fortalecer, nunca substituir
              </h3>
              <p className="mt-2 text-sm text-[#5E5B52] leading-relaxed">
                Nenhuma ferramenta substitui o encontro pessoal com Deus. O Oratório
                ajuda você a nomear o que sente, refletir à luz das Escrituras e
                aprender uma estrutura bíblica simples para orar com autonomia.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* STEP 2: TAILORED REFLECTIVE QUESTIONS */}
      {step === 2 && questionsData && (
        <div className="max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-[0.14em] text-[#5E5B52] mb-3">
            Etapa 02 · Aprofundamento do coração
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium text-[#1C1B18] leading-tight">
            {questionsData.acknowledgment}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#5E5B52] leading-relaxed">
            Responda com sinceridade ao que fizer sentido para você hoje. Suas respostas
            ajudarão a montar uma oração resumida, verdadeira e alinhada à vontade de Deus.
          </p>

          {(speech.isListening || speech.isTranscribing || speech.errorMessage) && (
            <div className="mt-6">
              {speech.isListening && (
                <div className="p-3.5 rounded-md bg-[#EBF1EE] border border-[#C8DBD2] text-sm text-[#1B3B2F] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">Ouvindo sua resposta em português...</p>
                    {speech.interimText && (
                      <p className="mt-0.5 text-xs text-[#4C6459] truncate">
                        “{speech.interimText}”
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={speech.stop}
                    className="px-3 py-1.5 text-xs font-medium bg-[#1B3B2F] text-[#F9F8F4] rounded whitespace-nowrap shrink-0"
                  >
                    Concluir fala
                  </button>
                </div>
              )}
              {speech.isTranscribing && (
                <div className="p-3.5 rounded-md bg-[#F2EFE8] border border-[#E5E1D8] text-sm text-[#1C1B18] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1B3B2F]" />
                  <span>Transcrevendo o que você falou...</span>
                </div>
              )}
              {speech.errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-md bg-[#FDF2F2] border border-[#EBCACA] text-sm text-[#7F1D1D] flex items-start justify-between gap-3"
                >
                  <span>{speech.errorMessage}</span>
                  <button
                    type="button"
                    onClick={speech.clearError}
                    aria-label="Fechar aviso"
                    className="p-0.5 text-[#7F1D1D] shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-10 divide-y divide-[#E5E1D8] border-y border-[#E5E1D8]">
            {questionsData.questions.map((item, idx) => {
              const voiceKey = `answer:${item.id}`;
              const isFieldListening =
                speech.isListening && speech.activeField === voiceKey;
              return (
                <div key={item.id} className="py-7">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 text-xs text-[#5E5B52]">
                      <span className="font-mono tabular-nums text-[#1B3B2F]">
                        0{idx + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.focus}</span>
                    </div>
                    {speech.isSupported && (
                      <button
                        type="button"
                        onClick={() => toggleVoiceForField(voiceKey, item.question)}
                        className={`inline-flex items-center gap-1 text-xs transition-colors whitespace-nowrap min-h-[32px] px-1.5 ${
                          isFieldListening
                            ? "text-[#1B3B2F] font-semibold"
                            : "text-[#5E5B52] hover:text-[#1C1B18]"
                        }`}
                      >
                        {isFieldListening ? (
                          <>
                            <MicOff className="w-3.5 h-3.5" />
                            Parar voz
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            Responder por voz
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <label
                    htmlFor={`answer-${item.id}`}
                    className="block font-serif text-2xl font-medium text-[#1C1B18] leading-snug"
                  >
                    {item.question}
                  </label>
                  <p className="mt-1.5 text-xs text-[#8A8578]">{item.hint}</p>
                  <textarea
                    id={`answer-${item.id}`}
                    rows={3}
                    value={answers[item.id] ?? ""}
                    onChange={(e) =>
                      onAnswersChange({
                        ...answers,
                        [item.id]: e.target.value,
                      })
                    }
                    placeholder="Escreva ou fale sua resposta aqui (ou deixe em silêncio se preferir)..."
                    className="mt-3.5 w-full rounded-md bg-white border border-[#E5E1D8] px-4 py-3 text-sm text-[#1C1B18] placeholder:text-[#8A8578] focus:border-[#1B3B2F] transition-colors"
                  />
                </div>
              );
            })}
          </div>

          {error && (
            <div
              role="alert"
              className="mt-6 p-3.5 rounded-md bg-[#FDF2F2] border border-[#EBCACA] text-sm text-[#7F1D1D]"
            >
              {error}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => onStepChange(1)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#5E5B52] hover:text-[#1C1B18] transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar e editar
            </button>

            <button
              type="button"
              onClick={handleComposePrayer}
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-[#F9F8F4] bg-[#1B3B2F] rounded-md hover:bg-[#142D24] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Montando sua oração...
                </>
              ) : (
                <>
                  Montar oração genuína
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: COMPOSED PRAYER + MARGIN TEACHING NOTES */}
      {step === 3 && composedPrayer && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-12 items-start">
          {/* Main Reading Column */}
          <article className="bg-white border border-[#E5E1D8] rounded-md p-7 sm:p-11">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E5B52]">
              <span>Oração pessoal</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{formatPortugueseDate()}</span>
              {selectedTheme && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{selectedTheme.verseReference}</span>
                </>
              )}
              {usingOfflineMode && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Guia local offline</span>
                </>
              )}
            </div>

            <h1 className="mt-3 font-serif text-3xl sm:text-4xl font-medium text-[#1C1B18] leading-tight">
              {composedPrayer.title}
            </h1>

            <div className="mt-7 pt-7 border-t border-[#E5E1D8] space-y-5 max-w-prose">
              {composedPrayer.prayerParagraphs.map((paragraph, idx) => (
                <p
                  key={idx}
                  className={`font-serif text-[1.28rem] leading-[1.82] text-[#1C1B18] ${
                    idx === 0
                      ? "first-letter:text-5xl first-letter:font-serif first-letter:font-medium first-letter:float-left first-letter:mr-3 first-letter:leading-[0.9] first-letter:text-[#1B3B2F]"
                      : ""
                  }`}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Scripture Anchor Pull Quote */}
            <div className="mt-10 py-6 border-y border-[#E5E1D8]">
              <p className="text-xs uppercase tracking-[0.14em] text-[#5E5B52] mb-2">
                Palavra para ancorar esta oração
              </p>
              <p className="font-serif italic text-xl sm:text-2xl text-[#1C1B18] leading-relaxed">
                “{composedPrayer.anchorVerse.text}”
              </p>
              <p className="mt-2 text-sm font-medium text-[#1B3B2F]">
                {composedPrayer.anchorVerse.reference}
              </p>
              <p className="mt-2 text-sm text-[#5E5B52] leading-relaxed">
                {composedPrayer.anchorVerse.reflection}
              </p>
            </div>

            {/* Practical step of faith */}
            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.14em] text-[#5E5B52] mb-1.5">
                Passo de fé para hoje
              </p>
              <p className="text-sm sm:text-base text-[#1C1B18] leading-relaxed">
                {composedPrayer.faithStep}
              </p>
            </div>

            {/* Action bar */}
            <div className="mt-9 pt-7 border-t border-[#E5E1D8] flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onSendToTimer(composedPrayer)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#F9F8F4] bg-[#1B3B2F] rounded-md hover:bg-[#142D24] transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
              >
                <Clock className="w-4 h-4" />
                Orar com o cronômetro
              </button>

              <button
                type="button"
                onClick={() => onSavePrayer(composedPrayer)}
                disabled={isSavedCurrent}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
                  isSavedCurrent
                    ? "bg-[#EBF1EE] border-[#C8DBD2] text-[#1B3B2F]"
                    : "bg-white border-[#E5E1D8] text-[#1C1B18] hover:border-[#1B3B2F]"
                }`}
              >
                {isSavedCurrent ? (
                  <>
                    <BookmarkCheck className="w-4 h-4" />
                    Salva no caderno
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-4 h-4" />
                    Salvar no caderno
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyPrayer}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#5E5B52] hover:text-[#1C1B18] border border-[#E5E1D8] rounded-md transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#1B3B2F]" />
                    Copiada
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onResetAll}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm text-[#5E5B52] hover:text-[#1C1B18] transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4" />
                Começar outra
              </button>
            </div>
          </article>

          {/* Right Margin Rail: Teaching How to Pray */}
          <aside className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#5E5B52] mb-2">
                Aprendendo a orar
              </p>
              <h2 className="font-serif text-2xl font-medium text-[#1C1B18]">
                Como esta oração foi estruturada
              </h2>
              <p className="mt-2 text-sm text-[#5E5B52] leading-relaxed">
                Observe os movimentos usados acima para praticá-los livremente em suas
                próprias orações diárias:
              </p>
            </div>

            <div className="divide-y divide-[#E5E1D8] border-y border-[#E5E1D8]">
              {composedPrayer.structureNotes.map((note, idx) => (
                <div key={idx} className="py-4">
                  <p className="text-sm font-semibold text-[#1B3B2F]">
                    {note.stepLabel}
                  </p>
                  <p className="mt-1 text-sm text-[#5E5B52] leading-relaxed">
                    {note.lesson}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-4 bg-[#F2EFE8] rounded-md">
              <p className="text-xs font-medium text-[#1C1B18]">
                Dica de prática
              </p>
              <p className="mt-1.5 text-xs text-[#5E5B52] leading-relaxed">
                Leia cada parágrafo devagar, em voz baixa ou em silêncio, e sinta-se
                livre para pausar e acrescentar suas próprias palavras ao Pai.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
