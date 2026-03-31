# Editor Module Notes

This folder is the source of truth for the unfinished video editor feature.

## Route map

- `/editor`
  Project hub for listing, creating, duplicating, renaming, and deleting editor projects.
- `/editor/[id]`
  Main editor workspace for a single saved project.
- `/agent-chat`
  Chat-first timeline control surface for a specific editor project.

## Folder layout

- `types.ts`
  Shared editor domain types, timeline schema, render jobs, and agent session types.
- `utils.ts`
  Pure editor helpers and default values.
- `commands.ts`
  Pure timeline mutations. If an edit changes timeline state, it should ideally go here first.
- `agent.ts`
  Deterministic editor-agent interpretation and multi-step execution logic.
- `database.ts`
  Client-side fetch helpers for editor APIs.
- `database-server.ts`
  Server-side Supabase helpers for projects, renders, and agent sessions.
- `runtime.ts`
  Browser events for syncing editor context and editor project refreshes.

## UI ownership

- `components/editor/project-editor.tsx`
  Main editor shell and timeline UI.
- `components/editor/editor-composition.tsx`
  Remotion composition that renders saved project data.
- `components/editor/agent-chat-workspace.tsx`
  Full-page project-bound agent workspace.
- `components/ai-chat.tsx`
  Floating global chat with the editor-specific `agent` mode.

## Current implementation boundary

Implemented:

- project CRUD
- saved timeline state
- Remotion player preview
- basic timeline edits
- project-bound agent mode
- multi-step timeline commands
- execution cards in chat

Still intentionally unfinished:

- production export provider / render worker
- richer timeline UX and inspector polish
- stronger asset search and ambiguity handling
- full tool-result streaming via native AI SDK tool parts
- broader test coverage

## Suggested rule for future work

Keep editor state changes in `commands.ts` and keep route handlers thin.
If a new agent capability edits the timeline, add the pure command first, then call it from `agent.ts`, then surface it in the UI.
