# Creative Agent Sidebar Research Report

## Goal

Design a Lovart-style creative agent for this Next.js app that:

- lives naturally in the existing sidebar/panel UX
- can read app data from the database
- asks follow-up questions before acting when the brief is incomplete
- triggers image, video, audio, or workflow generation
- feels like a creative copilot, not just a plain chatbot

---

## What already exists in this codebase

This app already has most of the foundation needed:

- A streaming chat UI using `@ai-sdk/react` in [components/ai-chat.tsx](/c:/Users/simon/Desktop/MYCOOLESTSHIT/001_testing_style/artificial-influece/deep-shadcn/components/ai-chat.tsx)
- A server chat route using the `ai` package in [app/api/chat/route.ts](/c:/Users/simon/Desktop/MYCOOLESTSHIT/001_testing_style/artificial-influece/deep-shadcn/app/api/chat/route.ts)
- Supabase auth and server/client helpers in [lib/supabase/server.ts](/c:/Users/simon/Desktop/MYCOOLESTSHIT/001_testing_style/artificial-influece/deep-shadcn/lib/supabase/server.ts) and [lib/supabase/client.ts](/c:/Users/simon/Desktop/MYCOOLESTSHIT/001_testing_style/artificial-influece/deep-shadcn/lib/supabase/client.ts)
- A sidebar/flyout interaction model in [components/canvas/canvas-sidebar.tsx](/c:/Users/simon/Desktop/MYCOOLESTSHIT/001_testing_style/artificial-influece/deep-shadcn/components/canvas/canvas-sidebar.tsx)
- Existing generation routes for image, video, audio, lipsync, and assets in `app/api/*`

Conclusion: this should be built as an extension of your current AI SDK + Supabase stack, not as a separate agent platform from scratch.

---

## What a Lovart-style agent should look like in your sidebar

The right pattern is not "chat in a sidebar."

It is a **creative control sidebar** with 4 states:

1. **Brief**
   - User types a goal like "make a luxury skincare campaign for IG reels."
   - Agent immediately extracts intent, deliverables, constraints, and missing info.

2. **Clarify**
   - Agent asks only the missing high-value questions.
   - Example: brand tone, target audience, aspect ratio, output type, references, deadline, model/persona choice.

3. **Plan**
   - Agent returns a mini production plan:
   - "I can create 3 image directions, 1 short video prompt, and a matching caption pack."
   - User can approve individual steps.

4. **Generate**
   - Agent triggers tools and streams progress.
   - Results appear as cards with actions like `Use on canvas`, `Refine`, `Make video`, `Save asset`, `Regenerate`.

### Best sidebar layout for this app

Your current canvas sidebar is icon-driven and opens flyouts. A similar pattern would fit well:

- Add a new sidebar button for `Agent`
- Open a wider flyout panel than history/assets
- Keep the panel split into:
  - top: thread header + mode
  - middle: conversation + structured follow-up chips
  - bottom: prompt box + attachments + action buttons
  - side rail or inline cards: generated outputs and DB context

### UX principles

- Ask fewer but sharper follow-up questions
- Show what the agent knows before it generates
- Separate "thinking/planning" from "tool execution"
- Make every output reusable inside canvas/assets/history
- Treat database data as project context, not as raw dump text

---

## Recommended product behavior

The agent should operate like an orchestrator with these capabilities:

### 1. Context gathering

The agent should be able to fetch:

- user profile / subscription / credits
- saved brand data
- saved assets
- previous generations
- existing workflows/canvases
- model availability

This data should be fetched through **server-side tools**, not directly from the client.

### 2. Follow-up question engine

The agent should:

- inspect the user request
- determine whether it has enough information
- ask a short set of targeted follow-ups
- stop asking once it has enough to act

This is better than hardcoding a static form because the questions should vary by job:

- image brief
- video brief
- brand identity brief
- influencer shoot brief
- prompt recreation

### 3. Generation orchestration

The agent should call existing generation endpoints as tools:

- `generate-image`
- `generate-video`
- `generate-audio`
- `generate-lipsync`
- asset save/list actions

This lets the same chat agent become a production assistant instead of a separate product silo.

### 4. Result packaging

The agent should return outputs in structured groups:

- `Concepts`
- `Prompts`
- `Generated assets`
- `Next best actions`

That feels much closer to Lovart than plain markdown chat.

---

## Library recommendation

## Primary recommendation: stay on Vercel AI SDK

