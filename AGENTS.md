# AGENTS.md

## Codex Safety Guardrails

- Never redirect shell/search/grep/ripgrep output into source files.
- Never use `>` or `>>` to write into app source files.
- If a source file unexpectedly shrinks or its line count drops drastically, STOP and inspect before editing.
- Before editing a critical/shared file, compare the current file against git or the last valid version if anything looks suspicious.
- If a file is corrupted, restore from the last valid git version first, then reapply intended changes.
- For high-risk shared files, prefer minimal diffs and preserve recoverability.
- Do not silently overwrite a file that appears corrupted.
- If a requested change is tiny, avoid broad rewrites of the file.
- Prefer editing the smallest necessary region.
- When uncertain whether a file is the correct target, stop and report back instead of guessing.

## Panel/UI Consistency

- Reuse shared panel shell/body/footer primitives instead of ad hoc panel shells.
- Reuse shared row/action row patterns instead of custom per-panel layout markup.
- Do not duplicate panel styling locally when a shared primitive exists.
