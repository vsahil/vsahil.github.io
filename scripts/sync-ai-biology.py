#!/usr/bin/env python3
"""Refresh the website snapshot from the authoritative local reading library."""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("library", type=Path, help="Folder containing the library's build.py")
args = parser.parse_args()
source = args.library.expanduser().resolve()
if not (source / "build.py").is_file():
    parser.error("The library folder must contain build.py")
subprocess.run([sys.executable, str(source / "build.py")], cwd=source, check=True)
destination = Path(__file__).resolve().parents[1] / "ai-for-biology" / "index.html"
destination.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source / "index.html", destination)
print(f"Updated {destination}. Build and publish the website to make these notes live.")