For this app, the best fit is:

- `ai`
- `@ai-sdk/react`
- `zod`
- your existing Supabase stack

Why this is the best choice:

- You already use it in production code.
- It fits Next.js App Router naturally.
- It already supports streaming chat UX.
- It supports tool calling, structured outputs, and agent loops.
- It avoids a rewrite of your current chat architecture.

Based on the current AI SDK docs, the SDK now explicitly supports agents via `ToolLoopAgent`, subagents, and multi-step tool loops, which matches your use case well.

### What to build with it

Use AI SDK as the main runtime for:

- sidebar chat state
- tool calling
- structured follow-up questions
- DB read tools
- generation tools
- streaming intermediate output

### Suggested package stack

Core:

- `ai`
- `@ai-sdk/react`
- `zod`

Already in your app:

- `@supabase/supabase-js`
- `@supabase/ssr`
- `sonner`
- `framer-motion`

Optional additions:

- `@ai-sdk/openai` if you want direct OpenAI provider usage instead of gateway-only routing
- `@ai-sdk/devtools` for local inspection of tool calls and multi-step runs

---

## When to use LangGraph instead

Use LangGraph JS only if you specifically want:

- long-running pause/resume workflows
- durable checkpointed agent state
- human approval gates in the middle of execution
- multi-step branching logic that behaves more like a state machine than chat

LangGraph is strong for "pause here, ask the user, resume later" flows. Its interrupt and persistence model is good for review-heavy or approval-heavy agent systems.

For your current app, I would treat LangGraph as a **phase 2** choice, not phase 1.

Reason:

- it adds another orchestration layer
- your app already has a working AI SDK integration
- your initial need is a sidebar creative copilot, not a complex operations workflow engine

---

## When Mastra would make sense

Mastra is attractive if you want:

- an opinionated all-in-one agent framework
- built-in workflows, memory, evals, tracing, and tooling
- a more batteries-included agent platform

I would not start with Mastra in this repo unless you want the agent layer to become a separate platform initiative.

Reason:

- it would overlap with functionality you already have
- it increases framework surface area
- the ROI is better later if you decide to invest heavily in multi-agent workflows and evals

---

## Practical recommendation

### Best answer for this app

Use **Vercel AI SDK as the main library** and model the agent as a **tool-calling creative orchestrator** inside the sidebar.

### Add LangGraph only if

- you want true suspend/resume flows
- you want explicit approval checkpoints
- you expect long-running multi-step agent jobs

### Do not start with

- a full multi-agent framework rewrite
- DB access from the browser
- a generic chatbot UI with no structured creative workflow

---

## Recommended architecture for your app

### UI layer

Create a new agent panel component, likely near:

- [components/ai-chat.tsx](/c:/Users/simon/Desktop/MYCOOLESTSHIT/001_testing_style/artificial-influece/deep-shadcn/components/ai-chat.tsx)
- [components/canvas/canvas-sidebar.tsx](/c:/Users/simon/Desktop/MYCOOLESTSHIT/001_testing_style/artificial-influece/deep-shadcn/components/canvas/canvas-sidebar.tsx)

Proposed components:

- `components/agent/creative-agent-sidebar.tsx`
- `components/agent/agent-thread.tsx`
- `components/agent/agent-brief-card.tsx`
- `components/agent/agent-followup-form.tsx`
- `components/agent/agent-result-cards.tsx`
- `components/agent/agent-tool-status.tsx`

### Server layer

Create tool-backed agent logic in something like:

- `lib/agent/creative-agent.ts`
- `lib/agent/tools/get-project-context.ts`
- `lib/agent/tools/list-user-assets.ts`
- `lib/agent/tools/list-generations.ts`
- `lib/agent/tools/generate-image.ts`
- `lib/agent/tools/generate-video.ts`
- `lib/agent/tools/save-asset.ts`

### Data access pattern

The client sends messages only.

The server agent decides whether to:

- answer directly
- ask a follow-up question
- fetch DB data
- run generation
- propose a plan before executing

### Output contract

Use structured output for some turns, not only free text.

Example response shape:

```ts
type AgentTurn = {
  mode: "clarify" | "plan" | "generate" | "complete"
  summary: string
  missingFields?: Array<{
    key: string
    label: string
    question: string
    inputType: "text" | "select" | "textarea"
    options?: string[]
  }>
  actions?: Array<{
    id: string
    label: string
    kind: "generate-image" | "generate-video" | "save-asset" | "open-canvas"
  }>
  results?: Array<{
    id: string
    type: "image" | "video" | "audio" | "prompt" | "workflow"
    title: string
    url?: string
    metadata?: Record<string, unknown>
  }>
}
```

