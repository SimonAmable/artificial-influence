# Chat Prompt V1 Snapshot

This document is now an archival pointer, not the live runtime source of truth.

## Status

- The original UniCan chat prompt is preserved in code as `CHATBOT_SYSTEM_PROMPT_V1`.
- The new structured prompt is `CHATBOT_SYSTEM_PROMPT_V2`.
- Prompt selection now flows through the chat prompt registry and can be switched with `UNICAN_CHAT_PROMPT_VERSION`.

## Source of Truth

- Runtime prompt registry: `deep-shadcn/lib/chat/prompt-registry.ts`
- Runtime instruction assembly: `deep-shadcn/lib/chat/creative-agent.ts`
- Regression checks: `deep-shadcn/scripts/check-chat-prompt-regression.mjs`

## Notes

- `v1` is kept as the rollback target and should remain verbatim.
- `v2` is the maintainable prompt path: durable rules live in the base prompt, while current tool and thread context are supplied at runtime.
- Older prose in this file previously described direct route-level system-message injection and stale product details. Those implementation notes are no longer current and should not be used to edit chat behavior.
