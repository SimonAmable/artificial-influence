"use client"

import Link from "next/link"
import { MagnifyingGlass } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getDashboardToolNavItems } from "@/lib/constants/navigation"
import { openGlobalSearch } from "@/lib/navigation/open-global-search"
import { getNavIcon } from "@/lib/navigation/nav-icons"

export function FeatureButtonGrid() {
  return (
    <div className="w-full space-y-6 rounded-[24px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold">Tools</h2>
        <Button
          type="button"
          onClick={() => openGlobalSearch()}
          size="lg"
          variant="ghost"
          className="shadow-md transition-shadow hover:shadow-lg"
        >
          <MagnifyingGlass size={18} weight="bold" className="mr-2" />
          Search
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
        {getDashboardToolNavItems().map((tool) => {
          const Icon = getNavIcon(tool.icon)
          return (
            <Tooltip key={tool.href}>
              <TooltipTrigger asChild>
                <Link
                  href={tool.href}
                  title={tool.hint}
                  className="flex min-w-0 items-center gap-3 rounded-[24px] px-4 py-3 outline-none transition-shadow duration-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[24px] bg-muted text-foreground shadow-sm">
                    <Icon size={22} weight="regular" className="shrink-0" />
                  </div>
                  <span className="min-w-0 flex-1 text-center text-sm font-semibold text-foreground">
                    {tool.label}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-left leading-snug">
                {tool.hint}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
