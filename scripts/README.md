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
