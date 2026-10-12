import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Keyboard } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export interface TimePickerProps {
  value?: string | null;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  error?: boolean | string;
  align?: "start" | "center" | "end";
}

type Period = "AM" | "PM";
type ViewMode = "columns" | "dial";
type DialUnit = "hours" | "minutes";

// Helper to parse "HH:mm" -> { hours12: 1-12, minutes: 0-59, period: "AM"|"PM" }
function parseTime(value?: string | null): {
  hours12: number;
  minutes: number;
  period: Period;
} {
  if (!value || typeof value !== "string") {
    const now = new Date();
    const h24 = now.getHours();
    const m = now.getMinutes();
    return {
      hours12: h24 % 12 || 12,
      minutes: m,
      period: h24 >= 12 ? "PM" : "AM",
    };
  }

  const [hStr, mStr = "00"] = value.trim().split(":");
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);

  if (Number.isNaN(h) || h < 0 || h > 23) h = 12;
  if (Number.isNaN(m) || m < 0 || m > 59) m = 0;

  return {
    hours12: h % 12 || 12,
    minutes: m,
    period: h >= 12 ? "PM" : "AM",
  };
}

// Helper to format { hours12, minutes, period } -> "HH:mm" (24h)
function format24h(hours12: number, minutes: number, period: Period): string {
  let h24 = hours12 % 12;
  if (period === "PM") {
    h24 += 12;
  }
  return `${String(h24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Helper to format for display: "08:49 AM"
function formatDisplay(hours12: number, minutes: number, period: Period): string {
  return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

const HOURS_LIST = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const HOURS_ORDERED = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES_LIST = Array.from({ length: 60 }, (_, i) => i);
const MINUTES_STEP_5 = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export const TimePicker = React.forwardRef<HTMLButtonElement, TimePickerProps>(
  (
    {
      value,
      onChange,
      onBlur,
      name,
      id,
      disabled = false,
      required = false,
      placeholder = "Select time",
      className,
      error,
      align = "end",
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("columns");
    const [dialUnit, setDialUnit] = useState<DialUnit>("hours");

    // Internal state parsed from value
    const parsed = useMemo(() => parseTime(value), [value]);
    const [tempHours, setTempHours] = useState(parsed.hours12);
    const [tempMinutes, setTempMinutes] = useState(parsed.minutes);
    const [tempPeriod, setTempPeriod] = useState<Period>(parsed.period);

    const hourColRef = useRef<HTMLDivElement>(null);
    const minColRef = useRef<HTMLDivElement>(null);
    const clockRef = useRef<HTMLDivElement>(null);

    // Scroll active item into view in column mode
    useEffect(() => {
      if (open && viewMode === "columns") {
        const timer = setTimeout(() => {
          if (hourColRef.current) {
            const activeH = hourColRef.current.querySelector('[data-active="true"]');
            activeH?.scrollIntoView({ block: "nearest" });
          }
          if (minColRef.current) {
            const activeM = minColRef.current.querySelector('[data-active="true"]');
            activeM?.scrollIntoView({ block: "nearest" });
          }
        }, 60);
        return () => clearTimeout(timer);
      }
    }, [open, viewMode, tempHours, tempMinutes]);

    const commitChange = useCallback(
      (h: number, m: number, p: Period) => {
        setTempHours(h);
        setTempMinutes(m);
        setTempPeriod(p);
        const formatted = format24h(h, m, p);
        onChange?.(formatted);
      },
      [onChange],
    );

    const handleConfirm = () => {
      commitChange(tempHours, tempMinutes, tempPeriod);
      setOpen(false);
      onBlur?.();
    };

    const handleCancel = () => {
      setTempHours(parsed.hours12);
      setTempMinutes(parsed.minutes);
      setTempPeriod(parsed.period);
      setOpen(false);
      onBlur?.();
    };

    const handleOpenChange = (nextOpen: boolean) => {
      if (!disabled) {
        setOpen(nextOpen);
        if (nextOpen) {
          setTempHours(parsed.hours12);
          setTempMinutes(parsed.minutes);
          setTempPeriod(parsed.period);
          setDialUnit("hours");
        } else {
          onBlur?.();
        }
      }
    };

    // Calculate angle for clock hand
    const handAngle = useMemo(() => {
      if (dialUnit === "hours") {
        return (tempHours % 12) * 30;
      }
      return tempMinutes * 6;
    }, [dialUnit, tempHours, tempMinutes]);

    // Handle touch/mouse selection on clock dial
    const handleClockDialInteraction = (
      e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
    ) => {
      if (!clockRef.current) return;
      const rect = clockRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const dx = clientX - centerX;
      const dy = clientY - centerY;

      const rad = Math.atan2(dy, dx);
      const deg = (rad * (180 / Math.PI) + 90 + 360) % 360;

      if (dialUnit === "hours") {
        let h = Math.round(deg / 30) % 12;
        if (h === 0) h = 12;
        setTempHours(h);
        commitChange(h, tempMinutes, tempPeriod);
        setTimeout(() => setDialUnit("minutes"), 200);
      } else {
        const m = Math.round(deg / 6) % 60;
        setTempMinutes(m);
        commitChange(tempHours, m, tempPeriod);
      }
    };

    const hasValue = Boolean(value && String(value).trim());
    const displayString = hasValue
      ? formatDisplay(parsed.hours12, parsed.minutes, parsed.period)
      : "";

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            id={id}
            name={name}
            disabled={disabled}
            aria-required={required}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-destructive focus-visible:ring-destructive/20",
              className,
            )}
          >
            <span
              className={cn(
                "truncate font-medium text-foreground tracking-wide",
                !hasValue && "text-muted-foreground font-normal",
              )}
            >
              {displayString || placeholder}
            </span>
            <Clock className="h-4 w-4 text-muted-foreground/70 shrink-0 ml-2" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[260px] p-0 rounded-2xl border border-border/80 bg-popover shadow-2xl overflow-hidden z-[100]"
          align={align}
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          avoidCollisions={true}
        >
          {/* Header Time Readout */}
          <div className="bg-primary/10 border-b border-border/50 px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setDialUnit("hours");
                  if (viewMode !== "dial") setViewMode("dial");
                }}
                className={cn(
                  "px-2 py-0.5 rounded-lg text-lg font-black transition-all cursor-pointer",
                  dialUnit === "hours" && viewMode === "dial"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-foreground hover:bg-primary/20",
                )}
              >
                {String(tempHours).padStart(2, "0")}
              </button>
              <span className="text-base font-bold text-muted-foreground">:</span>
              <button
                type="button"
                onClick={() => {
                  setDialUnit("minutes");
                  if (viewMode !== "dial") setViewMode("dial");
                }}
                className={cn(
                  "px-2 py-0.5 rounded-lg text-lg font-black transition-all cursor-pointer",
                  dialUnit === "minutes" && viewMode === "dial"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-foreground hover:bg-primary/20",
                )}
              >
                {String(tempMinutes).padStart(2, "0")}
              </button>
            </div>

            {/* AM / PM Segmented Control */}
            <div className="flex rounded-lg border border-border/80 p-0.5 bg-background shadow-xs">
              <button
                type="button"
                onClick={() => commitChange(tempHours, tempMinutes, "AM")}
                className={cn(
                  "px-2 py-0.5 text-xs font-bold rounded-md transition-all cursor-pointer",
                  tempPeriod === "AM"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => commitChange(tempHours, tempMinutes, "PM")}
                className={cn(
                  "px-2 py-0.5 text-xs font-bold rounded-md transition-all cursor-pointer",
                  tempPeriod === "PM"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                PM
              </button>
            </div>
          </div>

          {/* Main Picker Content */}
          <div className="p-2.5">
            {viewMode === "columns" ? (
              /* Column / List Mode (Image 1 Style) */
              <div className="grid grid-cols-3 gap-1 h-[165px]">
                {/* Hours Column */}
                <div
                  ref={hourColRef}
                  className="flex flex-col gap-0.5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1 sticky top-0 bg-popover z-10">
                    Hour
                  </div>
                  {HOURS_ORDERED.map((h) => {
                    const isSelected = tempHours === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        data-active={isSelected}
                        onClick={() => commitChange(h, tempMinutes, tempPeriod)}
                        className={cn(
                          "h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer shrink-0",
                          isSelected
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "text-foreground hover:bg-muted/70",
                        )}
                      >
                        {String(h).padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>

                {/* Minutes Column */}
                <div
                  ref={minColRef}
                  className="flex flex-col gap-0.5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 border-l border-border/40 pl-1"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1 sticky top-0 bg-popover z-10">
                    Min
                  </div>
                  {MINUTES_LIST.map((m) => {
                    const isSelected = tempMinutes === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        data-active={isSelected}
                        onClick={() => commitChange(tempHours, m, tempPeriod)}
                        className={cn(
                          "h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer shrink-0",
                          isSelected
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "text-foreground hover:bg-muted/70",
                        )}
                      >
                        {String(m).padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>

                {/* AM / PM Column */}
                <div className="flex flex-col gap-1 border-l border-border/40 pl-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1">
                    Period
                  </div>
                  {(["AM", "PM"] as Period[]).map((p) => {
                    const isSelected = tempPeriod === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => commitChange(tempHours, tempMinutes, p)}
                        className={cn(
                          "h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer shrink-0",
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-foreground hover:bg-muted/70",
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Analog Clock Dial Mode (Image 2 Style) */
              <div className="flex flex-col items-center justify-center py-1 select-none">
                <div
                  ref={clockRef}
                  onClick={handleClockDialInteraction}
                  className="relative w-[180px] h-[180px] rounded-full bg-muted/40 border border-border/60 flex items-center justify-center cursor-pointer shadow-inner touch-none"
                >
                  {/* Center Dot */}
                  <div className="absolute w-2 h-2 rounded-full bg-primary z-20" />

                  {/* Clock Hand / Pointer */}
                  <div
                    className="absolute w-0.5 bg-primary origin-bottom z-10 transition-transform duration-100 ease-out"
                    style={{
                      height: "62px",
                      bottom: "50%",
                      left: "calc(50% - 1px)",
                      transform: `rotate(${handAngle}deg)`,
                    }}
                  >
                    {/* Circle Pointer Head */}
                    <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[11px] font-bold shadow-md">
                      {dialUnit === "hours"
                        ? tempHours
                        : String(tempMinutes).padStart(2, "0")}
                    </div>
                  </div>

                  {/* Dial Numbers */}
                  {dialUnit === "hours"
                    ? HOURS_LIST.map((h, i) => {
                        const angle = i * 30 - 90;
                        const rad = (angle * Math.PI) / 180;
                        const r = 66;
                        const x = Math.round(r * Math.cos(rad));
                        const y = Math.round(r * Math.sin(rad));
                        const isSelected = tempHours === h;

                        return (
                          <div
                            key={h}
                            style={{
                              transform: `translate(${x}px, ${y}px)`,
                            }}
                            className={cn(
                              "absolute w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold pointer-events-none transition-colors",
                              isSelected
                                ? "text-primary-foreground font-black"
                                : "text-foreground",
                            )}
                          >
                            {h}
                          </div>
                        );
                      })
                    : MINUTES_STEP_5.map((m, i) => {
                        const angle = i * 30 - 90;
                        const rad = (angle * Math.PI) / 180;
                        const r = 66;
                        const x = Math.round(r * Math.cos(rad));
                        const y = Math.round(r * Math.sin(rad));
                        const isSelected = tempMinutes === m;

                        return (
                          <div
                            key={m}
                            style={{
                              transform: `translate(${x}px, ${y}px)`,
                            }}
                            className={cn(
                              "absolute w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold pointer-events-none transition-colors",
                              isSelected
                                ? "text-primary-foreground font-black"
                                : "text-foreground",
                            )}
                          >
                            {String(m).padStart(2, "0")}
                          </div>
                        );
                      })}
                </div>
              </div>
            )}
          </div>

          {/* Footer with Mode Toggle & Action Buttons */}
          <div className="border-t border-border/60 px-3 py-2 bg-muted/20 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setViewMode((prev) => (prev === "dial" ? "columns" : "dial"))
              }
              title={
                viewMode === "dial"
                  ? "Switch to column picker"
                  : "Switch to clock dial"
              }
              className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
            >
              {viewMode === "dial" ? (
                <Keyboard className="h-3.5 w-3.5" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
            </Button>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-7 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                CANCEL
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                className="h-7 px-3 text-xs font-bold bg-primary text-primary-foreground shadow-xs cursor-pointer"
              >
                OK
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);

TimePicker.displayName = "TimePicker";
export default TimePicker;
