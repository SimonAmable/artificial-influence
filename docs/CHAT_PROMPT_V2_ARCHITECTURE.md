# Chat Prompt V2 Architecture

## Summary

UniCan chat now uses a versioned prompt registry so prompt behavior can evolve without losing a clean rollback path.

## Files

- `deep-shadcn/lib/chat/prompt-registry.ts`
  - Defines `PromptVersion`
  - Stores `CHATBOT_SYSTEM_PROMPT_V1` and `CHATBOT_SYSTEM_PROMPT_V2`
  - Resolves the active version via `getChatPromptVersion()`
- `deep-shadcn/lib/chat/creative-agent.ts`
  - Builds the final agent instructions
  - Uses a versioned appendix:
    - `v1` keeps the legacy long-form appendix for rollback fidelity
    - `v2` uses a shorter structured appendix for runtime context
- `deep-shadcn/scripts/check-chat-prompt-regression.mjs`
  - Verifies prompt-version invariants
  - Verifies the Nano Banana contract is not contradictory
  - Verifies the chat tool registry still exposes the expected tools
  - Supports optional live `v1` vs `v2` smoke comparison with `--live`

## Version Selection

- Environment variable: `UNICAN_CHAT_PROMPT_VERSION`
- Allowed values: `v1`, `v2`
- Default fallback: `v2`

If the env var is missing or invalid, chat uses `v2`. To roll back immediately, set:

```bash
UNICAN_CHAT_PROMPT_VERSION=v1
```

## Design Rules

- `v1` is frozen. Do not edit it except to preserve exact rollback compatibility.
- `v2` should contain durable behavior only:
  - role
  - hard rules
  - execution vs advice policy
  - prompt fidelity policy
  - high-level tool routing
  - response style
- Volatile product facts should not live in the durable base prompt. Prefer runtime context and lookup tools.
- Tool-specific argument rules belong primarily in tool descriptions and input schema descriptions.

## Regression Workflow

Run the deterministic checks:

```bash
npm run check:chat-prompts
```

Optional live comparison when `AI_GATEWAY_API_KEY` is available:

```bash
node --experimental-strip-types scripts/check-chat-prompt-regression.mjs --live
```
