"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ComboboxProps {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options.slice(0, 10)
    return options
      .filter((option) =>
        option.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 10)
  }, [options, searchQuery])

  const selectedLabel = value === "all" ? "All Sectors" : value || placeholder

  const handleSelect = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
    setSearchQuery("")
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn("w-full justify-between", className)}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="h-4 w-4 opacity-60" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  className="text-muted-foreground transition-opacity hover:opacity-80"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-accent",
                  value === "all" ? "text-foreground" : "text-muted-foreground"
                )}
                onClick={() => handleSelect("all")}
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    value === "all" ? "opacity-100" : "opacity-0"
                  )}
                />
                All Sectors
              </button>
              {filteredOptions.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</p>
              )}
              {filteredOptions.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition hover:bg-accent",
                    value === option ? "text-foreground" : "text-muted-foreground"
                  )}
                  onClick={() => handleSelect(option)}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
