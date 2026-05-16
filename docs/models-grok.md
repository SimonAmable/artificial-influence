# Grok 2 Image Model Integration

xAI Grok 2 is integrated into the image generation pipeline alongside existing Replicate models.

## Model Details

| Property | Value |
|----------|-------|
| Identifier | `xai/grok-2-image` |
| Provider | xAI |
| Type | Image Generation |
| Cost | 0.004 credits |
| Default Size | 1024x768 (fixed) |

### Parameters
- **size** — Fixed at `1024x768`
- **seed** — Optional int 0–2147483647 for reproducible outputs

---

## Setup

### 1. Environment Variable

```env
XAI_API_KEY=your_xai_api_key_here
```

### 2. Add Model to Database

Run this in Supabase SQL Editor (also saved as `supabase/manual/supabase-grok-model-setup.sql`):

```sql
INSERT INTO public.models (identifier, name, description, type, provider, is_active, model_cost, parameters)
VALUES (
  'xai/grok-2-image',
  'Grok 2 Image',
  'xAI Grok 2 image generation model',
  'image',
  'xai',
  true,
  0.004,
  '{
    "parameters": [
      {"name":"size","type":"string","label":"Size","default":"1024x768","enum":["1024x768"],"ui_type":"select"},
      {"name":"seed","type":"number","label":"Seed","default":null,"min":0,"max":2147483647,"ui_type":"number"}
    ]
  }'::jsonb
)
ON CONFLICT (identifier) DO NOTHING;
```

Once inserted the model automatically appears in the image generation page dropdown — no frontend changes needed.

---

## Architecture

The API route (`app/api/generate-image/route.ts`) detects provider via `modelData.provider`:
- `"xai"` ? `xai.image()` from `@ai-sdk/xai`
- anything else ? `replicate.image()` (existing behavior)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Model not in dropdown | Run SQL and refresh |
| `Cannot find module @ai-sdk/xai` | `npm install @ai-sdk/xai` |
| Generation fails with credits error | Check user credit balance |
| `XAI_API_KEY not set` | Add key to `.env.local` |
