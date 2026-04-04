"use client"

import * as React from "react"

export type CanvasWorkflowExecutionContextValue = {
  executingGroupId: string | null
}

export const CanvasWorkflowExecutionContext =
  React.createContext<CanvasWorkflowExecutionContextValue>({
    executingGroupId: null,
  })

export function useCanvasWorkflowExecution() {
  return React.useContext(CanvasWorkflowExecutionContext)
}
