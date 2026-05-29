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


### Usage — installed extension (recommended)

Publisher **Winning**, extension **winning-azure-devops**. Install the `.vsix` in your organization (**Organization settings → Extensions → Shared**), then add the task to your pipeline:

```yaml
- task: SendTeamsTestNotification@1
  displayName: Notify Teams on test failures
  inputs:
    teamsWebhookUrl: $(TeamsWebhookUrl)
```

Other inputs use pipeline defaults (`buildId`, `organizationUri`, `projectName`, `language`, and so on).

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

### Usage — without installing the extension (template)

If you cannot install organization extensions, add [`templates/send-teams-test-notification.yml`](templates/send-teams-test-notification.yml) to **your** pipeline repository. The template clones the **public** GitHub repository over HTTPS, builds the task, and runs the core logic of the task from [`scripts/run-local.js`](scripts/run-local.js) in a **Bash** step.

```yaml
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
          - template: .azure-pipelines/send-teams-test-notification.yml
            parameters:
              teamsWebhookUrl: $(TeamsWebhookUrl)
```

Besides all the same inputs as the task, the template also supports:
* `toolkitRepoUrl` - The repo where it downloads the task from - default is `https://github.com/winningconsulting/winning-azure-devops.git`
* `toolkitRef` - The specific git reference (version) to download - default is `main`
* `toolkitDir` - to define the directory where it downloads the task from - default is `$(Agent.BuildDirectory)/winning-azure-devops`

### Contributing

Building the VSIX, running the task locally, previewing Adaptive Cards, and other maintainer workflows are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

### License

MIT — see [LICENSE](LICENSE).
