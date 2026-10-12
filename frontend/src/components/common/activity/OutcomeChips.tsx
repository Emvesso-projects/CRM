import { Check } from "lucide-react";
import type { FollowUpOutcome } from "@/contracts/types";
import { cn } from "@/utils/cn";
import { OUTCOME_OPTIONS } from "./activityLabels";

interface OutcomeChipsProps {
  value: FollowUpOutcome | null;
  onChange: (value: FollowUpOutcome | null) => void;
  /** When not required, tapping the selected outcome clears it. */
  required?: boolean;
  disabled?: boolean;
}

const OutcomeChips = ({ value, onChange, required = false, disabled }: OutcomeChipsProps) => (
  <div role="radiogroup" aria-label="Outcome" className="flex flex-wrap gap-1.5">
    {OUTCOME_OPTIONS.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={selected}
          disabled={disabled}
          onClick={() => onChange(selected && !required ? null : option.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60",
            selected
              ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          {selected && <Check className="h-3 w-3" aria-hidden="true" />}
          {option.label}
        </button>
      );
    })}
  </div>
);

export default OutcomeChips;
