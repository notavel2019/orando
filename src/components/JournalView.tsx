import { useMemo, useState } from "react";
import { Check, Clock, Trash2 } from "lucide-react";
import type {
  ComposedPrayer,
  FocusSessionRecord,
  SavedPrayerEntry,
} from "../types/prayer";
import { calculateStreakDays } from "../utils/storage";

interface JournalViewProps {
  prayers: SavedPrayerEntry[];
  sessions: FocusSessionRecord[];
  onToggleAnswered: (id: string) => void;
  onUpdateTestimony: (id: string, note: string) => void;
  onDeletePrayer: (id: string) => void;
  onSendToTimer: (prayer: ComposedPrayer) => void;
  onGoToBuilder: () => void;
}

type JournalFilter = "all" | "active" | "answered";

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function JournalView({
  prayers,
  sessions,
  onToggleAnswered,
  onUpdateTestimony,
  onDeletePrayer,
  onSendToTimer,
  onGoToBuilder,
}: JournalViewProps) {
  const [filter, setFilter] = useState<JournalFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(prayers[0]?.id ?? null);
  const [draftNote, setDraftNote] = useState<string>("");
  const [savedFeedback, setSavedFeedback] = useState(false);

  const filteredPrayers = useMemo(() => {
    return prayers.filter((p) => {
      if (filter === "answered") return p.answered;
      if (filter === "active") return !p.answered;
      return true;
    });
  }, [prayers, filter]);

  const activeEntry =
    filteredPrayers.find((p) => p.id === selectedId) ?? filteredPrayers[0] ?? null;

  const totalMinutes = useMemo(
    () => sessions.reduce((acc, s) => acc + s.durationMinutes, 0),
    [sessions]
  );

  const answeredCount = useMemo(
    () => prayers.filter((p) => p.answered).length,
    [prayers]
  );

  const streakDays = useMemo(
    () => calculateStreakDays(prayers, sessions),
    [prayers, sessions]
  );

  const handleSelectEntry = (entry: SavedPrayerEntry) => {
    setSelectedId(entry.id);
    setDraftNote(entry.testimonyNote);
    setSavedFeedback(false);
  };

  const currentNoteValue =
    activeEntry && selectedId === activeEntry.id
      ? draftNote
      : activeEntry?.testimonyNote ?? "";

  const handleSaveNote = () => {
    if (!activeEntry) return;
    onUpdateTestimony(activeEntry.id, currentNoteValue);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1800);
  };

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 lg:py-12">
      <div className="pb-8 border-b border-[#E5E7EB]">
        <p className="text-xs font-bold text-[#0F3D34] mb-1.5">
          Memória de Fidelidade
        </p>
        <h1 className="font-display-condensed text-4xl sm:text-5xl text-[#111827] leading-none">
          Caderno de Orações
        </h1>

        {/* Clean summary strip with tabular numerals */}
        <dl className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-[#E5E7EB]">
          <div>
            <dt className="text-xs font-light text-[#525C6B]">Orações salvas</dt>
            <dd className="mt-1 font-display-condensed text-3xl text-[#111827] tabular-nums">
              {prayers.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-light text-[#525C6B]">Respondidas</dt>
            <dd className="mt-1 font-display-condensed text-3xl text-[#0F3D34] tabular-nums">
              {answeredCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-light text-[#525C6B]">Minutos em foco</dt>
            <dd className="mt-1 font-display-condensed text-3xl text-[#111827] tabular-nums">
              {totalMinutes}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-light text-[#525C6B]">Dias seguidos</dt>
            <dd className="mt-1 font-display-condensed text-3xl text-[#111827] tabular-nums">
              {streakDays}
            </dd>
          </div>
        </dl>
      </div>

      {prayers.length === 0 ? (
        <div className="py-16 text-center max-w-md mx-auto">
          <h2 className="font-display-condensed text-3xl text-[#111827]">
            Seu caderno ainda está em branco
          </h2>
          <p className="mt-2 text-sm font-light text-[#525C6B] leading-relaxed">
            Quando você construir uma oração e salvá-la, ela ficará registrada aqui
            para que você possa revisitar e celebrar a fidelidade de Deus ao longo do tempo.
          </p>
          <button
            type="button"
            onClick={onGoToBuilder}
            className="mt-6 px-5 py-2.5 text-sm font-bold text-white bg-[#0F3D34] rounded-lg hover:bg-[#0A2C25] transition-colors whitespace-nowrap min-h-[44px]"
          >
            Construir primeira oração
          </button>
        </div>
      ) : (
        <div className="mt-8">
          {/* Interactive Filter Controls */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div
              role="tablist"
              aria-label="Filtrar orações salvas"
              className="flex items-center gap-1 p-1 bg-[#F2F4F7] rounded-xl"
            >
              {(
                [
                  { id: "all", label: "Todas" },
                  { id: "active", label: "Em oração" },
                  { id: "answered", label: "Respondidas" },
                ] as const
              ).map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => setFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                      active
                        ? "bg-white text-[#0F3D34] font-bold shadow-xs"
                        : "text-[#525C6B] font-light hover:text-[#111827]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredPrayers.length === 0 ? (
            <p className="py-12 text-sm font-light text-[#525C6B]">
              Nenhuma oração encontrada nesta categoria.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-8 items-start">
              {/* Left list */}
              <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
                {filteredPrayers.map((entry) => {
                  const isSelected = activeEntry?.id === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleSelectEntry(entry)}
                      className={`w-full text-left px-4 py-4 transition-colors ${
                        isSelected ? "bg-[#F2F4F7]" : "hover:bg-[#F2F4F7]/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-light text-[#525C6B]">
                        <span className="font-mono tabular-nums">
                          {formatShortDate(entry.createdAt)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={entry.answered ? "font-bold text-[#0F3D34]" : ""}>
                          {entry.answered ? "Respondida" : "Em oração"}
                        </span>
                      </div>
                      <p className="mt-1 font-display-condensed text-2xl text-[#111827] leading-snug">
                        {entry.title}
                      </p>
                      <p className="mt-1 text-xs font-light text-[#7B8494] truncate">
                        {entry.anchorVerse.reference}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Right detailed entry */}
              {activeEntry && (
                <article className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-9 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E5E7EB]">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-light text-[#525C6B]">
                        <span className="font-mono tabular-nums">
                          {formatShortDate(activeEntry.createdAt)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{activeEntry.anchorVerse.reference}</span>
                        <span aria-hidden="true">·</span>
                        <span className={activeEntry.answered ? "text-[#0F3D34] font-bold" : ""}>
                          {activeEntry.answered ? "Oração respondida" : "Em oração"}
                        </span>
                      </div>
                      <h2 className="mt-2 font-display-condensed text-3xl sm:text-4xl text-[#111827]">
                        {activeEntry.title}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleAnswered(activeEntry.id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
                        activeEntry.answered
                          ? "bg-[#EAF3F0] border-[#0F3D34] text-[#0F3D34]"
                          : "bg-white border-[#E5E7EB] text-[#111827] hover:border-[#0F3D34]"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {activeEntry.answered
                        ? "Marcada como respondida"
                        : "Marcar como respondida"}
                    </button>
                  </div>

                  {/* Organized Summary of what was shared */}
                  {activeEntry.organizedSummary && activeEntry.organizedSummary.length > 0 && (
                    <div className="mt-6 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] p-4 sm:p-5">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#0F3D34] mb-3">
                        Resumo organizado do que você trouxe
                      </h3>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                        {activeEntry.organizedSummary.map((item, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <dt className="text-xs font-bold text-[#111827]">
                              {item.label}
                            </dt>
                            <dd className="text-xs font-light leading-relaxed text-[#525C6B]">
                              {item.summary}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {/* Prayer Body */}
                  <div className="mt-6 space-y-4 max-w-prose">
                    {activeEntry.prayerParagraphs.map((para, idx) => (
                      <p
                        key={idx}
                        className="text-base font-light leading-[1.85] text-[#111827]"
                      >
                        {para}
                      </p>
                    ))}
                  </div>

                  {/* Anchor Verse */}
                  <blockquote className="mt-7 py-4 border-y border-[#E5E7EB]">
                    <p className="text-base font-light italic text-[#111827]">
                      “{activeEntry.anchorVerse.text}”
                    </p>
                    <footer className="mt-1.5 text-xs font-bold text-[#0F3D34]">
                      {activeEntry.anchorVerse.reference}
                    </footer>
                  </blockquote>

                  {/* Testimony / Gratitude Note */}
                  <div className="mt-6">
                    <label
                      htmlFor="testimony-note"
                      className="block text-xs font-bold text-[#111827] mb-2"
                    >
                      Nota de gratidão ou testemunho
                    </label>
                    <textarea
                      id="testimony-note"
                      rows={3}
                      value={currentNoteValue}
                      onFocus={() => {
                        if (selectedId !== activeEntry.id) {
                          setSelectedId(activeEntry.id);
                          setDraftNote(activeEntry.testimonyNote);
                        }
                      }}
                      onChange={(e) => {
                        setSelectedId(activeEntry.id);
                        setDraftNote(e.target.value);
                      }}
                      placeholder="Registre aqui como Deus trouxe paz, resposta ou aprendizado sobre esta oração..."
                      className="w-full rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-light text-[#111827] placeholder:text-[#7B8494] focus:bg-white focus:border-[#0F3D34]"
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleSaveNote}
                        className="px-4 py-2 text-xs font-bold text-white bg-[#0F3D34] rounded-lg hover:bg-[#0A2C25] transition-colors whitespace-nowrap min-h-[38px]"
                      >
                        {savedFeedback ? "Anotação salva" : "Salvar anotação"}
                      </button>

                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() =>
                            onSendToTimer({
                              title: activeEntry.title,
                              organizedSummary: activeEntry.organizedSummary,
                              prayerParagraphs: activeEntry.prayerParagraphs,
                              structureNotes: activeEntry.structureNotes,
                              anchorVerse: activeEntry.anchorVerse,
                              faithStep: activeEntry.faithStep,
                            })
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F3D34] hover:underline underline-offset-4 whitespace-nowrap"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Orar novamente no cronômetro
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeletePrayer(activeEntry.id)}
                          className="inline-flex items-center gap-1 text-xs font-light text-[#7B8494] hover:text-[#991B1B] transition-colors whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
