# Scripts

## create_motion_assets.py

Creates motion asset records from a folder of video files. Uses an LLM to infer a short name from each filename. Outputs JSON with **title only** (no description, no tags); all assets are motion category.

### Setup

```bash
pip install -r scripts/requirements.txt
```

Set `OPENAI_API_KEY` in your environment for LLM name inference.

### Usage

```bash
# With LLM (recommended)
python scripts/create_motion_assets.py path/to/videos -o motion_assets.json

# Without LLM (uses sanitized filename)
python scripts/create_motion_assets.py path/to/videos --no-llm -o motion_assets.json
```

### Output

JSON array of assets, each with:
- `title`, LLM-inferred or sanitized name
- `filePath`, full path to file
- `fileName`, basename
- `category`, always `"motion"`
- `assetType`, always `"video"`

Import the output into your asset library or use it for bulk upload workflows.

## sync_voices.py

Seeds missing voices into the shared `voices` table in Supabase. The script loads the same env file as the app by default, checks which `provider_voice_id` values already exist for the selected provider, and inserts only the missing rows.

- `--provider inworld`: fetches the current Inworld catalog and can synthesize preview audio.
- `--provider google`: seeds the built-in Gemini 3.1 Flash TTS voice catalog (30 voices) and can generate preview audio through Replicate.

### Usage

```bash
python scripts/sync_voices.py --provider inworld
python scripts/sync_voices.py --provider inworld --dry-run
python scripts/sync_voices.py --provider inworld --model inworld-tts-1.5-max
python scripts/sync_voices.py --provider inworld --preview-model inworld-tts-1.5-max
python scripts/sync_voices.py --provider google --dry-run
python scripts/sync_voices.py --provider google
```

### Required env vars

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INWORLD_API_KEY_BASE64` for `--provider inworld`
- `REPLICATE_API_TOKEN` for `--provider google` when preview generation is enabled

## sync_inworld_voices.py

Compatibility wrapper that forwards to `sync_voices.py --provider inworld`.
