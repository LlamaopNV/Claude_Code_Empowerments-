# AspireApp1 - Template Project

## Project Overview

This is a **template project** used for bootstrapping other .NET Aspire applications. It provides a foundational structure for cloud-native, distributed applications built with .NET Aspire.

## Project Structure

This template includes:

- **AspireApp1.AppHost**: The Aspire orchestrator that manages service discovery, configuration, and coordination between components
- **AspireApp1.Server**: Backend API server project
- **frontend**: Frontend application (React/Vue/etc.)
- **AspireApp1.slnx**: Solution file

## Purpose

Use this template as a starting point for new .NET Aspire projects. It provides:
- Pre-configured project structure
- Aspire AppHost setup
- Separation of concerns (backend server + frontend)
- Ready-to-extend architecture

## Usage

When creating a new project from this template:
1. Clone or copy this template
2. Rename projects and namespaces appropriately
3. Update solution file references
4. Customize the AppHost configuration for your specific needs
5. Add your business logic to the Server project
6. Build your UI in the frontend project

## Architecture Notes

This follows .NET Aspire conventions for CQRS patterns, clean architecture, and best practices.

## Conventions

- **Path portability**: Configuration files must never contain absolute or hardcoded paths. Use relative references so they work on any machine.
- **Template source**: This `AspireApp1/` folder is copied directly as a template — there is no zip file. The template folder is the single source of truth.

## Agent Routing Rules

- **Next.js work** → Always use the `senior-frontend-dev` agent. Scope its context to only the Next.js client project. Do NOT pass backend or Aspire context to it.
- **Backend C# work** → Always use the `senior-backend-dev` agent. Use for CQRS handlers, APIs, validation, domain models, and architectural decisions.
- **Testing / TDD** → Always use the `senior-qa-engineer` agent. Launch BEFORE implementing new CQRS handlers to write tests first.

## Workflow Rules

### User Story Completion
After implementing a user story, **always update the spec file** (`Spec/Epics/<epic>/US-*.md`) with:
- Set `completed_on` date in frontmatter.
- Check all acceptance criteria (`- [ ]` → `- [x]`).
- Add an `## Implementation Details` section documenting: decisions made, files created, files modified, and pre-existing items that required no changes.

### User Story Sign-off Process
After implementing a user story, always follow this process in order:

1. **QA Agent verification** — Launch the QA Engineer agent to verify all acceptance criteria:
   - Check each criterion checkbox (`- [ ]` → `- [x]`) for criteria that pass.
   - Leave unchecked and add `<!-- QA: SKIP — requires runtime -->` for criteria that can't be verified statically.
   - Set `qa_agent_approved_on` in frontmatter.

2. **Coordinator signoff** — After QA approval, set `coordinator_signoff` in frontmatter.

3. **Frontmatter date fields** — ALL date fields must include full datetime with timezone (ISO 8601), e.g.:
   - `created_on: 2026-02-11T10:00:00+02:00`
   - `completed_on: 2026-02-11T11:02:00+02:00`
   - `qa_agent_approved_on: 2026-02-11T11:10:00+02:00`
   - `coordinator_signoff: 2026-02-11T11:14:58+02:00`
