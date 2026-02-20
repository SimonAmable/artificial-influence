#!/usr/bin/env python3
"""
Create motion asset records from a folder of video files.
Uses an LLM to infer a short name from each filename.
Output: JSON with title only (no description, no tags) — all assets are motion category.

Usage:
  python scripts/create_motion_assets.py <folder_path> [-o output.json]

Requires: OPENAI_API_KEY in environment
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Error: openai package required. Run: pip install openai")
    sys.exit(1)

VIDEO_EXT = {".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"}


def infer_name_with_llm(filename: str, client: OpenAI) -> str:
    """Use LLM to infer a short asset name from the filename."""
    prompt = f"""Given this motion/video filename: {filename}

Infer a short, descriptive asset name (2-6 words). Consider:
- Motion type (dance, walk, gesture, etc.)
- Style or context if hinted by filename
- No filename extension or paths

Return ONLY the asset name, nothing else. No quotes, no description."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You output only asset names. No explanations, no punctuation except hyphens."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=50,
    )
    name = (response.choices[0].message.content or "").strip()
    return name or Path(filename).stem.replace("_", " ").replace("-", " ").title()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create motion assets from folder. LLM infers names; outputs title only (no description/tags)."
    )
    parser.add_argument("folder", type=str, help="Path to folder containing video files")
    parser.add_argument("-o", "--output", type=str, default="motion_assets.json", help="Output JSON file")
    parser.add_argument("--no-llm", action="store_true", help="Use sanitized filename as name (skip LLM)")
    args = parser.parse_args()

    folder = Path(args.folder).resolve()
    if not folder.is_dir():
        print(f"Error: {folder} is not a directory")
        return 1

    files = sorted(f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in VIDEO_EXT)
    if not files:
        print(f"No video files found in {folder}")
        return 1

    client = None
    if not args.no_llm:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            print("Error: OPENAI_API_KEY not set. Use --no-llm to skip LLM or set the env var.")
            return 1
        client = OpenAI(api_key=api_key)

    assets = []
    for i, f in enumerate(files):
        if args.no_llm:
            name = f.stem.replace("_", " ").replace("-", " ").title()
        else:
            assert client
            name = infer_name_with_llm(f.name, client)
            print(f"  [{i + 1}/{len(files)}] {f.name} -> {name}")

        assets.append({
            "title": name,
            "filePath": str(f),
            "fileName": f.name,
            "category": "motion",
            "assetType": "video",
        })

    out_path = Path(args.output)
    with open(out_path, "w", encoding="utf-8") as out:
        json.dump(assets, out, indent=2)

    print(f"\nWrote {len(assets)} motion assets to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
