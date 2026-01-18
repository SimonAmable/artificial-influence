"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SquaresFour, Rows, Columns } from "@phosphor-icons/react"

export type LayoutMode = "column" | "row"

interface LayoutToggleProps {
  value: LayoutMode
  onValueChange: (value: LayoutMode) => void
  className?: string
}

export function LayoutToggle({ value, onValueChange, className }: LayoutToggleProps) {
  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <SquaresFour className="size-4 text-muted-foreground" />
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="column">
            <div className="flex items-center gap-2">
              <Columns className="size-4" />
              <span>Column</span>
            </div>
          </SelectItem>
          <SelectItem value="row">
            <div className="flex items-center gap-2">
              <Rows className="size-4" />
              <span>Row</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
