import React, { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DataTableDateFilterProps {
  fromParamName?: string;
  toParamName?: string;
  align?: "start" | "center" | "end";
}

export const DataTableDateFilter: React.FC<DataTableDateFilterProps> = ({
  fromParamName = "createdFrom",
  toParamName = "createdTo",
  align = "start",
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);

  const currentFrom = searchParams.get(fromParamName) || "";
  const currentTo = searchParams.get(toParamName) || "";

  const [draftFrom, setDraftFrom] = useState(currentFrom);
  const [draftTo, setDraftTo] = useState(currentTo);

  // Sync draft state whenever popover opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraftFrom(currentFrom);
        setDraftTo(currentTo);
      }
      setOpen(nextOpen);
    },
    [currentFrom, currentTo],
  );

  const isActive = Boolean(currentFrom || currentTo);
  const hasChanges = draftFrom !== currentFrom || draftTo !== currentTo;

  const handleApply = () => {
    const nextParams = new URLSearchParams(searchParams);
    if (draftFrom) {
      nextParams.set(fromParamName, draftFrom);
    } else {
      nextParams.delete(fromParamName);
    }

    if (draftTo) {
      nextParams.set(toParamName, draftTo);
    } else {
      nextParams.delete(toParamName);
    }

    // Reset pagination to page 1 on filter apply
    nextParams.set("page", "1");

    setSearchParams(nextParams);
    setOpen(false);
  };

  const handleReset = () => {
    setDraftFrom("");
    setDraftTo("");

    if (isActive) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete(fromParamName);
      nextParams.delete(toParamName);
      nextParams.set("page", "1");
      setSearchParams(nextParams);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className="cursor-pointer h-10 gap-1.5"
              aria-label="Filter by date range"
            >
              <CalendarIcon className="h-4 w-4" />
              {isActive && (
                <span className="flex min-w-[20px] items-center justify-center rounded-full bg-primary p-1 text-[11px] font-bold text-primary-foreground leading-none">
                  1
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Filter by date range</TooltipContent>
      </Tooltip>
      <PopoverContent
        align={align}
        className="flex w-[calc(100vw-2rem)] max-w-72 sm:max-w-80 flex-col overflow-hidden rounded-2xl border-border/40 p-0 shadow-xl"
      >
        <div className="p-5 space-y-4">
          <h4 className="text-sm font-semibold text-foreground/80 lowercase first-letter:uppercase">
            Date Range
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                From Date
              </label>
              <Input
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                To Date
              </label>
              <Input
                type="date"
                value={draftTo}
                min={draftFrom || undefined}
                onChange={(e) => setDraftTo(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 p-2 bg-muted/20 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!draftFrom && !draftTo && !isActive}
            className="flex-1 rounded-xl h-10 border-border/40 hover:bg-background hover:text-foreground font-semibold"
          >
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!hasChanges && !isActive}
            className="flex-1 rounded-xl h-10 bg-primary hover:opacity-90 text-primary-foreground font-semibold shadow-md active:scale-[0.98] transition-transform"
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DataTableDateFilter;
