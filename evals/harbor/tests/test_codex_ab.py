import asyncio
import hashlib
from pathlib import Path
from types import SimpleNamespace

import pytest
from harbor.agents.installed.codex import Codex

from evals.harbor.agents.codex_ab import CodexUltraGuided, CodexVanilla


SOURCE_COMMIT = "ce3f5da4e6dca5fbeebece061976379835ba70b4"


def make_agent(agent_type, tmp_path: Path, **kwargs):
    source_commit = kwargs.pop("source_commit", SOURCE_COMMIT)
    return agent_type(
        logs_dir=tmp_path / agent_type.name(),
        model_name="openai/gpt-5.4",
        version="0.147.0",
        reasoning_effort="high",
        web_search="disabled",
        source_commit=source_commit,
        extra_env={
            "OPENAI_API_KEY": "test-only",
            "ULTRA_INSTINCT_PROFILE": "guided",
            "ULTRA_INSTINCT_STATE_DIR": "/tmp/ultra-instinct-state",
        },
        **kwargs,
    )


def test_conditions_share_harbor_codex_and_report_distinct_names(tmp_path):
    vanilla = make_agent(CodexVanilla, tmp_path)
    guided = make_agent(CodexUltraGuided, tmp_path)

    assert isinstance(vanilla, Codex)
    assert isinstance(guided, Codex)
    assert vanilla.name() == "codex-vanilla"
    assert guided.name() == "codex-ultra-guided"
    assert vanilla.version() == guided.version() == "0.147.0"
    assert vanilla.model_name == guided.model_name == "openai/gpt-5.4"
    assert vanilla.extra_env == guided.extra_env


def test_only_guided_registers_the_native_plugin_and_parent_mcp(tmp_path):
    mcp_server = SimpleNamespace(
        name="sample",
        transport="stdio",
        command="sample-server",
        args=["--stdio"],
    )
    vanilla = make_agent(CodexVanilla, tmp_path, mcp_servers=[mcp_server])
    guided = make_agent(CodexUltraGuided, tmp_path, mcp_servers=[mcp_server])

    vanilla_command = vanilla._build_register_mcp_servers_command()
    guided_command = guided._build_register_mcp_servers_command()

    assert "mcp_servers.sample" in vanilla_command
    assert "plugin marketplace add" not in vanilla_command
    assert "mcp_servers.sample" in guided_command
    assert "codex plugin marketplace add /opt/ultra-instinct --json" in guided_command
    assert "codex plugin add ultra-instinct@ultra-instinct --json" in guided_command


class CapturingEnvironment:
    def __init__(self):
        self.uploads = []

    async def upload_dir(self, source_dir, target_dir):
        source = Path(source_dir)
        files = {}
        for file in sorted(path for path in source.rglob("*") if path.is_file()):
            relative = file.relative_to(source).as_posix()
            files[relative] = hashlib.sha256(file.read_bytes()).hexdigest()
        self.uploads.append((target_dir, files))


def test_both_conditions_upload_the_identical_committed_plugin_snapshot(tmp_path):
    vanilla = make_agent(CodexVanilla, tmp_path)
    guided = make_agent(CodexUltraGuided, tmp_path)
    vanilla_environment = CapturingEnvironment()
    guided_environment = CapturingEnvironment()

    asyncio.run(vanilla._upload_plugin_snapshot(vanilla_environment))
    asyncio.run(guided._upload_plugin_snapshot(guided_environment))

    assert vanilla_environment.uploads == guided_environment.uploads
    target, files = vanilla_environment.uploads[0]
    assert target == "/opt/ultra-instinct"
    assert "plugin.json" in files
    assert ".codex-plugin/plugin.json" in files
    assert "hooks/hooks.json" in files
    assert "runtime/index.mjs" in files
    assert ".ultra-benchmark-source.json" in files


def test_source_commit_must_be_a_full_existing_commit(tmp_path):
    with pytest.raises(ValueError, match="full Git commit"):
        make_agent(CodexVanilla, tmp_path, source_commit="ce3f5da")

    agent = make_agent(
        CodexVanilla,
        tmp_path,
        source_commit="0000000000000000000000000000000000000000",
    )
    with pytest.raises(RuntimeError, match="archive Ultra source commit"):
        asyncio.run(agent._upload_plugin_snapshot(CapturingEnvironment()))
