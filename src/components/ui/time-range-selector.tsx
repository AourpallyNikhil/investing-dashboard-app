'use client'

import { Button } from '@/components/ui/button'
import { TimeRange } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TimeRangeSelectorProps {
  ranges: TimeRange[]
  selected: string
  onSelect: (value: string) => void
  className?: string
}

export function TimeRangeSelector({
  ranges,
  selected,
  onSelect,
  className,
}: TimeRangeSelectorProps) {
  return (
    <div className={cn('flex space-x-1', className)}>
      {ranges.map((range) => (
        <Button
          key={range.value}
          variant={selected === range.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(range.value)}
          className="h-8 px-3 text-xs"
        >
          {range.label}
        </Button>
      ))}
    </div>
  )
}
