import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, "..")

function toFileUrl(relativePath) {
  return pathToFileURL(path.join(ROOT, relativePath)).href
}

async function importTs(relativePath) {
  return import(toFileUrl(relativePath))
}

function withTempEnv(name, value, fn) {
  const previous = process.env[name]
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }

  try {
    return fn()
  } finally {
    if (previous === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = previous
    }
  }
}

async function loadFixtures() {
  const raw = await readFile(
    path.join(ROOT, "scripts", "fixtures", "chat-prompt-scenarios.json"),
    "utf8",
  )
  return JSON.parse(raw)
}

async function runStaticChecks() {
  const promptRegistry = await importTs("lib/chat/prompt-registry.ts")
  const legacyPrompts = await importTs("lib/constants/system-prompts.ts")
  const toolRegistry = await importTs("lib/chat/tool-registry.ts")

  const scenarios = await loadFixtures()
  const creativeAgentSource = await readFile(path.join(ROOT, "lib", "chat", "creative-agent.ts"), "utf8")
  const toolsIndexSource = await readFile(path.join(ROOT, "lib", "chat", "tools", "index.ts"), "utf8")
  const nanoToolSource = await readFile(
    path.join(ROOT, "lib", "chat", "tools", "generate-image-with-nano-banana.ts"),
    "utf8",
  )

  const knownAssertions = new Set([
    "automation_create_from_chat",
    "automation_delete_requires_approval",
    "automation_list_before_existing_action",
    "automation_schedule_ambiguity_needs_follow_up",
    "automation_update_from_chat",
    "await_only_when_same_turn_needs_output",
    "do_not_guess_media_ids",
    "execute_if_user_wants_output_now",
    "expand_when_vague",
    "list_thread_media_before_prior_media_edit",
    "literal_preserve_wording",
    "no_execution_without_explicit_generate",
    "no_wait_for_standalone_generation",
    "no_silent_expansion",
    "require_save_confirmation",
    "resolve_fuzzy_model_name",
    "resolve_or_clarify_brand_context",
    "schedule_follow_up_for_long_video_chain",
    "structured_prompt_package",
    "use_model_lookup_before_rejecting",
  ])

  assert.equal(promptRegistry.DEFAULT_CHAT_PROMPT_VERSION, "v2")
  assert.deepEqual(Object.keys(promptRegistry.CHAT_PROMPT_REGISTRY).sort(), ["v1", "v2"])
  assert.equal(promptRegistry.getChatPromptVersion("v1"), "v1")
  assert.equal(promptRegistry.getChatPromptVersion("v2"), "v2")

  withTempEnv("UNICAN_CHAT_PROMPT_VERSION", "v1", () => {
    assert.equal(promptRegistry.getChatPromptVersion(), "v1")
  })
  withTempEnv("UNICAN_CHAT_PROMPT_VERSION", "v2", () => {
    assert.equal(promptRegistry.getChatPromptVersion(), "v2")
  })
  withTempEnv("UNICAN_CHAT_PROMPT_VERSION", "bogus", () => {
    assert.equal(promptRegistry.getChatPromptVersion(), "v2")
  })

  assert.equal(
    promptRegistry.CHATBOT_SYSTEM_PROMPT_V1,
    legacyPrompts.CHATBOT_SYSTEM_PROMPT,
    "v1 prompt must stay identical to the legacy shipped prompt",
  )

  assert.match(promptRegistry.CHATBOT_SYSTEM_PROMPT_V2, /<role>/)
  assert.match(promptRegistry.CHATBOT_SYSTEM_PROMPT_V2, /<hard_rules>/)
  assert.match(promptRegistry.CHATBOT_SYSTEM_PROMPT_V2, /<execution_policy>/)
  assert.match(promptRegistry.CHATBOT_SYSTEM_PROMPT_V2, /<prompt_fidelity>/)
  assert.match(promptRegistry.CHATBOT_SYSTEM_PROMPT_V2, /<tool_routing>/)
  assert.match(promptRegistry.CHATBOT_SYSTEM_PROMPT_V2, /<response_style>/)
  assert.doesNotMatch(promptRegistry.CHATBOT_SYSTEM_PROMPT_V2, /must always receive json/i)
  assert.doesNotMatch(promptRegistry.CHATBOT_SYSTEM_PROMPT_V2, /must be a json string/i)

  assert.match(creativeAgentSource, /promptVersion\?: PromptVersion/)
  assert.match(creativeAgentSource, /getChatPromptVersion/)
  assert.match(creativeAgentSource, /buildCreativeAgentAppendixV1/)
  assert.match(creativeAgentSource, /buildCreativeAgentAppendixV2/)
  assert.match(creativeAgentSource, /resolvedPromptVersion === "v1"/)
  assert.match(
    creativeAgentSource,
    /If a generation tool returns \\`status: "pending"\\` and no later tool in this same turn needs that result, stop tool-calling and reply briefly\./,
  )
  assert.match(
    creativeAgentSource,
    /If the user asked only for the generation itself, do not call awaitGeneration or scheduleGenerationFollowUp\./,
  )
  assert.match(creativeAgentSource, /use the automation tools instead of giving manual instructions/i)
  assert.match(creativeAgentSource, /call \*\*listAutomations\*\* in the same turn/i)
  assert.match(creativeAgentSource, /Use \*\*manageAutomation\(action: "create"\)\*\*/i)
  assert.match(creativeAgentSource, /Use manageAutomation for create, update, pause, resume, run-now, and delete automation requests\./i)

  assert.match(nanoToolSource, /plain prose \*\*or\*\* a JSON creative brief/i)
  assert.match(nanoToolSource, /Literal mode/i)
  assert.match(nanoToolSource, /Expand mode/i)
  assert.match(
    nanoToolSource,
    /do not call awaitGeneration unless another tool in this same turn immediately needs the finished image/i,
  )
  assert.doesNotMatch(nanoToolSource, /must always receive JSON/i)
  assert.doesNotMatch(nanoToolSource, /must be a JSON string/i)

  for (const key of toolRegistry.getExpectedCreativeChatToolKeys()) {
    assert.match(
      toolsIndexSource,
      new RegExp(`\\b${key}\\b`),
      `Expected createCreativeChatTools to keep tool "${key}" available`,
    )
  }

  const ids = new Set()
  for (const scenario of scenarios) {
    assert.equal(typeof scenario.id, "string")
    assert.equal(typeof scenario.userMessage, "string")
    assert.ok(Array.isArray(scenario.expectedAssertions))
    assert.ok(!ids.has(scenario.id), `Duplicate scenario id: ${scenario.id}`)
    ids.add(scenario.id)

    for (const assertionId of scenario.expectedAssertions) {
      assert.ok(
        knownAssertions.has(assertionId),
        `Unknown prompt regression assertion "${assertionId}" in scenario "${scenario.id}"`,
      )
    }
  }

  console.log(
    `Static prompt regression checks passed (${scenarios.length} scenarios, ${toolRegistry.getExpectedCreativeChatToolKeys().length} tool keys).`,
  )

  return { promptRegistry, scenarios }
}

async function runLiveSmoke(promptRegistry, scenarios) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.log("Skipping live smoke comparison: AI_GATEWAY_API_KEY is not set.")
    return
  }

  const { createGateway, generateText } = await import("ai")
  const model = process.env.UNICAN_CHAT_PROMPT_LIVE_MODEL ?? "google/gemini-3.1-flash-lite-preview"
  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })

  console.log(`Running live smoke comparison on model ${model}...`)

  for (const scenario of scenarios) {
    console.log(`\n=== ${scenario.id} ===`)
    for (const version of ["v1", "v2"]) {
      const result = await generateText({
        model: gateway(model),
        system: promptRegistry.getChatSystemPrompt(version),
        prompt: scenario.userMessage,
        temperature: 0,
        maxOutputTokens: 220,
      })

      console.log(`\n[${version}] ${scenario.userMessage}`)
      console.log(result.text.trim())
    }
  }
}

const args = new Set(process.argv.slice(2))
const { promptRegistry, scenarios } = await runStaticChecks()

if (args.has("--live")) {
  await runLiveSmoke(promptRegistry, scenarios)
}
