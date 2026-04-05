#!/usr/bin/env python3
"""Seed missing Inworld voices into the shared `voices` table."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import socket
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error, parse, request


SCRIPT_DIR = Path(__file__).resolve().parent
APP_ROOT = SCRIPT_DIR.parent
DEFAULT_ENV_PATH = APP_ROOT / ".env.local"
INWORLD_API_BASE_URL = "https://api.inworld.ai"
DEFAULT_PROVIDER = "inworld"
DEFAULT_PREVIEW_BUCKET = "public-bucket"
DEFAULT_PREVIEW_MODEL = "inworld-tts-1.5-max"
DEFAULT_SAMPLE_RATE_HERTZ = 22050
DEFAULT_TIMEOUT_SECONDS = 30


class SyncError(RuntimeError):
    """Raised when the sync cannot continue."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Insert missing Inworld voices into the Supabase voices table."
    )
    parser.add_argument(
        "--env-file",
        default=str(DEFAULT_ENV_PATH),
        help="Path to the env file to load before syncing.",
    )
    parser.add_argument(
        "--provider",
        default=DEFAULT_PROVIDER,
        help="Provider name to store in the voices table. Defaults to 'inworld'.",
    )
    parser.add_argument(
        "--model",
        default="",
        help="Optional model label to store on inserted rows.",
    )
    parser.add_argument(
        "--preview-model",
        default=DEFAULT_PREVIEW_MODEL,
        help="Model to use when synthesizing preview audio.",
    )
    parser.add_argument(
        "--preview-bucket",
        default=DEFAULT_PREVIEW_BUCKET,
        help="Supabase Storage bucket for generated previews.",
    )
    parser.add_argument(
        "--skip-preview-generation",
        action="store_true",
        help="Skip synthesizing and uploading preview audio.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="Network timeout for Inworld and Supabase requests.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be inserted without writing to Supabase.",
    )
    return parser.parse_args()


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        raise SyncError(f"Env file not found: {env_path}")

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :]

        key, separator, value = line.partition("=")
        if not separator:
            continue

        key = key.strip()
        value = value.strip()
        if not key:
            continue

        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]

        os.environ.setdefault(key, value)


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SyncError(f"Required environment variable is missing: {name}")
    return value


def request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    payload: Any | None = None,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> Any:
    body: bytes | None = None
    request_headers = dict(headers or {})

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")

    req = request.Request(url, data=body, headers=request_headers, method=method)

    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            charset = response.headers.get_content_charset("utf-8")
            raw = response.read().decode(charset)
            return json.loads(raw) if raw else None
    except error.HTTPError as exc:
        charset = exc.headers.get_content_charset("utf-8")
        details = exc.read().decode(charset, errors="replace")
        raise SyncError(
            f"{method} {url} failed with status {exc.code}: {details}"
        ) from exc
    except error.URLError as exc:
        raise SyncError(f"{method} {url} failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise SyncError(f"{method} {url} timed out after {timeout_seconds}s") from exc
    except socket.timeout as exc:
        raise SyncError(f"{method} {url} timed out after {timeout_seconds}s") from exc


def fetch_inworld_voices(api_key_base64: str, *, timeout_seconds: int) -> list[dict[str, Any]]:
    response = request_json(
        f"{INWORLD_API_BASE_URL}/voices/v1/voices",
        headers={
            "Authorization": f"Basic {api_key_base64}",
        },
        timeout_seconds=timeout_seconds,
    )
    voices = response.get("voices") if isinstance(response, dict) else None
    if not isinstance(voices, list):
        raise SyncError("Inworld response did not contain a voices array")
    return [voice for voice in voices if isinstance(voice, dict)]


def fetch_existing_voice_ids(
    supabase_url: str, service_role_key: str, provider: str, *, timeout_seconds: int
) -> dict[str, dict[str, Any]]:
    query = parse.urlencode(
        {
            "select": "provider_voice_id,preview_audio_url,preview_storage_path",
            "provider": f"eq.{provider}",
            "limit": "5000",
        }
    )
    response = request_json(
        f"{supabase_url.rstrip('/')}/rest/v1/voices?{query}",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        },
        timeout_seconds=timeout_seconds,
    )

    if not isinstance(response, list):
        raise SyncError("Supabase voices response was not a JSON array")

    rows_by_voice_id: dict[str, dict[str, Any]] = {}
    for row in response:
        if not isinstance(row, dict):
            continue
        provider_voice_id = row.get("provider_voice_id")
        if isinstance(provider_voice_id, str):
            rows_by_voice_id[provider_voice_id] = row
    return rows_by_voice_id


