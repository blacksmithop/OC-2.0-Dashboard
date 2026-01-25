"use client"

import { useState } from "react"
import { CalendarIcon, X } from "lucide-react"
import { format, isValid, startOfDay, endOfDay } from "date-fns"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface CrimeDateFilterProps {
  minDate: Date
  maxDate: Date
  startDate: Date
  endDate: Date
  onDateRangeChange: (start: Date, end: Date) => void
  onClear?: () => void
  isFiltered?: boolean
}

export function CrimeDateFilter({ minDate, maxDate, startDate, endDate, onDateRangeChange, onClear, isFiltered }: CrimeDateFilterProps) {
  const [startOpen, setStartOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [startMonth, setStartMonth] = useState<Date | undefined>()
  const [endMonth, setEndMonth] = useState<Date | undefined>()

  const safeStartDate = isValid(startDate) ? startDate : new Date()
  const safeEndDate = isValid(endDate) ? endDate : new Date()
  const safeMinDate = isValid(minDate) ? minDate : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const safeMaxDate = isValid(maxDate) ? maxDate : new Date()

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date && isValid(date)) {
      // Set to start of day (00:00:00)
      const start = startOfDay(date)
      onDateRangeChange(start, safeEndDate)
      setStartOpen(false)
    }
  }

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date && isValid(date)) {
      // Set to end of day (23:59:59.999)
      const end = endOfDay(date)
      onDateRangeChange(safeStartDate, end)
      setEndOpen(false)
    }
  }

  const handleStartOpenChange = (open: boolean) => {
    setStartOpen(open)
    if (open) {
      setStartMonth(safeStartDate)
    }
  }

  const handleEndOpenChange = (open: boolean) => {
    setEndOpen(open)
    if (open) {
      setEndMonth(safeEndDate)
    }
  }

  return (
    <div className={cn(
      "bg-card border rounded-lg p-4",
      isFiltered ? "border-primary/50" : "border-border"
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Date Range Filter</h3>
          {isFiltered && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded font-medium">
              Custom
            </span>
          )}
        </div>
        {isFiltered && onClear && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            className="text-xs h-7 px-2 bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
          >
            <X size={14} className="mr-1" />
            Clear Filter
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Start Date Picker */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">From Date</label>
          <Popover open={startOpen} onOpenChange={handleStartOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !isValid(safeStartDate) && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(safeStartDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={safeStartDate}
                onSelect={handleStartDateSelect}
                month={startMonth}
                onMonthChange={setStartMonth}
                disabled={(date) => date > safeEndDate || date < safeMinDate || date > safeMaxDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date Picker */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">To Date</label>
          <Popover open={endOpen} onOpenChange={handleEndOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !isValid(safeEndDate) && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(safeEndDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={safeEndDate}
                onSelect={handleEndDateSelect}
                month={endMonth}
                onMonthChange={setEndMonth}
                disabled={(date) => date < safeStartDate || date < safeMinDate || date > safeMaxDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}
