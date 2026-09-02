# Review findings

## [P1] Install the optional dev extra before invoking pytest

**Location:** `README.md:15-16`

The project declares pytest, pytest-cov, pytest-asyncio, and ruff under `[project.optional-dependencies].dev`, but `uv sync --dev` installs dependency groups rather than that optional extra. On a clean checkout it installs only the 28 runtime packages, so the immediately following `uv run pytest` cannot find pytest. `uv sync --extra dev` installs all 36 packages, including the test and lint tools. Change this command to `uv sync --extra dev`; `backend/README.md` contains the same pre-existing command and should be aligned as well.

## [P1] Remove or migrate the conflicting Cerebras agent skill

**Location:** `planning/PLAN.md:281-283`

The plan now requires the OpenAI SDK and `OPENAI_API_KEY`, but the tracked `.claude/skills/cerebras/SKILL.md` still tells coding agents working on any LLM integration to install LiteLLM, require `OPENROUTER_API_KEY`, and call an OpenRouter/Cerebras model. That skill's description directly matches the future chat implementation work, so an agent following repository instructions can implement the old provider despite the revised plan. Delete the obsolete skill or replace it with direct-OpenAI instructions as part of this migration.

## [P2] Exclude the generated review from the Stop-hook review scope

**Location:** `.claude/settings.json:13`

The hook asks Codex to review every change since `HEAD` while creating `planning/REVIEW.md`. After the first run, that generated file is itself an uncommitted change, so every later Stop event reviews and rewrites the prior report even when no source or planning file changed. This causes perpetual dirty-worktree churn and allows stale generated prose to influence the next review. Explicitly exclude `planning/REVIEW.md` from the review scope and skip the invocation when it is the only changed path. Apply the same correction to `independent-reviewer/hooks/hooks.json`.

## [P2] Do not register the same Stop hook twice

**Location:** `independent-reviewer/hooks/hooks.json:3-11`

The plugin contains the exact Stop command already registered in the repository's `.claude/settings.json`. Once `independent-reviewer` is installed/enabled in this project, Claude loads both configurations and launches two independent `codex exec` processes at each Stop. Both processes then race to overwrite the same `planning/REVIEW.md`, while doubling review cost and latency; the final file is whichever process finishes last. Keep the hook in either the project settings or the plugin, or add mutual-exclusion/locking if both deployment modes must remain.

## Verification

- Inspected all tracked and untracked changes reported by `git status` against `HEAD` (`14550e1`).
- `git diff --check HEAD` passes.
- All three changed/new JSON configuration files parse successfully.
- Compared `uv sync --dry-run --dev` with `uv sync --dry-run --extra dev` using uv 0.12.0; only the latter includes pytest, pytest-cov, pytest-asyncio, and ruff.
- No application tests were run because the changed files contain documentation and agent/hook configuration only.
