<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. `context/project-overview.md` — who this is for, what problem it solves, scope, success criteria, constraints
2. `context/user-flows.md` — how users move through the product, including edge cases and error paths
3. `context/ui-context.md` — design language, tokens, component inventory, interaction states, copy rules
4. `context/architecture-context.md` — stack, project tree, system boundaries, storage model, invariants
5. `context/tech-spec.md` — data models (all 7 tables, fields, business rules), database indexes, environment variables
6. `context/code-standards.md` — implementation rules specific to this project's stack
7. `context/ai-workflow-rules.md` — how to scope, split, and deliver work
8. `context/progress-tracker.md` — current phase, active goal, completed work, open questions

## Rules

- Update `context/progress-tracker.md` after every meaningful implementation change.
- If implementation changes the architecture, scope, or UI system, update the relevant context file before continuing.
- Do not modify `components/ui/*` (shadcn/ui) unless a task explicitly requires it.
- If a requirement is ambiguous or missing, add it as an open question in `progress-tracker.md` — do not invent behavior.