def build_preview_text(display_name: str, description: str) -> str:
    clean_name = " ".join(display_name.split())
    clean_description = " ".join(description.split()).strip(" .")

    if clean_description:
        return f"Hey there, i'm {clean_name} . This voice is a {clean_description}"

    return f"Hey, this is the {clean_name} voice."


def build_preview_storage_path(provider: str, provider_voice_id: str) -> str:
    safe_provider = slugify_storage_segment(provider, fallback="provider")
    safe_voice = slugify_storage_segment(provider_voice_id, fallback="voice")
    digest = hashlib.sha1(
        f"{provider}:{provider_voice_id}".encode("utf-8")
    ).hexdigest()[:10]
    return f"voice-previews/{safe_provider}/{safe_voice}-{digest}.wav"


def slugify_storage_segment(value: str, *, fallback: str) -> str:
    normalized = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    slug = "".join(
        char.lower() if char.isalnum() else "-" for char in normalized.strip()
    ).strip("-")
    return slug or fallback


def build_public_storage_url(
    supabase_url: str, bucket: str, storage_path: str
) -> str:
    encoded_path = "/".join(parse.quote(part, safe="") for part in storage_path.split("/"))
    return (
        f"{supabase_url.rstrip('/')}/storage/v1/object/public/"
        f"{parse.quote(bucket, safe='')}/{encoded_path}"
    )


def synthesize_preview_audio(
    api_key_base64: str,
    *,
    voice_id: str,
    preview_text: str,
    preview_model: str,
    timeout_seconds: int,
) -> tuple[bytes, str]:
    response = request_json(
        f"{INWORLD_API_BASE_URL}/tts/v1/voice",
        method="POST",
        headers={
            "Authorization": f"Basic {api_key_base64}",
        },
        payload={
            "text": preview_text,
            "voiceId": voice_id,
            "modelId": preview_model,
            "audioConfig": {
                "audioEncoding": "LINEAR16",
                "sampleRateHertz": DEFAULT_SAMPLE_RATE_HERTZ,
            },
            "temperature": 1,
            "applyTextNormalization": "ON",
        },
        timeout_seconds=timeout_seconds,
    )

    audio_content = response.get("audioContent") if isinstance(response, dict) else None
    if not isinstance(audio_content, str) or not audio_content:
        raise SyncError(f"Inworld did not return audio content for voice {voice_id}")

    return (
        base64.b64decode(audio_content),
        "audio/wav",
    )


