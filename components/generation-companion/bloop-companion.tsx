"use client"

import * as React from "react"
import { CaretDown, Check, DotsSixVertical, SpinnerGap, WarningCircle, X } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useGenerationTasks, type GenerationTask } from "./generation-tasks-provider"

type Position = { x: number; y: number }
const STORAGE_KEY = "unican-bloop-position"
const PREFERENCES_KEY = "unican-bloop-preferences"
const NOTIFICATION_STATE_KEY = "unican-bloop-notifications"
type Preferences = { enabled: boolean; size: "small" | "medium" | "large" }
type NotificationState = { dismissedIds: string[]; collapsed: boolean }

function taskLabel(task: GenerationTask) {
  return `${task.type === "video" ? "Video" : "Image"} generation · ${task.model ?? "AI model"}`
}

type BloopState = "idle" | "running" | "running-left" | "running-right" | "review" | "failed"
const CELL_WIDTH = 74
const CELL_HEIGHT = 80
const FRAME_COUNT: Record<BloopState, number> = { idle: 6, "running-right": 8, "running-left": 8, failed: 8, running: 6, review: 6 }
const FRAME_INTERVAL_MS: Record<BloopState, number> = { idle: 220, "running-right": 85, "running-left": 85, failed: 130, running: 140, review: 180 }

function BloopSprite({ state }: { state: BloopState }) {
  const row = { idle: 0, "running-right": 1, "running-left": 2, failed: 5, running: 7, review: 8 }[state]
  const [frame, setFrame] = React.useState(0)

  React.useEffect(() => {
    setFrame(0)
    const timer = window.setInterval(
      () => setFrame((current) => (current + 1) % FRAME_COUNT[state]),
      FRAME_INTERVAL_MS[state],
    )
    return () => window.clearInterval(timer)
  }, [state])

  return (
    <div
      aria-hidden
      className={cn("h-20 w-[74px] bg-no-repeat", (state === "idle" || state === "review") && "bloop-sprite-bob")}
      style={{
        backgroundImage: "url('/pets/bloop/final/spritesheet-extended.webp')",
        backgroundSize: `${CELL_WIDTH * 8}px ${CELL_HEIGHT * 11}px`,
        backgroundPosition: `${-frame * CELL_WIDTH}px ${-row * CELL_HEIGHT}px`,
      }}
    />
  )
}

function StatusIcon({ status }: { status: GenerationTask["status"] }) {
  if (status === "completed") return <Check className="size-4 text-emerald-400" weight="bold" />
  if (status === "failed") return <WarningCircle className="size-4 text-destructive" weight="fill" />
  return <SpinnerGap className="size-4 animate-spin text-muted-foreground" />
}

