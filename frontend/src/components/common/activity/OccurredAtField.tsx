import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { businessToday, type DateTimeParts, type TimePreset } from "@/utils/businessTime";
import { cn } from "@/utils/cn";

interface OccurredAtFieldProps {
  value: DateTimeParts;
  onChange: (value: DateTimeParts) => void;
  presets?: TimePreset[];
  /** Latest selectable date ("yyyy-MM-dd"); today when not given. */
  maxDate?: string;
  error?: string | null;
  disabled?: boolean;
}

/** When something happened: a past date and time in the business timezone. */
const OccurredAtField = ({
  value,
  onChange,
  presets = [],
  maxDate,
  error,
  disabled,
}: OccurredAtFieldProps) => (
  <div className="space-y-2">
    <div className="grid grid-cols-2 gap-3">
      <Input
        type="date"
        aria-label="Date it happened"
        value={value.date}
        max={maxDate ?? businessToday()}
        onChange={(event) => onChange({ ...value, date: event.target.value })}
        disabled={disabled}
        aria-invalid={Boolean(error)}
      />
      <TimePicker
        value={value.time}
        onChange={(time) => onChange({ ...value, time })}
        disabled={disabled}
        error={Boolean(error)}
        placeholder="Time"
      />
    </div>
    {presets.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const active = preset.date === value.date && preset.time === value.time;
          return (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ date: preset.date, time: preset.time })}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    )}
    {error && <p className="text-xs font-medium text-destructive">{error}</p>}
  </div>
);

export default OccurredAtField;