def upload_preview_audio(
    supabase_url: str,
    service_role_key: str,
    *,
    bucket: str,
    storage_path: str,
    audio_bytes: bytes,
    mime_type: str,
    timeout_seconds: int,
) -> str:
    encoded_path = "/".join(parse.quote(part, safe="") for part in storage_path.split("/"))
    upload_url = (
        f"{supabase_url.rstrip('/')}/storage/v1/object/"
        f"{parse.quote(bucket, safe='')}/{encoded_path}"
    )
    req = request.Request(
        upload_url,
        data=audio_bytes,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": mime_type,
            "x-upsert": "true",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            response.read()
    except error.HTTPError as exc:
        charset = exc.headers.get_content_charset("utf-8")
        details = exc.read().decode(charset, errors="replace")
        raise SyncError(
            f"Preview upload failed with status {exc.code}: {details}"
        ) from exc
    except error.URLError as exc:
        raise SyncError(f"Preview upload failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise SyncError(f"Preview upload timed out after {timeout_seconds}s") from exc
    except socket.timeout as exc:
        raise SyncError(f"Preview upload timed out after {timeout_seconds}s") from exc

    return build_public_storage_url(supabase_url, bucket, storage_path)


def public_url_exists(url: str, *, timeout_seconds: int) -> bool:
    req = request.Request(url, method="HEAD")

    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            return 200 <= response.status < 400
    except error.HTTPError as exc:
        # Supabase can return 400 for a missing public object on HEAD requests.
        # Treat both 400 and 404 as "not found" so we can generate the preview.
        if exc.code in (400, 404):
            return False
        raise SyncError(f"HEAD {url} failed with status {exc.code}") from exc
    except error.URLError as exc:
        raise SyncError(f"HEAD {url} failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise SyncError(f"HEAD {url} timed out after {timeout_seconds}s") from exc
    except socket.timeout as exc:
        raise SyncError(f"HEAD {url} timed out after {timeout_seconds}s") from exc


def normalize_voice(
    voice: dict[str, Any], *, provider: str, model: str | None
) -> dict[str, Any] | None:
    provider_voice_id = str(voice.get("voiceId") or "").strip()
    display_name = str(voice.get("displayName") or "").strip()
    lang_code = str(voice.get("langCode") or "").strip()

    if not provider_voice_id or not display_name:
        return None

    description = str(voice.get("description") or "").strip()
    tags = voice.get("tags")
    normalized_tags = [
        tag.strip()
        for tag in tags
        if isinstance(tag, str) and tag.strip()
    ] if isinstance(tags, list) else []

    return {
        "provider": provider,
        "provider_voice_id": provider_voice_id,
        "model": model or None,
        "display_name": display_name,
        "description": description,
        "lang_code": lang_code or None,
        "tags": normalized_tags,
        "source": str(voice.get("source") or "").strip() or None,
        "name": str(voice.get("name") or "").strip() or None,
        "preview_text": build_preview_text(display_name, description),
        "preview_audio_url": None,
        "preview_storage_path": None,
        "raw_payload": voice,
        "is_active": True,
    }


def insert_voice_rows(
    supabase_url: str,
    service_role_key: str,
    rows: list[dict[str, Any]],
    *,
    timeout_seconds: int,
) -> None:
    if not rows:
        return

    for start in range(0, len(rows), 200):
        request_json(
            f"{supabase_url.rstrip('/')}/rest/v1/voices",
            method="POST",
            headers={
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Prefer": "return=minimal",
            },
            payload=rows[start : start + 200],
            timeout_seconds=timeout_seconds,
        )


def update_voice_preview(
    supabase_url: str,
    service_role_key: str,
    *,
    provider: str,
    provider_voice_id: str,
    preview_text: str,
    preview_audio_url: str,
    preview_storage_path: str,
    timeout_seconds: int,
) -> None:
    query = parse.urlencode(
        {
            "provider": f"eq.{provider}",
            "provider_voice_id": f"eq.{provider_voice_id}",
        }
    )
    request_json(
        f"{supabase_url.rstrip('/')}/rest/v1/voices?{query}",
        method="PATCH",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Prefer": "return=minimal",
        },
        payload={
            "preview_text": preview_text,
            "preview_audio_url": preview_audio_url,
            "preview_storage_path": preview_storage_path,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        },
        timeout_seconds=timeout_seconds,
    )


def main() -> int:
    args = parse_args()
    env_path = Path(args.env_file).expanduser().resolve()
    load_env_file(env_path)

    inworld_api_key = require_env("INWORLD_API_KEY_BASE64")
    supabase_url = require_env("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = require_env("SUPABASE_SERVICE_ROLE_KEY")

    print(f"Loading Inworld voices using env file: {env_path}")
    inworld_voices = fetch_inworld_voices(
        inworld_api_key,
        timeout_seconds=args.timeout_seconds,
    )
    existing_voices = fetch_existing_voice_ids(
        supabase_url,
        service_role_key,
        args.provider,
        timeout_seconds=args.timeout_seconds,
    )

    missing_rows: list[dict[str, Any]] = []
    skipped_invalid = 0
    previews_generated = 0
    previews_skipped = 0
    previews_reused = 0
    preview_failures = 0

    preview_targets: list[dict[str, Any]] = []

    for voice in inworld_voices:
        row = normalize_voice(
            voice,
            provider=args.provider,
            model=args.model.strip() or None,
        )
        if row is None:
            skipped_invalid += 1
            continue

        existing_row = existing_voices.get(row["provider_voice_id"])

        if existing_row is None:
            missing_rows.append(row)

        should_generate_preview = not args.skip_preview_generation and (
            existing_row is None
            or not str(existing_row.get("preview_audio_url") or "").strip()
        )

        if should_generate_preview:
            preview_targets.append(
                {
                    "row": row,
                    "existing_row": existing_row,
                }
            )
        else:
            previews_skipped += 1

    total_preview_targets = len(preview_targets)

    for index, target in enumerate(preview_targets, start=1):
        row = target["row"]
        existing_row = target["existing_row"]
        preview_storage_path = build_preview_storage_path(
            row["provider"], row["provider_voice_id"]
        )
        preview_audio_url = build_public_storage_url(
            supabase_url, args.preview_bucket, preview_storage_path
        )
        progress_label = (
            f"{index}/{total_preview_targets}: {row['display_name']}"
        )

        try:
            preview_exists = False

            existing_preview_audio_url = (
                str(existing_row.get("preview_audio_url") or "").strip()
                if existing_row
                else ""
            )
            existing_preview_storage_path = (
                str(existing_row.get("preview_storage_path") or "").strip()
                if existing_row
                else ""
            )

            if existing_preview_audio_url:
                preview_exists = public_url_exists(
                    existing_preview_audio_url,
                    timeout_seconds=args.timeout_seconds,
                )
                if preview_exists:
                    row["preview_audio_url"] = existing_preview_audio_url
                    row["preview_storage_path"] = existing_preview_storage_path or preview_storage_path

            if not preview_exists:
                preview_exists = public_url_exists(
                    preview_audio_url,
                    timeout_seconds=args.timeout_seconds,
                )
                if preview_exists:
                    row["preview_audio_url"] = preview_audio_url
                    row["preview_storage_path"] = preview_storage_path

            if preview_exists:
                print(f"Using existing preview {progress_label}")
                previews_reused += 1
            else:
                print(f"Generating preview {progress_label}")

                if not args.dry_run:
                    audio_bytes, mime_type = synthesize_preview_audio(
                        inworld_api_key,
                        voice_id=row["provider_voice_id"],
                        preview_text=row["preview_text"],
                        preview_model=args.preview_model.strip() or DEFAULT_PREVIEW_MODEL,
                        timeout_seconds=args.timeout_seconds,
                    )

                    print(f"Uploading preview {progress_label}")
                    preview_audio_url = upload_preview_audio(
                        supabase_url,
                        service_role_key,
                        bucket=args.preview_bucket,
                        storage_path=preview_storage_path,
                        audio_bytes=audio_bytes,
                        mime_type=mime_type,
                        timeout_seconds=args.timeout_seconds,
                    )
                    row["preview_audio_url"] = preview_audio_url
                    row["preview_storage_path"] = preview_storage_path
                else:
                    print(f"Uploading preview {progress_label}")
                    row["preview_storage_path"] = preview_storage_path
                    row["preview_audio_url"] = preview_audio_url

                previews_generated += 1

            if existing_row is None:
                if not args.dry_run:
                    insert_voice_rows(
                        supabase_url,
                        service_role_key,
                        [row],
                        timeout_seconds=args.timeout_seconds,
                    )
                row["_persisted"] = True
                print(f"Updated DB {progress_label}")
            elif not args.dry_run and row.get("preview_audio_url") and row.get("preview_storage_path"):
                update_voice_preview(
                    supabase_url,
                    service_role_key,
                    provider=row["provider"],
                    provider_voice_id=row["provider_voice_id"],
                    preview_text=row["preview_text"],
                    preview_audio_url=row["preview_audio_url"],
                    preview_storage_path=row["preview_storage_path"],
                    timeout_seconds=args.timeout_seconds,
                )
                print(f"Updated DB {progress_label}")
            else:
                print(f"Updated DB {progress_label}")
        except SyncError as exc:
            preview_failures += 1
            print(f"Failed preview {progress_label}: {exc}", file=sys.stderr)
            continue

    print(f"Fetched voices from Inworld: {len(inworld_voices)}")
    print(f"Existing {args.provider} voices in DB: {len(existing_voices)}")
    print(f"Skipped invalid upstream voices: {skipped_invalid}")
    print(f"Missing voices to insert: {len(missing_rows)}")
    print(f"Previews generated or planned: {previews_generated}")
    print(f"Previews already present or skipped: {previews_skipped}")
    print(f"Previews reused from storage: {previews_reused}")
    print(f"Preview failures: {preview_failures}")

    if args.dry_run:
        for row in missing_rows[:10]:
            print(f"[dry-run] would insert {row['provider']}:{row['provider_voice_id']}")
        if len(missing_rows) > 10:
            print(f"[dry-run] ...and {len(missing_rows) - 10} more")
        return 0

    rows_remaining = [row for row in missing_rows if not row.get("_persisted")]

    if not missing_rows:
        print("No missing voices found. Nothing to insert.")
        return 0

    for row in rows_remaining:
        insert_voice_rows(
            supabase_url,
            service_role_key,
            [row],
            timeout_seconds=args.timeout_seconds,
        )

    print(f"Inserted {len(missing_rows)} new voices into public.voices")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SyncError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
