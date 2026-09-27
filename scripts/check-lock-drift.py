#!/usr/bin/env python3
"""
Assert that every exact pin in the lab engine's requirements.txt appears
identically in requirements.lock.txt.

The Dockerfile installs the LOCK, not requirements.txt. So bumping a pin in
requirements.txt without regenerating the lock silently builds the old tree -
a discrepancy that otherwise surfaces as a confusing runtime bug. This turns it
into a build failure instead.

Usage: python3 scripts/check-lock-drift.py
Exit:  0 when the two agree, 1 on drift or a missing file.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
REQUIREMENTS = REPO_ROOT / "services" / "lab-engine" / "requirements.txt"
LOCK = REPO_ROOT / "services" / "lab-engine" / "requirements.lock.txt"

# name, optional [extras], ==, version
PIN = re.compile(r"^(?P<name>[A-Za-z0-9_.-]+)(?:\[[^\]]*\])?==(?P<version>[^\s;#]+)")


def canonical(name: str) -> str:
    """
    PEP 503 normalization: package names are case-insensitive and treat -, _ and
    . as equivalent, so `PyYAML`, `pyyaml` and `typing_extensions` all compare
    correctly against however pip chose to spell them in the lock.
    """
    return re.sub(r"[-_.]+", "-", name).lower()


def read_pins(path: Path) -> dict[str, str]:
    """Map canonical package name -> pinned version, ignoring comments."""
    pins: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("-r"):
            continue
        match = PIN.match(line)
        if match:
            pins[canonical(match.group("name"))] = match.group("version")
    return pins


def main() -> int:
    missing = [p for p in (REQUIREMENTS, LOCK) if not p.is_file()]
    if missing:
        for path in missing:
            print(f"ERROR: missing {path.relative_to(REPO_ROOT)}", file=sys.stderr)
        return 1

    required = read_pins(REQUIREMENTS)
    locked = read_pins(LOCK)

    if not required:
        print("ERROR: no pins found in requirements.txt", file=sys.stderr)
        return 1

    drift: list[str] = []
    for name, version in sorted(required.items()):
        if name not in locked:
            drift.append(f"{name}=={version} is pinned in requirements.txt but absent from the lock")
        elif locked[name] != version:
            drift.append(f"{name} is {version} in requirements.txt but {locked[name]} in the lock")

    if drift:
        for line in drift:
            print(f"DRIFT: {line}", file=sys.stderr)
        print(
            "\nrequirements.txt and requirements.lock.txt disagree.\n"
            "Regenerate the lock - see the header of requirements.txt.",
            file=sys.stderr,
        )
        return 1

    print(f"OK: all {len(required)} requirements.txt pins match requirements.lock.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
