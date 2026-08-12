"""Pinned Codex A/B conditions for the Ultra Instinct Harbor benchmark."""

import json
import re
import subprocess
import tarfile
import tempfile
from pathlib import Path
from typing import ClassVar, override

from harbor.agents.installed.codex import Codex
from harbor.environments.base import BaseEnvironment


_REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
_REMOTE_PLUGIN_ROOT = "/opt/ultra-instinct"
_SOURCE_MARKER = ".ultra-benchmark-source.json"


class _CodexAB(Codex):
    """Shared Codex implementation; subclasses only select plugin registration."""

    _ENABLE_ULTRA: ClassVar[bool] = False

    def __init__(self, *args, source_commit: str, **kwargs):
        if not isinstance(source_commit, str) or not re.fullmatch(
            r"[a-f0-9]{40}", source_commit
        ):
            raise ValueError("source_commit must be a full Git commit SHA.")
        self.source_commit = source_commit
        super().__init__(*args, **kwargs)

    def _create_plugin_snapshot(self, destination: Path) -> None:
        archive_path = destination.parent / "ultra-instinct.tar"
        result = subprocess.run(
            [
                "git",
                "-C",
                str(_REPOSITORY_ROOT),
                "archive",
                "--format=tar",
                f"--output={archive_path}",
                self.source_commit,
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError("Could not archive Ultra source commit.")

        destination.mkdir(mode=0o700)
        with tarfile.open(archive_path, mode="r") as archive:
            archive.extractall(destination, filter="data")
        archive_path.unlink()

        required = [
            destination / "plugin.json",
            destination / ".codex-plugin/plugin.json",
            destination / "hooks/hooks.json",
            destination / "runtime/index.mjs",
        ]
        if any(not file.is_file() for file in required):
            raise RuntimeError("Archived Ultra source is missing required plugin files.")

        plugin_manifest = json.loads((destination / "plugin.json").read_text())
        if plugin_manifest.get("name") != "ultra-instinct":
            raise RuntimeError("Archived source is not the Ultra Instinct plugin.")
        (destination / _SOURCE_MARKER).write_text(
            json.dumps(
                {
                    "sourceCommit": self.source_commit,
                    "harborVersion": "0.16.1",
                },
                sort_keys=True,
                separators=(",", ":"),
            )
            + "\n"
        )

    async def _upload_plugin_snapshot(self, environment: BaseEnvironment) -> None:
        with tempfile.TemporaryDirectory(prefix="ultra-harbor-source-") as temporary:
            snapshot = Path(temporary) / "source"
            self._create_plugin_snapshot(snapshot)
            await environment.upload_dir(snapshot, _REMOTE_PLUGIN_ROOT)

    @override
    async def setup(self, environment: BaseEnvironment) -> None:
        await super().setup(environment)
        await self.exec_as_root(
            environment,
            command=f"mkdir -p {_REMOTE_PLUGIN_ROOT}",
        )
        await self._upload_plugin_snapshot(environment)

    @override
    def _build_register_mcp_servers_command(self) -> str | None:
        parent = super()._build_register_mcp_servers_command()
        if not self._ENABLE_ULTRA:
            return parent
        plugin = (
            f"codex plugin marketplace add {_REMOTE_PLUGIN_ROOT} --json && "
            "codex plugin add ultra-instinct@ultra-instinct --json"
        )
        return "\n".join(command for command in [parent, plugin] if command)


class CodexVanilla(_CodexAB):
    """True control: the Ultra source is present but not registered."""

    @staticmethod
    @override
    def name() -> str:
        return "codex-vanilla"


class CodexUltraGuided(_CodexAB):
    """Treatment: install the native Ultra plugin under the guided profile."""

    _ENABLE_ULTRA = True

    @staticmethod
    @override
    def name() -> str:
        return "codex-ultra-guided"