export function BloopCompanion() {
  const router = useRouter()
  const { tasks } = useGenerationTasks()
  const [position, setPosition] = React.useState<Position>({ x: 20, y: 20 })
  const [preferences, setPreferences] = React.useState<Preferences>({ enabled: true, size: "medium" })
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set())
  const [collapsed, setCollapsed] = React.useState(false)
  const [notificationsHydrated, setNotificationsHydrated] = React.useState(false)
  const [dragState, setDragState] = React.useState<BloopState | null>(null)
  const dragging = React.useRef<{ x: number; y: number } | null>(null)

  React.useEffect(() => {
    const load = () => {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) { try { setPosition(JSON.parse(stored) as Position) } catch { /* use default */ } } else { setPosition({ x: 20, y: 20 }) }
      try {
        const saved = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "{}") as Partial<Preferences>
        setPreferences({ enabled: saved.enabled !== false, size: saved.size === "small" || saved.size === "large" ? saved.size : "medium" })
      } catch { setPreferences({ enabled: true, size: "medium" }) }
      try {
        const saved = JSON.parse(window.localStorage.getItem(NOTIFICATION_STATE_KEY) ?? "{}") as Partial<NotificationState>
        setDismissed(new Set(Array.isArray(saved.dismissedIds) ? saved.dismissedIds : []))
        setCollapsed(saved.collapsed === true)
      } catch { setDismissed(new Set()); setCollapsed(false) }
      setNotificationsHydrated(true)
    }
    load()
    window.addEventListener("bloop-preferences-changed", load)
    return () => window.removeEventListener("bloop-preferences-changed", load)
  }, [])

  const notificationTasks = tasks.filter((task) => {
    if (task.status === "pending" || task.status === "failed") return true
    return task.status === "completed" && task.isRecentCompletion
  }).filter((task) => !dismissed.has(task.id))
  const visibleTasks = notificationsHydrated ? notificationTasks.slice(0, 3) : []
  const notificationCount = notificationTasks.length
  const primary = visibleTasks[0]
  const state: BloopState = dragState ?? (primary?.status === "failed" ? "failed" : primary?.status === "completed" ? "review" : primary ? "running" : "idle")

  if (!preferences.enabled) return null

  function goToTask(task: GenerationTask) {
    router.push(`/${task.type === "video" ? "video" : "image"}?generation=${encodeURIComponent(task.id)}`)
  }

  function saveNotificationState(nextDismissed: Set<string>, nextCollapsed: boolean) {
    window.localStorage.setItem(NOTIFICATION_STATE_KEY, JSON.stringify({
      dismissedIds: [...nextDismissed].slice(-200),
      collapsed: nextCollapsed,
    } satisfies NotificationState))
  }

  function dismissNotification(id: string) {
    setDismissed((current) => {
      const next = new Set(current).add(id)
      saveNotificationState(next, collapsed)
      return next
    })
  }

  function toggleNotifications() {
    setCollapsed((current) => {
      const next = !current
      saveNotificationState(dismissed, next)
      return next
    })
  }

  return (
    <div className="fixed z-[70] touch-none" style={{ left: position.x, bottom: position.y }}>
      <style>{`@keyframes bloop-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        .bloop-sprite-bob { animation: bloop-bob 2.6s ease-in-out infinite; }`}</style>
      {!collapsed ? <div className="mb-1 flex w-[min(340px,calc(100vw-32px))] flex-col gap-1.5">
        {visibleTasks.map((task) => (
          <div key={task.id} className="group relative rounded-2xl border border-white/10 bg-zinc-900/95 px-3 py-2 text-left shadow-xl backdrop-blur transition-colors hover:bg-zinc-800">
            <button type="button" onClick={() => goToTask(task)} className="block w-full pr-5 text-left"><div className="flex items-center gap-2 text-xs font-semibold text-zinc-100"><span className="min-w-0 flex-1 truncate">{taskLabel(task)}</span><StatusIcon status={task.status} /></div>
            <p className="mt-0.5 truncate text-xs text-zinc-400">{task.status === "failed" ? task.errorMessage ?? "Generation failed" : task.prompt ?? "Generating media"}</p>
            </button><button type="button" aria-label="Dismiss notification" onClick={() => dismissNotification(task.id)} className="absolute right-2 top-2 hidden rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 group-hover:block focus:block"><X className="size-3" /></button>
          </div>
        ))}
      </div> : null}
      <button
        type="button"
        aria-label="Move Bloop"
        className="ml-3 cursor-grab active:cursor-grabbing"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          dragging.current = { x: event.clientX - position.x, y: window.innerHeight - event.clientY - position.y }
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return
          setDragState(event.movementX < 0 ? "running-left" : "running-right")
          setPosition({ x: Math.max(8, event.clientX - dragging.current.x), y: Math.max(8, window.innerHeight - event.clientY - dragging.current.y) })
        }}
        onPointerUp={() => {
          dragging.current = null
          setPosition((next) => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return next })
          window.setTimeout(() => setDragState(null), 240)
        }}
      >
        <div className={cn("relative", preferences.size === "small" ? "scale-75 origin-bottom-left" : preferences.size === "large" ? "scale-125 origin-bottom-left" : undefined)}><BloopSprite state={state} /><DotsSixVertical className="absolute bottom-0 left-0 size-4 text-muted-foreground/80" weight="bold" /></div>
      </button>
      {notificationCount > 0 ? <button type="button" aria-label={collapsed ? "Show notifications" : "Collapse notifications"} onClick={toggleNotifications} className="ml-8 mt-0.5 flex min-w-5 items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 shadow-sm hover:bg-zinc-800">
        {collapsed ? `${Math.min(notificationCount, 9)}${notificationCount > 9 ? "+" : ""}` : <CaretDown className="size-3" weight="bold" />}
      </button> : null}
    </div>
  )
}
