#!/usr/bin/env python3
"""Validate the specification dossier, without claiming CPC runtime tests."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []


def repository_files(suffix: str) -> list[Path]:
    ignored = {'.git', '.cache', '.venv', 'node_modules', 'out', 'dist', 'coverage', '__pycache__'}
    files: list[Path] = []
    for directory, directories, names in os.walk(ROOT):
        directories[:] = [name for name in directories if name not in ignored]
        files.extend(Path(directory) / name for name in names if name.endswith(suffix))
    return sorted(files)


def problem(path: Path, message: str) -> None:
    ERRORS.append(f"{path.relative_to(ROOT)}: {message}")


def read_json(path: Path) -> object | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeError) as exc:
        problem(path, f"invalid JSON: {exc}")
        return None


def check_markdown() -> int:
    files = repository_files(".md")
    for path in files:
        text = path.read_text(encoding="utf-8")
        inside_fence = False
        prose: list[str] = []
        for line in text.splitlines():
            if line.lstrip().startswith("```"):
                inside_fence = not inside_fence
            elif not inside_fence:
                prose.append(line)
        if inside_fence:
            problem(path, "unclosed fenced block")
        for destination in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", "\n".join(prose)):
            parsed = urlsplit(destination.strip().split(' "', 1)[0])
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            target = (path.parent / unquote(parsed.path)).resolve()
            if not target.is_relative_to(ROOT):
                problem(path, f"link outside repository: {destination}")
            elif not target.exists():
                problem(path, f"missing local link: {destination}")
    return len(files)


def check_traceability() -> tuple[int, int]:
    registry = ROOT / "docs/specifications/01-exigences-fonctionnelles.md"
    recipe = ROOT / "docs/specifications/11-qualite-recette.md"
    requirements = re.findall(r"^\| (REQ-[A-Z]+-\d{3}) \|", registry.read_text(), re.M)
    scenarios = re.findall(r"^\| (ACC-\d{2}) \|", recipe.read_text(), re.M)
    for path, identifiers in ((registry, requirements), (recipe, scenarios)):
        for identifier, count in Counter(identifiers).items():
            if count != 1:
                problem(path, f"duplicate definition: {identifier}")
        if not identifiers:
            problem(path, "no identifier definitions found")
    known_requirements, known_scenarios = set(requirements), set(scenarios)
    for path in repository_files(".md"):
        text = path.read_text()
        for identifier in set(re.findall(r"REQ-[A-Z]+-\d{3}", text)):
            if identifier not in known_requirements:
                problem(path, f"unknown requirement: {identifier}")
        for identifier in set(re.findall(r"ACC-\d{2}", text)):
            if identifier not in known_scenarios:
                problem(path, f"unknown acceptance scenario: {identifier}")
    for line in registry.read_text().splitlines():
        if re.match(r"^\| REQ-", line) and not re.search(r"ACC-\d{2}", line):
            problem(registry, f"requirement without acceptance scenario: {line}")
    return len(requirements), len(scenarios)


def check_project(path: Path, project: dict) -> None:
    all_ids: list[str] = []
    all_paths: list[str] = []
    names: list[str] = []
    source_ids: set[str] = set()
    for category in ("sources", "assets", "documents"):
        for item in project.get(category, []):
            all_ids.append(item["id"])
            relative = item["path"]
            all_paths.append(relative.casefold())
            expected_prefix = {"sources": "src/", "assets": "assets/", "documents": "documents/"}[category]
            target = (path.parent / relative).resolve()
            if not relative.startswith(expected_prefix) or not target.is_relative_to(path.parent.resolve()):
                problem(path, f"invalid contained path: {relative}")
                continue
            if not target.is_file():
                problem(path, f"missing declared file: {relative}")
                continue
            if "sha256" in item and hashlib.sha256(target.read_bytes()).hexdigest() != item["sha256"]:
                problem(path, f"hash mismatch: {relative}")
            if "cpcName" in item:
                names.append(item["cpcName"].casefold())
            if category == "sources":
                source_ids.add(item["id"])
                raw = target.read_bytes()
                if b"\r" in raw or raw.startswith(b"\xef\xbb\xbf"):
                    problem(path, f"noncanonical source (LF/no BOM required): {relative}")
                if project["build"]["textEncoding"] == "ascii-strict":
                    try:
                        raw.decode("ascii")
                    except UnicodeError:
                        problem(path, f"example source cannot use ascii-strict: {relative}")
                numbers: list[int] = []
                for line in raw.decode("utf-8").splitlines():
                    if not line.strip():
                        continue
                    match = re.match(r"^(\d+)\s+\S", line)
                    if not match:
                        problem(path, f"unnumbered example line in {relative}: {line}")
                        continue
                    numbers.append(int(match.group(1)))
                if numbers != sorted(set(numbers)) or any(n < 1 or n > 65535 for n in numbers):
                    problem(path, f"invalid line numbering in {relative}")
            if category == "assets" and item["loadAddress"] + item["length"] > 65536:
                problem(path, f"asset outside 16-bit memory: {relative}")
    if project.get("entryPoint") not in source_ids:
        problem(path, "entry point is not a source id")
    for label, values in (("id", all_ids), ("path", all_paths), ("CPC filename", names)):
        for value, count in Counter(values).items():
            if count != 1:
                problem(path, f"duplicate {label}: {value}")


def check_proposal(path: Path, proposal: dict) -> None:
    base = ROOT / "examples/hello-cpc"
    operations = proposal.get("operations", [])
    paths = [operation["path"].casefold() for operation in operations]
    if len(paths) != len(set(paths)):
        problem(path, "duplicate operation paths")
    if sum(len(operation["content"].encode("utf-8")) for operation in operations) > 1048576:
        problem(path, "proposal text exceeds total byte limit")
    for operation in operations:
        target = (base / operation["path"]).resolve()
        if not target.is_relative_to(base.resolve()):
            problem(path, "proposal path outside base")
        elif operation["kind"] == "replace":
            if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != operation["baseSha256"]:
                problem(path, f"proposal base hash mismatch: {operation['path']}")
        elif target.exists():
            problem(path, f"create requires absent path: {operation['path']}")


def check_corpus(path: Path, catalog: dict) -> None:
    ids: list[str] = []
    for item in catalog.get("sources", []):
        ids.append(item["id"])
        target = (path.parent / item["path"]).resolve()
        if not target.is_relative_to(path.parent.resolve()) or not target.is_file():
            problem(path, f"missing or uncontained corpus source: {item['path']}")
            continue
        raw = target.read_bytes()
        if len(raw) != item["bytes"] or hashlib.sha256(raw).hexdigest() != item["sha256"]:
            problem(path, f"corpus bytes/hash mismatch: {item['path']}")
    if len(ids) != len(set(ids)) or len(ids) != 3:
        problem(path, "initial corpus must identify the three distinct supplied sources")


def check_agent_task(path: Path, task: dict, data: dict[Path, object]) -> None:
    project = data.get(ROOT / "examples/hello-cpc/microide.project.json", {})
    catalog = data.get(ROOT / "knowledge/locomotive-basic/catalog.json", {})
    if task.get("projectId") != project.get("projectId"):
        problem(path, "agent task projectId does not match example project")
    if task.get("corpusVersion") != catalog.get("corpusVersion"):
        problem(path, "agent task corpusVersion does not match corpus")
    scope = task.get("scope", {})
    if not set(scope.get("transmitPrefixes", [])).issubset(set(scope.get("readPrefixes", []))):
        problem(path, "transmission scope exceeds read scope")
    document_ids = {item["id"] for item in project.get("documents", [])}
    if not set(scope.get("documentIds", [])).issubset(document_ids):
        problem(path, "task references absent context documents")
    if task.get("kind") == "illustrative" and task.get("status") != "prepared":
        problem(path, "illustrative task must not claim execution")


def check_schemas(data: dict[Path, object]) -> int:
    try:
        from jsonschema import Draft202012Validator, FormatChecker
    except ImportError:
        ERRORS.append("Install scripts/requirements-docs.txt to use --schemas")
        return 0
    contracts = {
        "project": ROOT / "contracts/project.schema.json",
        "proposal": ROOT / "contracts/ai-proposal.schema.json",
        "build": ROOT / "contracts/build-report.schema.json",
        "task": ROOT / "contracts/agent-task.schema.json",
        "test-suites": ROOT / "contracts/basic-test-suites.schema.json",
    }
    validators = {}
    for key, path in contracts.items():
        schema = data[path]
        try:
            Draft202012Validator.check_schema(schema)
            validators[key] = Draft202012Validator(schema, format_checker=FormatChecker())
        except Exception as exc:
            problem(path, f"invalid schema: {exc}")
    examples = [(p, "project") for p in ROOT.glob("examples/**/microide.project.json")]
    examples.extend([(ROOT / "examples/ai-proposal.json", "proposal"), (ROOT / "examples/build-report.json", "build"), (ROOT / "examples/agent-task.json", "task")])
    examples.extend((p, "test-suites") for p in ROOT.glob("examples/**/microide.tests.json"))
    count = 0
    for path, key in examples:
        if key not in validators or data.get(path) is None:
            continue
        for error in sorted(validators[key].iter_errors(data[path]), key=lambda e: str(e.path)):
            location = "/".join(str(part) for part in error.path) or "root"
            problem(path, f"{location}: {error.message}")
        count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schemas", action="store_true", help="validate Draft 2020-12 contracts with jsonschema")
    args = parser.parse_args()
    markdown_count = check_markdown()
    requirement_count, scenario_count = check_traceability()
    data = {path: read_json(path) for path in repository_files(".json")}
    for path, value in data.items():
        if path.name == "microide.project.json" and isinstance(value, dict):
            check_project(path, value)
    proposal_path = ROOT / "examples/ai-proposal.json"
    if isinstance(data.get(proposal_path), dict):
        check_proposal(proposal_path, data[proposal_path])
    corpus_path = ROOT / "knowledge/locomotive-basic/catalog.json"
    if isinstance(data.get(corpus_path), dict):
        check_corpus(corpus_path, data[corpus_path])
    task_path = ROOT / "examples/agent-task.json"
    if isinstance(data.get(task_path), dict):
        check_agent_task(task_path, data[task_path], data)
    validated_count = check_schemas(data) if args.schemas else 0
    if ERRORS:
        for error in ERRORS:
            print(f"ERROR {error}", file=sys.stderr)
        return 1
    print(f"OK: {markdown_count} Markdown files, {len(data)} JSON files, {requirement_count} requirements, {scenario_count} acceptance scenarios.")
    if args.schemas:
        print(f"OK: 5 Draft 2020-12 schemas and {validated_count} examples validated.")
    print("CPC execution, disk compatibility and application performance have not been tested by this check.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
