"use client"

import * as React from "react"
import Image from "next/image"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

const PREFERENCES_KEY = "unican-bloop-preferences"
const POSITION_KEY = "unican-bloop-position"

type Preferences = { enabled: boolean; size: "small" | "medium" | "large" }
const defaults: Preferences = { enabled: true, size: "medium" }

function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "{}") as Partial<Preferences>
    return { enabled: saved.enabled !== false, size: saved.size === "small" || saved.size === "large" ? saved.size : "medium" }
  } catch { return defaults }
}

export function PetsSettingsPanel() {
  const [preferences, setPreferences] = React.useState<Preferences>(defaults)
  React.useEffect(() => setPreferences(readPreferences()), [])
  function save(next: Preferences) {
    setPreferences(next)
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event("bloop-preferences-changed"))
  }
  return <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Image
        src="/3d_icons/bloop.png"
        alt=""
        aria-hidden
        width={48}
        height={48}
        className="size-12 shrink-0 object-contain"
      />
      <div>
        <p className="text-base font-semibold">Bloop</p>
        <p className="mt-1 text-sm text-muted-foreground">Your generation companion.</p>
      </div>
    </div>
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4"><div><p className="text-sm font-medium">Show Bloop</p><p className="text-xs text-muted-foreground">Display generation notifications.</p></div><Switch checked={preferences.enabled} onCheckedChange={(enabled) => save({ ...preferences, enabled })} /></div>
    <div className="space-y-2"><p className="text-sm font-medium">Size</p><div className="flex gap-2">{(["small", "medium", "large"] as const).map((size) => <Button key={size} type="button" variant={preferences.size === size ? "default" : "outline"} size="sm" onClick={() => save({ ...preferences, size })}>{size[0].toUpperCase() + size.slice(1)}</Button>)}</div></div>
    <Button type="button" variant="outline" size="sm" onClick={() => { window.localStorage.removeItem(POSITION_KEY); window.dispatchEvent(new Event("bloop-preferences-changed")) }}>Reset position</Button>
  </div>
}
