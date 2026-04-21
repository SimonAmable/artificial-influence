#!/usr/bin/env python3
"""Backward-compatible wrapper for the multi-provider voice sync script."""

from __future__ import annotations

from pathlib import Path
import runpy
import sys


if __name__ == "__main__":
    if "--provider" not in sys.argv:
        sys.argv.extend(["--provider", "inworld"])

    runpy.run_path(
        str(Path(__file__).with_name("sync_voices.py")),
        run_name="__main__",
    )
