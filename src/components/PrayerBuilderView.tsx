import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | "done";

const TOTAL_STEPS = 8;

interface HeartStepConfig {
  step: 1 | 2 | 3 | 4 | 5;
  field: keyof HeartInput;
  shortLabel: string;
  headline: string;
  subtitle: string;
  placeholder: string;
  voicePrompt: string;
  suggestions: string[];
}

const HEART_STEPS: HeartStepConfig[] = [
  {
    step: 1,
    field: "feelings",
    shortLabel: "Sentimentos de hoje",
    headline: "Como está o seu coração agora?",
    subtitle:
      "Comece trazendo com simplicidade o que você tem sentido por dentro — paz, cansaço, gratidão, alegria ou inquietação.",
    placeholder: "Ex.: sinto gratidão pela minha família, mas também um cansaço acumulado desta semana...",
    voicePrompt: "Fale seus sentimentos de hoje...",
    suggestions: [
      "Cansaço e necessidade de descanso",
      "Inquietação diante de uma decisão",
      "Gratidão pelo cuidado de Deus",
    ],
  },
  {
    step: 2,
    field: "desires",
    shortLabel: "Desejos e sonhos",
    headline: "Quais são seus desejos, sonhos e pretensões?",
    subtitle:
      "Apresente diante de Deus aquilo que você sonha viver, construir ou alcançar, buscando alinhar seus planos à vontade dEle.",
    placeholder: "Ex.: desejo sabedoria no trabalho, novos projetos que abençoem minha casa e mais constância na fé...",
    voicePrompt: "Fale seus desejos e sonhos...",
    suggestions: [
      "Direção para um novo projeto",
      "Paz e unidade dentro da família",
      "Mais constância na vida de oração",
    ],
  },
  {
    step: 3,
    field: "fears",
    shortLabel: "Medos e temores",
    headline: "O que você teme ou tem tirado sua paz?",
    subtitle:
      "Nomeie sem reservas as incertezas, preocupações ou receios que você deseja depositar nas mãos do Pai.",
    placeholder: "Ex.: tenho medo de tomar uma escolha errada ou não dar conta das responsabilidades...",
    voicePrompt: "Fale o que você teme ou tem medo...",
    suggestions: [
      "Medo de escolher o caminho errado",
      "Incerteza sobre o futuro financeiro",
      "Preocupação com alguém que amo",
    ],
  },
  {
    step: 4,
    field: "courage",
    shortLabel: "Onde precisa de coragem",
    headline: "Onde você precisa de coragem hoje?",
    subtitle:
      "Conte qual atitude, conversa difícil ou passo de fé exige firmeza e confiança no Senhor neste momento.",
    placeholder: "Ex.: preciso de coragem para perdoar, iniciar uma conversa sincera ou dar um passo de obediência...",
    voicePrompt: "Fale onde você precisa de coragem...",
    suggestions: [
      "Coragem para perdoar e recomeçar",
      "Firmeza para dar um passo de fé",
      "Mansidão para uma conversa difícil",
    ],
  },
  {
    step: 5,
    field: "freeText",
    shortLabel: "Palavra livre ao Pai",
    headline: "Há mais algo que deseja dizer a Deus?",
    subtitle:
      "Se quiser, acrescente um pedido por alguém especial, um agradecimento ou qualquer detalhe livre (opcional).",
    placeholder: "Escreva ou fale livremente como conversaria com um amigo fiel...",
    voicePrompt: "Fale livremente o que está no seu coração...",
    suggestions: [
      "Interceder pela saúde da minha família",
      "Agradecer pelas misericórdias de hoje",
      "Pedir renovo espiritual nesta semana",
    ],
  },
];

