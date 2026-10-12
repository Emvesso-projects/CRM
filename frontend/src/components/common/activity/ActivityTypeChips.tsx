import { cn } from "@/utils/cn";
import ActivityTypeIcon from "./ActivityTypeIcon";
import { activityTypeLabel } from "./activityLabels";

interface ActivityTypeChipsProps<T extends string> {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/** "What happened?" as one-tap choices. */
const ActivityTypeChips = <T extends string>({
  value,
  options,
  onChange,
  disabled,
}: ActivityTypeChipsProps<T>) => (
  <div role="radiogroup" aria-label="What happened" className="flex flex-wrap gap-1.5">
    {options.map((option) => {
      const selected = option === value;
      return (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={selected}
          disabled={disabled}
          onClick={() => onChange(option)}
          className={cn(
            "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60",
            selected
              ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/30 hover:text-foreground",
          )}
        >
          <ActivityTypeIcon type={option} className={selected ? "text-primary" : undefined} />
          <span>{activityTypeLabel(option)}</span>
        </button>
      );
    })}
  </div>
);

export default ActivityTypeChips;
