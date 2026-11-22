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
    <header className="sticky top-0 z-30 bg-[#F9F8F4]/95 backdrop-blur-sm border-b border-[#E5E1D8]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectView("builder")}
          className="font-serif text-2xl font-semibold tracking-tight text-[#1C1B18] whitespace-nowrap shrink-0 hover:text-[#1B3B2F] transition-colors"
        >
          Oratório
        </button>

        {/* Zone 2: Four concise single-line text navigation links */}
        <nav
          aria-label="Navegação principal"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5E5B52]"
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
                    ? "text-[#1B3B2F] font-semibold"
                    : "text-[#5E5B52] hover:text-[#1C1B18]"
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[21px] h-[2px] bg-[#1B3B2F]"
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
            className="px-4 py-2 text-sm font-medium text-[#F9F8F4] bg-[#1B3B2F] rounded-md hover:bg-[#142D24] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            Nova Oração
          </button>
        </div>
      </div>

      {/* Compact single-row mobile navigation */}
      <nav
        aria-label="Navegação móvel"
        className="md:hidden border-t border-[#E5E1D8] px-3 py-1.5 flex items-center justify-between gap-1 overflow-x-auto"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`px-2 py-1.5 text-[11px] font-medium rounded whitespace-nowrap shrink-0 min-h-[36px] transition-colors ${
                isActive
                  ? "bg-[#EBF1EE] text-[#1B3B2F]"
                  : "text-[#5E5B52] hover:text-[#1C1B18]"
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