interface PrayerBuilderViewProps {
  todayTheme: DailyBiblicalTheme;
  selectedTheme: DailyBiblicalTheme | null;
  onClearTheme: () => void;
  onSelectTodayTheme: () => void;
  heart: HeartInput;
  onHeartChange: (next: HeartInput) => void;
  wizardStep: WizardStep;
  onWizardStepChange: (step: WizardStep) => void;
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

export function PrayerBuilderView({
  todayTheme,
  selectedTheme,
  onClearTheme,
  onSelectTodayTheme,
  heart,
  onHeartChange,
  wizardStep,
  onWizardStepChange,
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

  const hasHeartContent = Boolean(
    heart.feelings.trim() ||
      heart.desires.trim() ||
      heart.fears.trim() ||
      heart.courage.trim() ||
      heart.freeText.trim()
  );

  const handleGenerateQuestions = async () => {
    if (!hasHeartContent) {
      setError(
        "Compartilhe ao menos um sentimento, desejo, medo ou palavra em um dos passos antes de continuar."
      );
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
        onWizardStepChange(6);
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
        onWizardStepChange(6);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível preparar as perguntas agora.");
      }
      setUsingOfflineMode(false);
      onQuestionsDataChange(data as QuestionsResponse);
      onAnswersChange({});
      onWizardStepChange(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleComposePrayer = async () => {
    if (speech.isListening) {
      speech.stop();
    }
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
        onWizardStepChange("done");
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
        onWizardStepChange("done");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível montar sua oração agora.");
      }
      setUsingOfflineMode(false);
      onComposedPrayerChange(data as ComposedPrayer);
      onWizardStepChange("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao montar a oração.");
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    setError(null);
    if (speech.isListening) {
      speech.stop();
    }
    if (wizardStep === 1) onWizardStepChange(2);
    else if (wizardStep === 2) onWizardStepChange(3);
    else if (wizardStep === 3) onWizardStepChange(4);
    else if (wizardStep === 4) onWizardStepChange(5);
    else if (wizardStep === 5) {
      void handleGenerateQuestions();
    } else if (wizardStep === 6) {
      if ((questionsData?.questions.length ?? 0) >= 2) {
        onWizardStepChange(7);
      } else {
        void handleComposePrayer();
      }
    } else if (wizardStep === 7) {
      if ((questionsData?.questions.length ?? 0) >= 3) {
        onWizardStepChange(8);
      } else {
        void handleComposePrayer();
      }
    } else if (wizardStep === 8) {
      void handleComposePrayer();
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (speech.isListening) {
      speech.stop();
    }
    if (typeof wizardStep === "number" && wizardStep > 1) {
      onWizardStepChange((wizardStep - 1) as WizardStep);
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

  const currentHeartStep =
    typeof wizardStep === "number" && wizardStep <= 5
      ? HEART_STEPS[wizardStep - 1]
      : null;

  const currentQuestionIndex =
    typeof wizardStep === "number" && wizardStep >= 6 ? wizardStep - 6 : -1;
  const currentQuestion =
    currentQuestionIndex >= 0 && questionsData
      ? questionsData.questions[currentQuestionIndex] ?? null
      : null;

  const numericStep = wizardStep === "done" ? TOTAL_STEPS : wizardStep;
  const progressRatio = numericStep / TOTAL_STEPS;

  const currentStepTitle = currentHeartStep
    ? currentHeartStep.shortLabel
    : currentQuestion
      ? `Reflexão · ${currentQuestion.focus}`
      : "Oração concluída";

  const activeVoiceKey = currentHeartStep
    ? currentHeartStep.field
    : currentQuestion
      ? `answer:${currentQuestion.id}`
      : "";
  const isCurrentListening =
    speech.isListening && speech.activeField === activeVoiceKey;

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 lg:py-12">
      {/* Subtle top context strip */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 text-xs text-[#525C6B]">
        <div className="flex items-center gap-2 font-light">
          <span className="font-bold text-[#0F3D34]">Guia de Oração</span>
          <span aria-hidden="true">·</span>
          <span className="capitalize">{formatPortugueseDate()}</span>
        </div>
        <p className="font-light text-[#7B8494]">
          Um auxílio para fortalecer sua oração, nunca para substituí-la
        </p>
      </div>

      {/* WIZARD STEPS 1 TO 8 */}
      {wizardStep !== "done" && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10 items-start">
          {/* Primary Modern Step Card */}
          <section
            aria-label={`Passo ${numericStep} de ${TOTAL_STEPS}`}
            className="bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col"
          >
            {selectedTheme && (
              <div className="px-6 sm:px-9 py-3.5 bg-[#F2F4F7] border-b border-[#E5E7EB] flex items-center justify-between gap-4">
                <div className="min-w-0 text-xs text-[#525C6B]">
                  <span className="font-bold text-[#0F3D34]">Tema bíblico:</span>{" "}
                  <span className="font-light">{selectedTheme.title}</span>{" "}
                  <span aria-hidden="true">·</span>{" "}
                  <span className="font-medium">{selectedTheme.verseReference}</span>
                </div>
                <button
                  type="button"
                  onClick={onClearTheme}
                  className="p-1 text-[#525C6B] hover:text-[#111827] rounded transition-colors shrink-0"
                  aria-label="Remover tema selecionado"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Animated Step Body */}
            <div className="p-6 sm:p-10 min-h-[390px] flex flex-col justify-between">
              <AnimatePresence mode="wait">
                <motion.div
                  key={String(wizardStep)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Step 1-5: Heart & Dreams Inputs */}
                  {currentHeartStep && (
                    <div>
                      <p className="text-xs font-bold tracking-wide text-[#0F3D34] mb-2">
                        Passo {currentHeartStep.step} · {currentHeartStep.shortLabel}
                      </p>

                      <h1 className="font-display-condensed text-4xl sm:text-[2.75rem] leading-[1.06] text-[#111827]">
                        {currentHeartStep.headline}
                      </h1>

                      <p className="mt-3 text-sm sm:text-base font-light text-[#525C6B] leading-relaxed max-w-2xl">
                        {currentHeartStep.subtitle}
                      </p>

                      {/* Voice button + label row */}
                      <div className="mt-7 flex items-center justify-between gap-3 mb-2">
                        <label
                          htmlFor={`step-input-${currentHeartStep.field}`}
                          className="text-xs font-bold text-[#111827]"
                        >
                          Sua resposta
                        </label>
                        {speech.isSupported && (
                          <button
                            type="button"
                            onClick={() =>
                              speech.toggleField(
                                currentHeartStep.field,
                                currentHeartStep.voicePrompt
                              )
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap min-h-[36px] ${
                              isCurrentListening
                                ? "bg-[#0F3D34] text-white font-bold"
                                : "bg-[#F2F4F7] text-[#111827] font-medium hover:bg-[#E5E7EB]"
                            }`}
                          >
                            {isCurrentListening ? (
                              <>
                                <MicOff className="w-3.5 h-3.5" />
                                Parar voz
                              </>
                            ) : (
                              <>
                                <Mic className="w-3.5 h-3.5 text-[#0F3D34]" />
                                Falar pelo microfone
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <textarea
                        id={`step-input-${currentHeartStep.field}`}
                        rows={5}
                        value={heart[currentHeartStep.field]}
                        onChange={(e) =>
                          onHeartChange({
                            ...heart,
                            [currentHeartStep.field]: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault();
                            handleNextStep();
                          }
                        }}
                        placeholder={currentHeartStep.placeholder}
                        className="w-full rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] px-4 py-3.5 text-base font-light text-[#111827] placeholder:text-[#7B8494] focus:bg-white focus:border-[#0F3D34] transition-colors resize-none leading-relaxed"
                      />

                      {/* Subtle unboxed inspiration links */}
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-light text-[#525C6B]">
                        <span className="font-medium text-[#7B8494]">Sugestões:</span>
                        {currentHeartStep.suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              const prev = heart[currentHeartStep.field].trim();
                              onHeartChange({
                                ...heart,
                                [currentHeartStep.field]: prev
                                  ? `${prev}. ${suggestion}`
                                  : suggestion,
                              });
                            }}
                            className="underline decoration-[#D1D5DB] underline-offset-4 hover:text-[#0F3D34] hover:decoration-[#0F3D34] transition-colors text-left"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 6-8: Personalized Reflective Questions */}
                  {currentQuestion && questionsData && (
                    <div>
                      {currentQuestionIndex === 0 && (
                        <p className="mb-5 pb-4 border-b border-[#E5E7EB] text-sm font-light italic text-[#525C6B] leading-relaxed">
                          “{questionsData.acknowledgment}”
                        </p>
                      )}

                      <p className="text-xs font-bold tracking-wide text-[#0F3D34] mb-2">
                        Reflexão {currentQuestionIndex + 1} de{" "}
                        {questionsData.questions.length} · {currentQuestion.focus}
                      </p>

                      <h1 className="font-display-condensed text-3xl sm:text-[2.5rem] leading-[1.08] text-[#111827]">
                        {currentQuestion.question}
                      </h1>

                      <p className="mt-2.5 text-sm font-light text-[#525C6B]">
                        {currentQuestion.hint}
                      </p>

                      <div className="mt-7 flex items-center justify-between gap-3 mb-2">
                        <label
                          htmlFor={`step-answer-${currentQuestion.id}`}
                          className="text-xs font-bold text-[#111827]"
                        >
                          Sua reflexão{" "}
                          <span className="font-light text-[#7B8494]">(opcional)</span>
                        </label>
                        {speech.isSupported && (
                          <button
                            type="button"
                            onClick={() =>
                              speech.toggleField(
                                `answer:${currentQuestion.id}`,
                                currentQuestion.question
                              )
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap min-h-[36px] ${
                              isCurrentListening
                                ? "bg-[#0F3D34] text-white font-bold"
                                : "bg-[#F2F4F7] text-[#111827] font-medium hover:bg-[#E5E7EB]"
                            }`}
                          >
                            {isCurrentListening ? (
                              <>
                                <MicOff className="w-3.5 h-3.5" />
                                Parar voz
                              </>
                            ) : (
                              <>
                                <Mic className="w-3.5 h-3.5 text-[#0F3D34]" />
                                Responder por voz
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <textarea
                        id={`step-answer-${currentQuestion.id}`}
                        rows={5}
                        value={answers[currentQuestion.id] ?? ""}
                        onChange={(e) =>
                          onAnswersChange({
                            ...answers,
                            [currentQuestion.id]: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault();
                            handleNextStep();
                          }
                        }}
                        placeholder="Escreva ou fale sua resposta com sinceridade (ou avance em silêncio se preferir)..."
                        className="w-full rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] px-4 py-3.5 text-base font-light text-[#111827] placeholder:text-[#7B8494] focus:bg-white focus:border-[#0F3D34] transition-colors resize-none leading-relaxed"
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Live Voice Status & Error Notices */}
              <div className="mt-5 space-y-3">
                {speech.isListening && (
                  <div className="p-3.5 rounded-xl bg-[#EAF3F0] border border-[#C6DFD7] text-sm text-[#0F3D34] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-xs">Ouvindo sua voz em português...</p>
                      {speech.interimText && (
                        <p className="mt-0.5 text-xs font-light truncate">
                          “{speech.interimText}”
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={speech.stop}
                      className="px-3 py-1.5 text-xs font-bold bg-[#0F3D34] text-white rounded-lg whitespace-nowrap shrink-0"
                    >
                      Concluir fala
                    </button>
                  </div>
                )}

                {speech.isTranscribing && (
                  <div className="p-3.5 rounded-xl bg-[#F2F4F7] border border-[#E5E7EB] text-xs font-medium text-[#111827] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#0F3D34]" />
                    <span>Transcrevendo o que você falou...</span>
                  </div>
                )}

                {speech.errorMessage && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] flex items-start justify-between gap-3"
                  >
                    <span className="font-light">{speech.errorMessage}</span>
                    <button
                      type="button"
                      onClick={speech.clearError}
                      aria-label="Fechar aviso"
                      className="p-0.5 text-[#991B1B] shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B]"
                  >
                    {error}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Progress Bar & Step Controls (1 de 8 ... 8 de 8) */}
            <div className="border-t border-[#E5E7EB] bg-[#FAFAFA]">
              <div className="h-1 w-full bg-[#E5E7EB] overflow-hidden">
                <div
                  className="h-full bg-[#0F3D34] origin-left transition-transform duration-300 ease-out"
                  style={{ transform: `scaleX(${progressRatio})` }}
                />
              </div>

              <div className="px-5 sm:px-9 py-4 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={loading || numericStep <= 1}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-[#525C6B] hover:text-[#111827] disabled:opacity-30 disabled:cursor-default transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </button>

                {/* Explicit Bottom Step Progress Counter: 1 de 8, 2 de 8 ... 8 de 8 */}
                <div className="text-center">
                  <p className="font-bold text-sm text-[#111827] tabular-nums whitespace-nowrap">
                    {numericStep} de {TOTAL_STEPS}
                  </p>
                  <p className="hidden sm:block text-[11px] font-light text-[#525C6B] truncate max-w-[200px]">
                    {currentStepTitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#0F3D34] rounded-lg hover:bg-[#0A2C25] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {wizardStep === 5 ? "Preparando..." : "Montando..."}
                    </>
                  ) : wizardStep === 8 ? (
                    <>
                      Montar oração
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Próximo passo
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Right Rail: Journey Overview & Today's Verse */}
          <aside className="space-y-8">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6">
              <p className="text-xs font-bold text-[#0F3D34] mb-1">
                Caminho da Oração
              </p>
              <h2 className="font-display-condensed text-2xl text-[#111827] mb-4">
                Etapas preenchidas
              </h2>

              <ol className="space-y-2.5">
                {HEART_STEPS.map((item) => {
                  const filled = heart[item.field].trim().length > 0;
                  const isCurrent = wizardStep === item.step;
                  return (
                    <li key={item.step}>
                      <button
                        type="button"
                        onClick={() => onWizardStepChange(item.step)}
                        className={`w-full text-left flex items-center justify-between gap-2 py-1.5 text-xs transition-colors ${
                          isCurrent
                            ? "text-[#0F3D34] font-bold"
                            : "text-[#525C6B] font-light hover:text-[#111827]"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <span className="font-mono tabular-nums text-[11px] text-[#7B8494]">
                            0{item.step}
                          </span>
                          <span className="truncate">{item.shortLabel}</span>
                        </span>
                        {filled && (
                          <Check className="w-3.5 h-3.5 text-[#0F3D34] shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}

                {[6, 7, 8].map((qStep, idx) => {
                  const qObj = questionsData?.questions[idx];
                  const unlocked = Boolean(qObj);
                  const filled = Boolean(qObj && (answers[qObj.id] ?? "").trim());
                  const isCurrent = wizardStep === qStep;
                  return (
                    <li key={qStep}>
                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => unlocked && onWizardStepChange(qStep as WizardStep)}
                        className={`w-full text-left flex items-center justify-between gap-2 py-1.5 text-xs transition-colors ${
                          isCurrent
                            ? "text-[#0F3D34] font-bold"
                            : unlocked
                              ? "text-[#525C6B] font-light hover:text-[#111827]"
                              : "text-[#9CA3AF] font-light cursor-default"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <span className="font-mono tabular-nums text-[11px] text-[#7B8494]">
                            0{qStep}
                          </span>
                          <span className="truncate">
                            {qObj ? `Reflexão: ${qObj.focus}` : `Pergunta reflexiva ${idx + 1}`}
                          </span>
                        </span>
                        {filled && (
                          <Check className="w-3.5 h-3.5 text-[#0F3D34] shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="px-1">
              <p className="text-xs font-bold text-[#0F3D34] mb-1.5">
                Sugestão de hoje · {todayTheme.verseReference}
              </p>
              <h3 className="font-display-condensed text-2xl text-[#111827] leading-snug">
                {todayTheme.title}
              </h3>
              <blockquote className="mt-3 py-3.5 border-y border-[#E5E7EB]">
                <p className="text-sm font-light italic text-[#111827] leading-relaxed">
                  “{todayTheme.verseText}”
                </p>
              </blockquote>
              <button
                type="button"
                onClick={onSelectTodayTheme}
                className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-bold text-[#0F3D34] hover:underline underline-offset-4 whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Usar este tema na oração
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* FINAL STEP: COMPOSED PRAYER + MARGIN TEACHING NOTES */}
      {wizardStep === "done" && composedPrayer && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10 items-start">
          <article className="bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="p-7 sm:p-11">
              <div className="flex flex-wrap items-center gap-2 text-xs font-light text-[#525C6B]">
                <span className="font-bold text-[#0F3D34]">Oração pessoal</span>
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

              <h1 className="mt-3 font-display-condensed text-4xl sm:text-5xl text-[#111827] leading-[1.06]">
                {composedPrayer.title}
              </h1>

              {/* Organized Faithful Summary of Everything the User Shared */}
              {composedPrayer.organizedSummary &&
                composedPrayer.organizedSummary.length > 0 && (
                  <div className="mt-6 p-5 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB]">
                    <p className="text-xs font-bold text-[#0F3D34] mb-3">
                      Resumo organizado do que você trouxe
                    </p>
                    <dl className="space-y-2.5">
                      {composedPrayer.organizedSummary.map((item, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)] gap-1 sm:gap-4 text-xs sm:text-sm"
                        >
                          <dt className="font-bold text-[#111827]">{item.label}</dt>
                          <dd className="font-light text-[#525C6B] leading-relaxed">
                            {item.summary}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

              <div className="mt-7 pt-7 border-t border-[#E5E7EB] space-y-5 max-w-prose">
                {composedPrayer.prayerParagraphs.map((paragraph, idx) => (
                  <p
                    key={idx}
                    className="text-base sm:text-[1.1rem] font-light leading-[1.88] text-[#111827]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Scripture Anchor Pull Quote */}
              <div className="mt-9 py-6 border-y border-[#E5E7EB]">
                <p className="text-xs font-bold text-[#0F3D34] mb-2">
                  Palavra para ancorar esta oração
                </p>
                <p className="text-lg sm:text-xl font-light italic text-[#111827] leading-relaxed">
                  “{composedPrayer.anchorVerse.text}”
                </p>
                <p className="mt-2.5 text-xs font-bold text-[#0F3D34]">
                  {composedPrayer.anchorVerse.reference}
                </p>
                <p className="mt-2 text-sm font-light text-[#525C6B] leading-relaxed">
                  {composedPrayer.anchorVerse.reflection}
                </p>
              </div>

              {/* Practical step of faith */}
              <div className="mt-6">
                <p className="text-xs font-bold text-[#0F3D34] mb-1.5">
                  Passo de fé para hoje
                </p>
                <p className="text-sm sm:text-base font-light text-[#111827] leading-relaxed">
                  {composedPrayer.faithStep}
                </p>
              </div>

              {/* Action bar */}
              <div className="mt-8 pt-7 border-t border-[#E5E7EB] flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onSendToTimer(composedPrayer)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#0F3D34] rounded-lg hover:bg-[#0A2C25] transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
                >
                  <Clock className="w-4 h-4" />
                  Orar com o cronômetro
                </button>

                <button
                  type="button"
                  onClick={() => onSavePrayer(composedPrayer)}
                  disabled={isSavedCurrent}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg border transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
                    isSavedCurrent
                      ? "bg-[#EAF3F0] border-[#C6DFD7] text-[#0F3D34]"
                      : "bg-white border-[#E5E7EB] text-[#111827] hover:border-[#0F3D34]"
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#525C6B] hover:text-[#111827] border border-[#E5E7EB] rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-[#0F3D34]" />
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
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-light text-[#525C6B] hover:text-[#111827] transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
                >
                  <RotateCcw className="w-4 h-4" />
                  Começar outra
                </button>
              </div>
            </div>

            {/* Completed Bottom Progress Footer */}
            <div className="border-t border-[#E5E7EB] bg-[#FAFAFA]">
              <div className="h-1 w-full bg-[#0F3D34]" />
              <div className="px-7 sm:px-11 py-3.5 flex items-center justify-between text-xs text-[#525C6B]">
                <button
                  type="button"
                  onClick={() => onWizardStepChange(8)}
                  className="inline-flex items-center gap-1.5 font-medium hover:text-[#111827]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Revisar respostas
                </button>
                <span className="font-bold text-[#0F3D34] tabular-nums">
                  {TOTAL_STEPS} de {TOTAL_STEPS} · Concluído
                </span>
              </div>
            </div>
          </article>

          {/* Right Margin Rail: Teaching How to Pray */}
          <aside className="space-y-6">
            <div>
              <p className="text-xs font-bold text-[#0F3D34] mb-1.5">
                Aprendendo a orar
              </p>
              <h2 className="font-display-condensed text-3xl text-[#111827]">
                Como esta oração foi estruturada
              </h2>
              <p className="mt-2 text-sm font-light text-[#525C6B] leading-relaxed">
                Observe os movimentos usados acima para praticá-los livremente em suas
                próprias orações diárias:
              </p>
            </div>

            <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
              {composedPrayer.structureNotes.map((note, idx) => (
                <div key={idx} className="py-4">
                  <p className="text-sm font-bold text-[#0F3D34]">{note.stepLabel}</p>
                  <p className="mt-1 text-sm font-light text-[#525C6B] leading-relaxed">
                    {note.lesson}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-4 bg-[#F2F4F7] rounded-xl">
              <p className="text-xs font-bold text-[#111827]">Dica de prática</p>
              <p className="mt-1.5 text-xs font-light text-[#525C6B] leading-relaxed">
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
