import { useState } from "react";
import { ArrowRight, Clock, Loader2, Search } from "lucide-react";
import { DAILY_THEMES, formatPortugueseDate } from "../data/dailyThemes";
import type { DailyBiblicalTheme, ThemeCategory } from "../types/prayer";
import { apiUrl, isStandaloneOfflineOrigin } from "../utils/appUpdate";
import { suggestOfflineTheme } from "../utils/offlinePrayerGuide";

interface DailyThemesViewProps {
  todayTheme: DailyBiblicalTheme;
  onPrayWithTheme: (theme: DailyBiblicalTheme) => void;
  onFocusWithTheme: (theme: DailyBiblicalTheme) => void;
}

const CATEGORIES: ("Todos" | ThemeCategory)[] = [
  "Todos",
  "Paz e Medo",
  "Direção e Coragem",
  "Gratidão",
  "Família e Perdão",
  "Propósito",
];

export function DailyThemesView({
  todayTheme,
  onPrayWithTheme,
  onFocusWithTheme,
}: DailyThemesViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<"Todos" | ThemeCategory>("Todos");
  const [customTopic, setCustomTopic] = useState("");
  const [customTheme, setCustomTheme] = useState<DailyBiblicalTheme | null>(null);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredThemes = DAILY_THEMES.filter((item) => {
    if (item.id === todayTheme.id && selectedCategory === "Todos") return false;
    if (selectedCategory === "Todos") return true;
    return item.category === selectedCategory;
  });

  const handleSuggestCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customTopic.trim();
    if (cleaned.length < 2) return;

    setLoadingCustom(true);
    setCustomError(null);
    try {
      if (isStandaloneOfflineOrigin()) {
        setCustomTheme(suggestOfflineTheme(cleaned));
        return;
      }

      const res = await fetch(apiUrl("/api/themes/suggest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: cleaned }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        setCustomTheme(suggestOfflineTheme(cleaned));
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível gerar sugestão bíblica agora.");
      }
      setCustomTheme({
        id: `custom-${Date.now()}`,
        title: data.title,
        category: data.category as ThemeCategory,
        suggestedMinutes: Number(data.suggestedMinutes) || 10,
        verseReference: data.verseReference,
        verseText: data.verseText,
        meditation: data.meditation,
        prayerDirections: Array.isArray(data.prayerDirections) ? data.prayerDirections : [],
      });
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : "Erro ao buscar sugestão.");
    } finally {
      setLoadingCustom(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 lg:py-14 space-y-14">
      {/* Tier 1: Lead Story — Suggested Daily Theme */}
      <section aria-labelledby="daily-lead-heading" className="pb-12 border-b border-[#E5E1D8]">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E5B52] mb-4">
          <span className="capitalize">{formatPortugueseDate()}</span>
          <span aria-hidden="true">·</span>
          <span>Tema sugerido para hoje</span>
          <span aria-hidden="true">·</span>
          <span>{todayTheme.category}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{todayTheme.suggestedMinutes} min</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-10 lg:gap-14 items-start">
          <div>
            <h1
              id="daily-lead-heading"
              className="font-serif text-4xl sm:text-5xl font-medium text-[#1C1B18] leading-[1.12]"
            >
              {todayTheme.title}
            </h1>

            <blockquote className="mt-7 py-6 border-y border-[#E5E1D8]">
              <p className="font-serif italic text-2xl sm:text-[1.7rem] text-[#1C1B18] leading-relaxed">
                “{todayTheme.verseText}”
              </p>
              <footer className="mt-3 text-sm font-medium text-[#1B3B2F]">
                {todayTheme.verseReference}
              </footer>
            </blockquote>

            <p className="mt-6 text-base text-[#5E5B52] leading-relaxed max-w-prose">
              {todayTheme.meditation}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onPrayWithTheme(todayTheme)}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-[#F9F8F4] bg-[#1B3B2F] rounded-md hover:bg-[#142D24] transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
              >
                Construir oração com este tema
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onFocusWithTheme(todayTheme)}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-[#1C1B18] bg-white border border-[#E5E1D8] rounded-md hover:border-[#1B3B2F] transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
              >
                <Clock className="w-4 h-4 text-[#1B3B2F]" />
                Orar no cronômetro ({todayTheme.suggestedMinutes} min)
              </button>
            </div>
          </div>

          {/* 3-step prayer guide for today's theme */}
          <div className="bg-[#F2EFE8] rounded-md p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.14em] text-[#5E5B52] mb-2">
              Direcionamento de Oração
            </p>
            <h2 className="font-serif text-2xl font-medium text-[#1C1B18] mb-5">
              Três passos para orar hoje
            </h2>

            <ol className="space-y-5 divide-y divide-[#E5E1D8]">
              {todayTheme.prayerDirections.map((dir, index) => (
                <li key={dir.label} className={index > 0 ? "pt-5" : ""}>
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-xs tabular-nums text-[#1B3B2F]">
                      0{index + 1}
                    </span>
                    <span className="text-sm font-semibold text-[#1C1B18]">
                      {dir.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-[#5E5B52] leading-relaxed pl-6">
                    {dir.prompt}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Bespoke Theme Search */}
      <section aria-labelledby="custom-theme-heading" className="pb-12 border-b border-[#E5E1D8]">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-xl">
            <h2
              id="custom-theme-heading"
              className="font-serif text-2xl sm:text-3xl font-medium text-[#1C1B18]"
            >
              Precisa de direção bíblica para um momento específico?
            </h2>
            <p className="mt-2 text-sm text-[#5E5B52]">
              Digite uma situação (ex.: luto, entrevista de emprego, paz no casamento,
              insônia) para receber um versículo e um roteiro de oração.
            </p>
          </div>

          <form
            onSubmit={handleSuggestCustom}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto lg:min-w-[440px]"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#8A8578] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Ex.: discernimento profissional..."
                aria-label="Tema ou situação para buscar direção bíblica"
                className="w-full rounded-md bg-white border border-[#E5E1D8] pl-10 pr-4 py-2.5 text-sm text-[#1C1B18] placeholder:text-[#8A8578] focus:border-[#1B3B2F] min-h-[44px]"
              />
            </div>
            <button
              type="submit"
              disabled={loadingCustom || customTopic.trim().length < 2}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-[#F9F8F4] bg-[#1B3B2F] rounded-md hover:bg-[#142D24] disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
            >
              {loadingCustom ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                "Gerar roteiro"
              )}
            </button>
          </form>
        </div>

        {customError && (
          <div
            role="alert"
            className="mt-4 p-3.5 rounded-md bg-[#FDF2F2] border border-[#EBCACA] text-sm text-[#7F1D1D]"
          >
            {customError}
          </div>
        )}

        {customTheme && (
          <div className="mt-7 p-6 sm:p-8 bg-white border border-[#E5E1D8] rounded-md">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E5B52]">
              <span>Roteiro personalizado</span>
              <span aria-hidden="true">·</span>
              <span>{customTheme.verseReference}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {customTheme.suggestedMinutes} min
              </span>
            </div>
            <h3 className="mt-2 font-serif text-3xl font-medium text-[#1C1B18]">
              {customTheme.title}
            </h3>
            <p className="mt-4 font-serif italic text-xl text-[#1C1B18] leading-relaxed">
              “{customTheme.verseText}”
            </p>
            <p className="mt-3 text-sm text-[#5E5B52] leading-relaxed max-w-prose">
              {customTheme.meditation}
            </p>
            {customTheme.prayerDirections.length > 0 && (
              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 pt-5 border-t border-[#E5E1D8]">
                {customTheme.prayerDirections.map((d, idx) => (
                  <div key={idx}>
                    <p className="text-xs font-semibold text-[#1B3B2F]">
                      0{idx + 1}. {d.label}
                    </p>
                    <p className="mt-1 text-sm text-[#5E5B52] leading-relaxed">
                      {d.prompt}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onPrayWithTheme(customTheme)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#F9F8F4] bg-[#1B3B2F] rounded-md hover:bg-[#142D24] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
              >
                Construir oração com este tema
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onFocusWithTheme(customTheme)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#1C1B18] bg-[#F2EFE8] rounded-md hover:bg-[#E5E1D8] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <Clock className="w-4 h-4 text-[#1B3B2F]" />
                Levar ao cronômetro
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Tier 2: Curated Library of Biblical Themes */}
      <section aria-labelledby="library-heading">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2
              id="library-heading"
              className="font-serif text-3xl font-medium text-[#1C1B18]"
            >
              Biblioteca de Temas Bíblicos
            </h2>
            <p className="mt-1 text-sm text-[#5E5B52]">
              Escolha um tema conforme o momento que você está atravessando.
            </p>
          </div>

          {/* Interactive Filter Controls */}
          <div
            role="tablist"
            aria-label="Filtrar temas por categoria"
            className="flex items-center gap-1 p-1 bg-[#F2EFE8] rounded-md overflow-x-auto"
          >
            {CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                    active
                      ? "bg-white text-[#1B3B2F] shadow-xs"
                      : "text-[#5E5B52] hover:text-[#1C1B18]"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredThemes.map((theme) => {
            const isExpanded = expandedId === theme.id;
            return (
              <article
                key={theme.id}
                className="bg-white border border-[#E5E1D8] rounded-md p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#5E5B52]">
                    <span>{theme.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{theme.verseReference}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {theme.suggestedMinutes} min
                    </span>
                  </div>

                  <h3 className="mt-2 font-serif text-2xl font-medium text-[#1C1B18] leading-snug">
                    {theme.title}
                  </h3>

                  <p className="mt-3 font-serif italic text-base text-[#1C1B18] leading-relaxed">
                    “{theme.verseText}”
                  </p>

                  <p className="mt-3 text-sm text-[#5E5B52] leading-relaxed">
                    {theme.meditation}
                  </p>

                  {isExpanded && (
                    <ol className="mt-4 pt-4 border-t border-[#E5E1D8] space-y-2.5">
                      {theme.prayerDirections.map((d, idx) => (
                        <li key={d.label} className="text-sm text-[#5E5B52]">
                          <span className="font-semibold text-[#1B3B2F]">
                            0{idx + 1}. {d.label}:{" "}
                          </span>
                          {d.prompt}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-[#E5E1D8] flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : theme.id)}
                    className="text-xs font-medium text-[#5E5B52] hover:text-[#1C1B18] whitespace-nowrap"
                  >
                    {isExpanded ? "Ocultar roteiro" : "Ver 3 passos de oração"}
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onFocusWithTheme(theme)}
                      className="text-xs font-medium text-[#5E5B52] hover:text-[#1B3B2F] transition-colors whitespace-nowrap"
                    >
                      Cronômetro
                    </button>
                    <span aria-hidden="true" className="text-[#D6CEBE]">
                      ·
                    </span>
                    <button
                      type="button"
                      onClick={() => onPrayWithTheme(theme)}
                      className="text-xs font-semibold text-[#1B3B2F] hover:underline underline-offset-4 whitespace-nowrap"
                    >
                      Orar com este tema
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
