# winning-azure-devops

**Winning** toolkit for Azure Pipelines — custom tasks and YAML templates.

## Send Teams test notification

Cross-platform task ([`SendTeamsTestNotification`](SendTeamsTestNotification/)) that posts a Microsoft Teams **Adaptive Card** when a build has **failed** or **inconclusive** tests. By default it does **not** post when all tests pass; set `notifyOnSuccess: true` to also send a success card.

Built with [azure-pipelines-task-lib](https://github.com/microsoft/azure-pipelines-task-lib).

### Create a Teams incoming webhook URL

1. In Microsoft Teams, open the channel where notifications should appear.
2. Select **⋯** next to the channel name → **Connectors** (or **Workflows** / **Incoming Webhook**, depending on your Teams client).
3. Search for **Webhook** and add/configure according to your needs.
4. Copy the webhook URL (starts with `https://`).

Store the URL in Azure DevOps as a **secret variable** (for example `TeamsWebhookUrl`) or in a variable group. Do not commit it to the repository.

Official reference: [Send messages in Teams using incoming webhooks](https://support.microsoft.com/en-US/Workflows/send-messages-in-teams-using-incoming-webhooks).

### Pipeline authentication (Azure DevOps Test API)

The task reads test results from the Azure DevOps REST API. In YAML pipelines:

```yaml
jobs:
  - job: notify
    steps:
      # ...
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```

Enable **Allow scripts to access the OAuth token** on the job (classic UI: job → additional options).

For **local** runs, use a Personal Access Token with at least **Build (Read)** and **Test Management (Read)** in `ADO_PAT` (see below).

### Task inputs

| Input | Required | Default | Description |
|--------|----------|---------|-------------|
| `teamsWebhookUrl` | Yes | — | Teams incoming webhook URL (secret) |
| `buildId` | Yes | `$(Build.BuildId)` | Build to inspect |
| `organizationUri` | Yes | `$(System.TeamFoundationCollectionUri)` | Collection URL |
| `projectName` | Yes | `$(System.TeamProject)` | Project name |
| `language` | No | `en` | `en` or `pt-PT` (text of the published notification) |
| `cardTitle` | No | — | Override card title (localized default if empty) |
| `openAttachmentsPane` | No | `false` | Per-test links send directly to the attachments pane |
| `debugMode` | No | `false` | Print full notification JSON to the console (still POSTs unless skipped by policy) |
| `notifyOnSuccess` | No | `false` | Also POST when all tests passed |

### Usage A — template from this repository

Reference the public GitHub repo in your pipeline (create a **GitHub** service connection in Azure DevOps if you do not have one; it can access public repositories), then include the template:

```yaml
resources:
  repositories:
    - repository: winningAzureDevOpsLibrary
      type: github
      name: winningconsulting/winning-azure-devops
      endpoint: YourGitHubServiceConnection  # name of the GitHub service connection in your project
      ref: refs/heads/main  # optional: pin branch or tag

stages:
  - stage: Test
    jobs:
      - job: RunTests
        steps:
          - checkout: self
          # ... run tests ...

      - job: NotifyTeams
        dependsOn: RunTests
        condition: failed()

        variables:
          TeamsWebhookUrl: $(TeamsWebhookUrl)  # secret
        steps:
          - checkout: winningAzureDevOpsLibrary
          - template: templates/send-teams-test-notification.yml@winningAzureDevOpsLibrary
            parameters:
              teamsWebhookUrl: $(TeamsWebhookUrl)
              buildId: $(Build.BuildId)
              organizationUri: $(System.TeamFoundationCollectionUri)
              projectName: $(System.TeamProject)
            env:
              SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```   

### Usage B — installed extension (private VSIX)

Publisher **Winning**, extension **winning-azure-devops**. After installing the `.vsix` in your organization:

```yaml
- task: Winning.winning-azure-devops.SendTeamsTestNotification@1
  inputs:
    teamsWebhookUrl: $(TeamsWebhookUrl)
```

Package the extension:

```powershell
npm run package:extension
```

Requires [TFX CLI](https://github.com/microsoft/tfs-cli) (`npm install -g tfx-cli`). Upload the generated `.vsix` under **Organization settings → Extensions → Shared**.

### Local testing

1. Copy [`.env.example`](.env.example) to `.env.local` and set `TEAMS_WEBHOOK_URL`, `ADO_PAT`, `ORGANIZATION_URI`, `PROJECT_NAME`, and `BUILD_ID` (optional: `LANGUAGE`, `CARD_TITLE`, `DEBUG_MODE`, `TEAMS_OPEN_ATTACHMENTS_PANE`, `NOTIFY_ON_SUCCESS`).
2. Build and run via [`scripts/run-local.js`](scripts/run-local.js) (same entry point as the pipeline template):

```bash
npm run build
npm run start:local -- --buildId 12345
```

Or run unit tests without calling Teams/ADO:

```bash
npm test
```

VS Code: use **Run Teams notification task (local)** in `.vscode/launch.json` (loads `.env.local`, runs `run-local.js`).

### Development

```bash
cd SendTeamsTestNotification
npm ci
npm run build
npm test
```

### License

MIT — see [LICENSE](LICENSE).