That gives you much better UI control than rendering everything as markdown.

---

## How follow-up questions should work

Do not make the model ask open-ended questions forever.

Instead:

1. classify the request
2. map required fields for that request type
3. check which fields are already known from:
   - current message
   - prior thread memory
   - DB context
4. ask only the missing fields
5. once minimum viable brief is complete, generate

### Example

User says:

`Make me a premium ad campaign for a new beauty brand`

Agent should likely ask:

- brand name?
- target audience?
- output type: image, video, or both?
- platform/aspect ratio?
- visual style references?

It should not ask 12 questions up front.

---

## Database integration guidance

Use Supabase-backed tools for:

- user profile lookup
- workspace/project context
- previous generation history
- saved brand kits
- assets library
- credits/subscription checks

Important:

- keep all DB access server-side
- scope every query by authenticated user
- avoid giving the model raw SQL access
- expose narrow business tools, not unrestricted database power

Good tool examples:

- `getUserBrandContext()`
- `listRecentGenerations()`
- `findReusableAssetsByTag()`
- `getAvailableModelsForUserPlan()`

Bad tool example:

- `runArbitrarySQL(query: string)`

---

## Generation integration guidance

Your app already has multiple generation routes. The cleanest design is:

- move shared generation logic into reusable server functions where possible
- call those functions from both the API routes and the agent tools

That prevents duplicated business logic and makes the agent a first-class entry point.

The agent can then:

- inspect the brief
- pick the correct generator
- propose defaults
- execute generation
- save to history/assets
- attach result cards back into canvas

---

## Suggested rollout plan

### Phase 1

- Replace or extend current `AIChat` into a creative agent panel
- Add DB read tools
- Add follow-up question logic
- Add image generation tool
- Return structured results with asset cards

### Phase 2

- Add video/audio/lipsync generation tools
- Add save-to-canvas and save-to-assets actions
- Add brand memory and project context
- Add multi-step planning mode

### Phase 3

- Add subagents by specialty:
  - strategist
  - prompt writer
  - image producer
  - video producer
- Add approval checkpoints
- Add evals and observability
- Consider LangGraph or a workflow layer if pause/resume becomes central

---

## Final recommendation

If the question is "what library should I use for this Next.js app?", the answer is:

**Use Vercel AI SDK as the primary agent library.**

It is the best fit because:

- it already exists in your app
- it is native to your current Next.js architecture
- it supports streaming, tool calling, and agent loops
- it will let you build a Lovart-style creative sidebar without a platform rewrite

If later you need durable human-in-the-loop orchestration, add **LangGraph JS** for that layer, but do not start there.

---

## Source notes

Local code references:

- [components/ai-chat.tsx](/c:/Users/simon/Desktop/MYCOOLESTSHIT/001_testing_style/artificial-influece/deep-shadcn/components/ai-chat.tsx)
- [app/api/chat/route.ts](/c:/Users/simon/Desktop/MYCOOLESTSHIT/001_testing_style/artificial-influece/deep-shadcn/app/api/chat/route.ts)
- [components/canvas/canvas-sidebar.tsx](/c:/Users/simon/Desktop/MYCOOLESTSHIT/001_testing_style/artificial-influece/deep-shadcn/components/canvas/canvas-sidebar.tsx)
- [package.json](/c:/Users/simon/Desktop/MYCOOLESTSHIT/001_testing_style/artificial-influece/deep-shadcn/package.json)

External sources reviewed:

- Vercel AI SDK docs: https://ai-sdk.dev/docs/agents/overview
- Vercel AI SDK docs: https://ai-sdk.dev/docs/agents/building-agents
- Vercel AI SDK docs: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- Vercel AI SDK docs: https://ai-sdk.dev/cookbook/next/call-tools
- Vercel AI repo README: https://github.com/vercel/ai
- LangGraph JS interrupts: https://docs.langchain.com/oss/javascript/langgraph/interrupts
- LangGraph JS persistence: https://docs.langchain.com/oss/javascript/langgraph/persistence
- OpenAI Agents SDK overview: https://developers.openai.com/api/docs/guides/agents-sdk
- Mastra agents/docs: https://mastra.ai/agents
- Mastra workflows: https://mastra.ai/workflows
