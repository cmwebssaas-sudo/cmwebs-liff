# Context rotation

## Detect material context cost

Rotate the ChatGPT discussion and Codex task when any strong signal is present:

- the discussion contains a large multi-phase history with many screenshots or
  repeated evidence packets;
- interaction becomes noticeably slow or the model forgets the current phase,
  repeats completed work, or contradicts the repository twice;
- a compact current-state packet is substantially cheaper than carrying the existing
  history into the next work unit;
- Codex context has been compacted repeatedly or important evidence must be reread
  to recover the current objective;
- a new high-risk phase is starting and stale instructions could affect release or
  production safety.

Do not rotate merely because a fixed number of messages has elapsed. Rotate only
when a compact handoff preserves the necessary state more reliably.

## Build the rotation packet

Read the repository, tests, current ChatGPT reply, and local profile. Write a compact
packet to `.cmwebs-project-autopilot-handoff.local.md` containing:

```text
PROJECT:
CURRENT PHASE:
CURRENT OBJECTIVE:
REPOSITORY ROOT:
BRANCH AND WORKTREE:
COMPLETED EVIDENCE:
PENDING ACCEPTANCE CRITERIA:
SAFETY BOUNDARIES:
VALIDATION STATUS:
BLOCKERS OR APPROVALS:
NEXT SAFE ACTION:
SOURCE CHATGPT URL:
```

Never include secrets, tenant data, bank data, tokens, cookies, or copied full chat
history. Verify every state claim from current artifacts.

## Rotate ChatGPT inside the same project

1. Open the configured ChatGPT project, not the global new-chat page.
2. Keep the lowest available non-Pro mode selected.
3. Create one new discussion and send only the rotation packet plus the structured
   next-instruction request from `handoff-protocol.md`.
4. Verify that the new discussion belongs to the configured CMWebs project.
5. Record the new canonical URL and title in the ignored local profile. Move the old
   URL to `previous_chatgpt_thread_urls`.
6. Do not delete the old discussion.

## Rotate the Codex task

The user has authorized creation of a fresh Codex task when context cost becomes
material.

1. Finish writing and validating the local rotation packet.
2. Use the Codex project/thread tools: list projects, select this exact repository,
   then create one new local project task.
3. Start the new controller task with `gpt-5.6-terra`, medium reasoning, and standard
   speed. Use a lower-cost model only for isolated mechanical subtasks that cannot
   affect controller state or safety checks; follow `SKILL.md` for high-risk escalation.
4. Prompt the new task to invoke `$cmwebs-project-autopilot`, read the two ignored
   local files, verify the worktree, and continue the stated next safe action.
5. Do not run the old and new Codex tasks concurrently against the same dirty
   worktree. Stop work in the old task after dispatching the new task.
6. Do not archive or delete the old task automatically.

If new-task creation is unavailable, end with the exact resume prompt so the user can
create the task manually without reconstructing context.
