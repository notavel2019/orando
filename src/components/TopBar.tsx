import type { AppView } from "../types/prayer";

interface TopBarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  onStartFreshPrayer: () => void;
}

const NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: "builder", label: "Construir Oração" },
  { id: "daily", label: "Palavra do Dia" },
  { id: "timer", label: "Cronômetro" },
  { id: "journal", label: "Caderno" },
  { id: "update", label: "Atualizar" },
];

export function TopBar({ activeView, onSelectView, onStartFreshPrayer }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#FAFAFA]/90 backdrop-blur-md border-b border-[#E5E7EB]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Bold Condensed brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectView("builder")}
          className="font-display-condensed text-[1.75rem] leading-none tracking-tight text-[#111827] whitespace-nowrap shrink-0 hover:text-[#0F3D34] transition-colors"
        >
          ORATÓRIO
        </button>

        {/* Zone 2: Five concise single-line text navigation links */}
        <nav
          aria-label="Navegação principal"
          className="hidden md:flex items-center gap-7 text-sm"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? "text-[#0F3D34] font-bold"
                    : "text-[#525C6B] font-light hover:text-[#111827]"
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[21px] h-[2px] bg-[#0F3D34]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onStartFreshPrayer}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#0F3D34] rounded-lg hover:bg-[#0A2C25] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            Nova Oração
          </button>
        </div>
      </div>

      {/* Compact single-row mobile navigation */}
      <nav
        aria-label="Navegação móvel"
        className="md:hidden border-t border-[#E5E7EB] px-3 py-1.5 flex items-center justify-between gap-1 overflow-x-auto bg-white/80"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`px-2.5 py-1.5 text-[11px] rounded-md whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                isActive
                  ? "bg-[#EAF3F0] text-[#0F3D34] font-bold"
                  : "text-[#525C6B] font-light hover:text-[#111827]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
