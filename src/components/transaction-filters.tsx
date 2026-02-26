"use client";

import { useState, useEffect } from "react";
import { Search, X, Funnel, Check } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { transactionCategories, transactionCategoryLabels } from "~/server/contracts/groups";
import type { GroupMember } from "~/server/contracts/groups";
import type { TransactionCategory } from "@prisma/client";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "~/lib/utils";

export interface TransactionFilters {
  search: string;
  categories: string[];
  payerIds: string[];
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

interface TransactionFiltersBarProps {
  filters: TransactionFilters;
  onFilterChange: (filters: TransactionFilters) => void;
  members: GroupMember[];
  expanded: boolean;
  onToggleExpanded: () => void;
}

export const EMPTY_FILTERS: TransactionFilters = {
  search: "",
  categories: [],
  payerIds: [],
  dateFrom: undefined,
  dateTo: undefined,
};

export function getActiveFilterCount(filters: TransactionFilters): number {
  let count = 0;
  if (filters.search) count++;
  if (filters.categories.length > 0) count++;
  if (filters.payerIds.length > 0) count++;
  if (filters.dateFrom || filters.dateTo) count++;
  return count;
}

export function hasActiveFilters(filters: TransactionFilters): boolean {
  return getActiveFilterCount(filters) > 0;
}

function toggleArrayValue(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function filtersEqual(a: TransactionFilters, b: TransactionFilters): boolean {
  return (
    a.search === b.search &&
    a.categories.join(",") === b.categories.join(",") &&
    a.payerIds.join(",") === b.payerIds.join(",") &&
    a.dateFrom?.getTime() === b.dateFrom?.getTime() &&
    a.dateTo?.getTime() === b.dateTo?.getTime()
  );
}

export default function TransactionFiltersBar({
  filters,
  onFilterChange,
  members,
  expanded,
  onToggleExpanded,
}: TransactionFiltersBarProps) {
  const [draft, setDraft] = useState<TransactionFilters>(filters);
  const activeCount = getActiveFilterCount(filters);
  const hasDraftChanges = !filtersEqual(draft, filters);

  // Sync draft when applied filters change externally (e.g. clear all)
  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const updateDraft = <K extends keyof TransactionFilters>(
    key: K,
    value: TransactionFilters[K],
  ) => {
    setDraft((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "dateFrom" && updated.dateTo && updated.dateFrom && updated.dateTo < updated.dateFrom) {
        updated.dateTo = undefined;
      }
      return updated;
    });
  };

  const handleApply = () => {
    onFilterChange(draft);
    onToggleExpanded();
  };

  const handleClearAll = () => {
    setDraft(EMPTY_FILTERS);
    onFilterChange(EMPTY_FILTERS);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToggleExpanded} className="gap-1.5">
          <Funnel className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={handleClearAll}
          >
            <X className="mr-1 h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          {/* Search */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={draft.search}
                onChange={(e) => updateDraft("search", e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
                className="h-8 pl-9 text-xs"
              />
              {draft.search && (
                <button
                  onClick={() => updateDraft("search", "")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Categories multi-select */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Categories</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-8 w-full justify-start text-xs font-normal", {
                    "text-muted-foreground": draft.categories.length === 0,
                  })}
                >
                  {draft.categories.length === 0
                    ? "All categories"
                    : `${draft.categories.length} selected`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-1" align="start">
                {transactionCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => updateDraft("categories", toggleArrayValue(draft.categories, cat))}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
                  >
                    <div className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                      { "border-primary bg-primary text-primary-foreground": draft.categories.includes(cat) },
                    )}>
                      {draft.categories.includes(cat) && <Check className="h-3 w-3" />}
                    </div>
                    {transactionCategoryLabels[cat as TransactionCategory]}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Paid by multi-select */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Paid by</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-8 w-full justify-start text-xs font-normal", {
                    "text-muted-foreground": draft.payerIds.length === 0,
                  })}
                >
                  {draft.payerIds.length === 0
                    ? "All members"
                    : `${draft.payerIds.length} selected`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-1" align="start">
                {members
                  .filter((m) => m.status === "JOINED")
                  .map((member) => (
                    <button
                      key={member.id}
                      onClick={() => updateDraft("payerIds", toggleArrayValue(draft.payerIds, member.id))}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
                    >
                      <div className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                        { "border-primary bg-primary text-primary-foreground": draft.payerIds.includes(member.id) },
                      )}>
                        {draft.payerIds.includes(member.id) && <Check className="h-3 w-3" />}
                      </div>
                      {member.firstName} {member.lastName}
                    </button>
                  ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Date range */}
          <div className="flex items-end gap-4">
            <div className="space-x-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-8 w-[130px] justify-start text-xs font-normal", {
                      "text-muted-foreground": !draft.dateFrom,
                    })}
                  >
                    {draft.dateFrom ? format(draft.dateFrom, "MMM d, yyyy") : "Start date"}
                    <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={draft.dateFrom}
                    onSelect={(date) => updateDraft("dateFrom", date)}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-x-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-8 w-[130px] justify-start text-xs font-normal", {
                      "text-muted-foreground": !draft.dateTo,
                    })}
                  >
                    {draft.dateTo ? format(draft.dateTo, "MMM d, yyyy") : "End date"}
                    <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={draft.dateTo}
                    onSelect={(date) => updateDraft("dateTo", date)}
                    disabled={(date) =>
                      date > new Date() ||
                      (draft.dateFrom ? date < draft.dateFrom : false)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Apply button */}
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!hasDraftChanges}
            className="w-full"
          >
            <Search className="mr-1.5 h-3.5 w-3.5" />
            Apply Filters
          </Button>
        </div>
      )}
    </div>
  );
}
