# Contributing

Thanks for helping improve **winning-azure-devops**. This guide covers building the task, packaging the extension, and running it locally without a full pipeline.

## Development setup

```bash
cd SendTeamsTestNotification
npm ci
npm run build
npm test
```

From the repository root you can also run:

```bash
npm run build
npm test
```

## Package the extension (VSIX)

Publisher **Winning**, extension **winning-azure-devops**.

```powershell
npm run package:extension
```

Requires [TFX CLI](https://github.com/microsoft/tfs-cli) (`npm install -g tfx-cli`). Upload the generated `.vsix` under **Organization settings → Extensions → Shared**.

## Run the task locally

The template path uses [`scripts/run-local.js`](scripts/run-local.js) on the agent; you can use the same script on your machine to hit real Azure DevOps test results and optionally post to Teams.

1. Copy [`.env.example`](.env.example) to `.env.local`.
2. Set `TEAMS_WEBHOOK_URL`, `ADO_PAT`, `ORGANIZATION_URI`, `PROJECT_NAME`, and `BUILD_ID` (optional: `LANGUAGE`, `CARD_TITLE`, `DEBUG_MODE`, `TEAMS_OPEN_ATTACHMENTS_PANE`, `NOTIFY_ON_SUCCESS`).
3. Build and run:

```bash
npm run build
npm run start:local -- --buildId 12345
```

Use a Personal Access Token with at least **Build (Read)** and **Test Management (Read)** in `ADO_PAT` (instead of the pipeline `System.AccessToken`).

VS Code: **Run Teams notification task (local)** in [`.vscode/launch.json`](.vscode/launch.json) loads `.env.local` and runs `run-local.js`.

## Preview Adaptive Card layouts

Generate card JSON for local viewers without calling Teams or Azure DevOps (embedded fake scenarios):

```bash
npm run build
npm run preview:card -- --list-scenarios
npm run preview:card -- --scenario failure-truncated -o adaptive-card.preview.json
```

Use `--buildId <id>` with `.env.local` credentials for a real build, or `--teams` for the full webhook payload envelope.

Scenario definitions live in [`scripts/preview-card-fixtures.js`](scripts/preview-card-fixtures.js).
