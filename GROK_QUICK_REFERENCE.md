# Grok Model Quick Reference

## SQL to Add to Database

Copy and paste this into your Supabase SQL Editor to add the Grok model:

```sql
-- Add xAI Grok 2 Image Model
INSERT INTO public.models (identifier, name, description, type, provider, is_active, model_cost, parameters)
VALUES (
  'xai/grok-2-image',
  'Grok 2 Image',
  'xAI Grok 2 image generation model with support for creating images from text prompts',
  'image',
  'xai',
  true,
  0.004,
  '{
    "parameters": [
      {
        "name": "size",
        "type": "string",
        "label": "Size",
        "description": "Image size",
        "required": false,
        "default": "1024x768",
        "enum": ["1024x768"],
        "ui_type": "select"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Seed for reproducibility",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb
)
ON CONFLICT (identifier) DO NOTHING;
```

## Model Details

| Property | Value |
|----------|-------|
| Identifier | `xai/grok-2-image` |
| Name | Grok 2 Image |
| Type | Image Generation |
| Provider | xAI |
| Cost | 0.004 credits |
| Status | Active |
| Default Size | 1024x768 |

## Supported Parameters

### Size
- **Type**: Select dropdown
- **Default**: 1024x768
- **Options**: ["1024x768"]
- **Description**: Image size (fixed)

### Seed
- **Type**: Number input
- **Default**: None (random)
- **Min**: 0
- **Max**: 2147483647
- **Description**: Optional seed for reproducible generations

## How Users Will See It

Once the SQL is executed, the Grok model will appear in the image generation page as:

1. In the model selector dropdown (alphabetically ordered)
2. With "Grok 2 Image" as the display name
3. With size control (fixed at 1024x768)
4. With optional seed parameter

## Architecture

### Database Table
- **Table**: `public.models`
- **New Record**: Grok 2 Image (xai/grok-2-image)
- **RLS Policies**: Uses existing policies (public read access for active models)

### API Route (`/api/generate-image`)
- **Provider Detection**: Checks `modelData.provider`
- **xAI Routing**: Uses `xai.image()` from `@ai-sdk/xai`
- **Authentication**: Standard auth flow (user must be logged in)
- **Credits**: Standard credit deduction applies

### Frontend
- **Dynamic Loading**: Models fetched from database
- **Component**: `InfluencerInputBox` with model selector
- **Display**: Automatic formatting of model names
- **Parameters**: Dynamically displayed based on model definition

## Environment Variables Required

Add to your `.env.local`:

```
XAI_API_KEY=your_xai_api_key_here
```

## Code Changes Made

1. **lib/constants/models.ts**
   - Added Grok identifier
   - Added Grok parameters definition
   - Added Grok model object
   - Updated IMAGE_MODELS collection

2. **app/api/generate-image/route.ts**
   - Added xAI import
   - Added provider detection logic
   - Added xAI-specific provider options
   - Maintained backward compatibility with Replicate

3. **package.json**
   - Added `@ai-sdk/xai` dependency

## Testing the Implementation

1. **After running SQL**: Grok model should appear in `/app/image` dropdown
2. **Generate an image**: Type a prompt and select Grok from model dropdown
3. **Check logs**: API route logs will show "Using xAI provider with model: grok-2-image"
4. **Verify output**: Image should be generated at 1024x768 resolution

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Model not showing in dropdown | Run SQL migration and refresh page |
| "Cannot find module '@ai-sdk/xai'" | Run `npm install @ai-sdk/xai` |
| Generation fails with auth error | Check user is logged in |
| Generation fails with credits error | Ensure user has sufficient credits |
| "XAI_API_KEY not set" | Add XAI_API_KEY to environment variables |

## Files Created/Modified

```
✅ Created: supabase-grok-model-setup.sql
✅ Modified: lib/constants/models.ts
✅ Modified: app/api/generate-image/route.ts
✅ Modified: package.json (npm install)
✅ Created: GROK_MODEL_INTEGRATION.md (this file)
```

## Integration Status

- ✅ Model constants defined
- ✅ API route updated
- ✅ Dependencies installed
- ✅ TypeScript checks passing
- ✅ ESLint checks passing
- ⏳ Database: Awaiting SQL execution
- ⏳ Environment: Awaiting XAI_API_KEY setup
