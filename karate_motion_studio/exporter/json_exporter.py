"""
JSON Exporter for Bunkai Explorer.
Exports Capture JSON, Retargeted Animation JSON, and Modular Split Layers (Upper/Lower/In-Place).
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Dict, Any

from core.project_schema import KarateMotionProject
from exporter.modular_clip_splitter import export_modular_layers, split_retargeted_json


def export_capture_file(project: KarateMotionProject, output_path: Path | str) -> str:
    """Exports clean Capture JSON to disk."""
    data = project.export_capture_json()
    p = Path(output_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return str(p)


def export_retargeted_file(project: KarateMotionProject, output_path: Path | str) -> str:
    """Exports clean Retargeted Animation JSON to disk ready for Three.js."""
    data = project.export_retargeted_json()
    p = Path(output_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return str(p)


def export_modular_layer_files(project: KarateMotionProject, output_dir: Path | str, base_name: str) -> Dict[str, str]:
    """Exports modular layers (Full, Lower Stance In-Place, Upper Technique) for Three.js modular engine."""
    return export_modular_layers(project, output_dir, base_name, zero_horizontal_root=True)
