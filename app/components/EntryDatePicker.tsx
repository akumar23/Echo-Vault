'use client'

import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function toEntryDateIso(date: Date): string {
  return format(startOfDay(date), 'yyyy-MM-dd')
}

export function entryDateFromIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function entryDateFromTimestamp(isoTimestamp: string): Date {
  return startOfDay(new Date(isoTimestamp))
}

interface EntryDatePickerProps {
  date: Date
  onDateChange: (date: Date) => void | Promise<void>
  saving?: boolean
  disabled?: boolean
  /** When true, render as a compact text button (entry header). */
  variant?: 'header' | 'inline'
}

export function EntryDatePicker({
  date,
  onDateChange,
  saving = false,
  disabled = false,
  variant = 'header',
}: EntryDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(date))
  const [selected, setSelected] = useState(() => startOfDay(date))
  const today = startOfDay(new Date())

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(viewMonth)
    const gridStart = startOfWeek(monthStart)
    const gridEnd = endOfWeek(monthEnd)
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [viewMonth])

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const normalized = startOfDay(date)
      setSelected(normalized)
      setViewMonth(startOfMonth(normalized))
    }
    setOpen(next)
  }

  const handleSave = async () => {
    if (isSameDay(selected, date)) {
      setOpen(false)
      return
    }
    await onDateChange(selected)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {variant === 'header' ? (
          <button
            type="button"
            disabled={disabled || saving}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            aria-label={`Entry date: ${format(date, 'MMMM d, yyyy')}. Click to change.`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>{format(date, 'MMMM d, yyyy')}</span>
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || saving}
            className="h-8 gap-1.5 font-normal"
          >
            <Calendar className="h-3.5 w-3.5" />
            {format(date, 'MMM d, yyyy')}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Entry date</DialogTitle>
          <DialogDescription>
            Choose which day this entry belongs to. Editing content will not
            change the date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              disabled={isSameMonth(viewMonth, today)}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {label}
              </div>
            ))}
            {calendarDays.map((day) => {
              const inMonth = isSameMonth(day, viewMonth)
              const isSelected = isSameDay(day, selected)
              const isFuture = isAfter(day, today)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={isFuture}
                  onClick={() => setSelected(startOfDay(day))}
                  className={cn(
                    'flex h-9 w-full items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    !inMonth && 'text-muted-foreground/40',
                    inMonth && !isSelected && !isFuture && 'hover:bg-muted',
                    isSelected && 'bg-primary text-primary-foreground',
                    isFuture && 'cursor-not-allowed opacity-30',
                    isToday(day) && !isSelected && 'font-semibold text-primary',
                  )}
                  aria-label={format(day, 'EEEE, MMMM d, yyyy')}
                  aria-pressed={isSelected}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save date'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
