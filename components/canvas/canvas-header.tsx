"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { FloppyDisk, Play, CircleNotch, GearSix, CaretDownIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { navigationItems } from "@/lib/constants/navigation"

interface CanvasHeaderProps {
  name: string
  onNameChange: (name: string) => void
  onSave: () => void
  onExecute: () => void
  isExecuting: boolean
  isSaving: boolean
}

export function CanvasHeader({
  name,
  onNameChange,
  onSave,
  onExecute,
  isExecuting,
  isSaving,
}: CanvasHeaderProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = React.useState(false)
  const [showExecuteDialog, setShowExecuteDialog] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleExecuteClick = () => {
    setShowExecuteDialog(true)
  }

  const handleConfirmExecute = () => {
    setShowExecuteDialog(false)
    onExecute()
  }

  return (
    <>
      {/* Logo with Navigation Dropdown */}
      <div className="absolute top-4 left-4 z-30 bg-zinc-900/80 backdrop-blur-md border border-white/10 shadow-lg rounded-xl px-3 py-2">
        <DropdownMenu >
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 hover:opacity-80 transition-opacity group">
              <Image 
                src="/logo.svg" 
                alt="Logo" 
                width={32} 
                height={32}
                className="h-6 w-6"
              />
              <CaretDownIcon className="h-3 w-3 text-zinc-400 group-hover:text-zinc-100 transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {navigationItems.map((item) => (
              <DropdownMenuItem 
                key={item.path} 
                onClick={() => router.push(item.path)}
                className={cn(item.className)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Workflow Name */}
      <div className="absolute top-4 left-20 z-30 bg-zinc-900/80 backdrop-blur-md border border-white/10 shadow-lg rounded-xl px-3 py-2">
        {isEditing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setIsEditing(false)
            }}
            className="bg-transparent text-zinc-100 text-sm font-medium border-b border-white/20 outline-none px-1 py-0.5 w-48 max-w-xs"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-zinc-100 text-sm font-medium hover:text-white transition-colors max-w-xs truncate"
          >
            {name || "Untitled"}
          </button>
        )}
      </div>

      {/* Right floating group: Desktop buttons (Save + Execute) */}
      <div className="absolute top-4 right-4 z-30 hidden lg:flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="border-white/10 text-zinc-300 hover:text-white bg-zinc-900/95 backdrop-blur-md hover:bg-zinc-800/95 shadow-xl h-8 text-xs"
        >
          {isSaving ? (
            <CircleNotch size={14} className="animate-spin mr-1.5" />
          ) : (
            <FloppyDisk size={14} className="mr-1.5" />
          )}
          Save
        </Button>
        <Button
          size="sm"
          onClick={handleExecuteClick}
          disabled={isExecuting}
          className={cn(
            "h-8 text-xs shadow-xl backdrop-blur-md",
            isExecuting && "opacity-80"
          )}
        >
          {isExecuting ? (
            <CircleNotch size={14} className="animate-spin mr-1.5" />
          ) : (
            <Play size={14} weight="fill" className="mr-1.5" />
          )}
          {isExecuting ? "Running..." : "Execute"}
        </Button>
      </div>

      {/* Right floating group: Mobile dropdown (Settings) */}
      <div className="absolute top-4 right-4 z-30 lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="bg-zinc-900/80 backdrop-blur-md border border-white/10 shadow-lg hover:bg-zinc-800/80"
            >
              <GearSix size={20} weight="duotone" className="text-zinc-300" />
              <span className="sr-only">Settings</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <CircleNotch size={16} className="animate-spin mr-2" />
            ) : (
              <FloppyDisk size={16} className="mr-2" />
            )}
            Save
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExecuteClick} disabled={isExecuting}>
            {isExecuting ? (
              <CircleNotch size={16} className="animate-spin mr-2" />
            ) : (
                <Play size={16} weight="fill" className="mr-2" />
              )}
              {isExecuting ? "Running..." : "Execute"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Execute Confirmation Dialog */}
      <AlertDialog open={showExecuteDialog} onOpenChange={setShowExecuteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Execute Workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will run the workflow and may consume credits. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExecute}>
              Execute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
