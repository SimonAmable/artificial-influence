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
- `title` — LLM-inferred or sanitized name
- `filePath` — full path to file
- `fileName` — basename
- `category` — always `"motion"`
- `assetType` — always `"video"`

Import the output into your asset library or use it for bulk upload workflows.

## sync_inworld_voices.py

Seeds missing Inworld voices into the shared `voices` table in Supabase. The script loads the same env file as the app by default, fetches the current Inworld catalog, checks which `provider_voice_id` values already exist for `provider = 'inworld'`, and inserts only the missing rows.
It also synthesizes and uploads preview audio for voices that do not already have a stored preview.

### Usage

```bash
python scripts/sync_inworld_voices.py
python scripts/sync_inworld_voices.py --dry-run
python scripts/sync_inworld_voices.py --model inworld-tts-1.5-max
python scripts/sync_inworld_voices.py --preview-model inworld-tts-1.5-max
```

### Required env vars

- `INWORLD_API_KEY_BASE64`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
