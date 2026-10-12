import { cn } from "@/utils/cn";

interface ChoiceCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  disabled?: boolean;
}

/** One option of a radio group, with a short explanation under it. */
const ChoiceCard = ({ selected, onSelect, title, description, disabled }: ChoiceCardProps) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    disabled={disabled}
    onClick={onSelect}
    className={cn(
      "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
      selected
        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
        : "border-border bg-card hover:border-primary/40",
    )}
  >
    <span
      className={cn(
        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
        selected ? "border-primary" : "border-muted-foreground/40",
      )}
      aria-hidden="true"
    >
      {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-foreground">{title}</span>
      {description && <span className="block text-xs text-muted-foreground">{description}</span>}
    </span>
  </button>
);

export default ChoiceCard;
