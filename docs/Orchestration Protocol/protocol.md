## Orchestrator protocol

### Mandatory reading order

Before planning or delegating any task:

1. Read `AGENTS.md`.
2. Read the current task spec completely.
3. Read `docs/workspace-team.md`.
4. Read only the relevant sections of the product documentation.
5. Inspect the related source code, configuration, package scripts, and Git status.

Use this precedence when information conflicts:

1. Latest explicit user decision.
2. Safety and repository rules from `AGENTS.md`.
3. Approved task spec.
4. Product and architecture documentation.
5. Existing implementation as evidence of current behavior.

Documentation describes the intended behavior. Source code describes the current
behavior. Report divergences instead of silently choosing one.

### Spec readiness gate

Do not delegate implementation until the spec contains:

- Objective and expected outcome.
- In-scope and out-of-scope behavior.
- Verifiable acceptance criteria.
- Affected modules or surfaces.
- Dependencies and execution order.
- Approved decisions and unresolved questions.
- Required validations.
- Expected documentation changes.

If essential information is missing, ask the user before working on the affected
part. Independent and unambiguous work may continue.

### Maestri delegation

- Run `maestri list` before delegating and use the exact connected agent names.
- Delegate according to the responsibilities in `docs/workspace-team.md`.
- Every assignment must include:
  - Objective and reason.
  - Exact scope and allowed files.
  - Relevant documentation and spec references.
  - Explicit non-goals.
  - Acceptance criteria.
  - Required commands and validations.
  - Expected handoff format.
  - Whether commits are authorized.
- Use batch delegation only for independent tasks with non-overlapping ownership.
- If an agent times out, use `maestri check`; do not send the same task again.
- Do not interrupt or replace an agent that is still working without identifying
  the current state of its work.

### Ownership and concurrent work

- Assign one active writer per file.
- Do not allow agents to edit the same files simultaneously.
- Before delegation, inspect the working tree and identify existing changes.
- Treat existing changes as user-owned unless their origin is known.
- Backend and frontend work may run concurrently only when contracts are already
  defined and file ownership does not overlap.
- Documentation that depends on unfinished implementation must wait for the
  implementation handoff.
- The Git Manager must not stage or commit files while another agent is still
  editing them.
- Stage explicit paths; do not use broad staging commands that may include
  unrelated work.

### Task status

Use the following transitions:

- `Backlog`: spec not ready or not prioritized.
- `A fazer`: spec ready and acceptance criteria defined.
- `Em andamento`: owner assigned and work started.
- `Revisão`: implementation handoff received and validation started.
- `Feito`: acceptance criteria independently verified and required commits
  created.

Do not mark a task as `Feito` based only on the implementer's report.

To preserve the existing workflow, represent blockers with `blocked: true`,
`blockedReason`, and `blockedAt` instead of introducing another status.

### Review and validation

- Use a different agent to review implementation when practical.
- A reviewer is read-only unless explicitly authorized to fix findings.
- Validate each acceptance criterion with concrete evidence.
- Discover available scripts before running commands.
- Distinguish new failures from pre-existing failures.
- Never report a build, test, lint, migration, or browser check as successful
  unless it was actually executed.
- Reopen authoritative files and Git state before reporting completion.

### Agent handoff

Every delegated agent must return:

- Summary of completed work.
- Files created, modified, or removed.
- Acceptance criteria covered.
- Commands executed and their results.
- Decisions and assumptions made.
- Errors, skipped checks, and residual risks.
- Current Git status.
- Commit hashes, when commits were authorized.

The orchestrator consolidates the handoffs and reports one final result to the
user instead of forwarding independent agent responses.

### Git coordination

- Use one `feature/name` branch per task spec.
- Create the branch before implementation starts.
- Keep commits focused on one task and exclude unrelated changes.
- Use Conventional Commits in English.
- Ask before pushing, merging, deploying, installing dependencies, changing the
  database schema, or running migrations.
- The Git Manager acts only after implementation and review agents finish their
  handoffs.