# Contributing

## Branches

Work happens on `dev`. `master` is the release branch and is updated by merging `dev`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/), with an optional scope:

```text
feat(follow-ups): add reschedule reason
fix: correct quotation query invalidation
docs: update backend API spec
refactor: extract tenant scope helper
chore: update dependencies
```

## Before Opening A PR

Run the checks for each side you touched:

```bash
# backend
npm run build
npm test

# frontend
npm run lint
npm run build
```

Then follow the side-specific checklist: [frontend PR checklist](frontend/docs/development-workflow.md#pr-checklist) and [backend feature delivery order](backend/docs/development-workflow.md#feature-delivery-order).

The PR description template is in [.github/pull_request_template.md](.github/pull_request_template.md).

## Documentation

- Every topic has one owning doc (see the index in the [README](README.md#documentation)). Update that doc in the same PR when you change routes, auth, Prisma models, environment variables, middleware order, or folder layout. Elsewhere, link to it rather than copying it.
- The repo holds **living docs only**. Keep these out of it:
  - Implementation plans and design drafts. Once the work ships, the code and the owning doc are the record.
  - Audit and security reports. Track open findings as issues.
  - Business documents (requirement specs, timelines, mind maps, `.docx`/`.pdf`/`.xmind`). Keep them in the shared drive.
