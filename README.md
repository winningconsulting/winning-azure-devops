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

### Usage — without installing the extension (template)

If you cannot install organization extensions, check out this repository in the pipeline and run the task via the included YAML template (same behavior as the extension task).

The template builds the task from source and runs it through `scripts/run-local.js` in a **Bash** step, so the pipeline must expose the build’s OAuth token to that script. Enable **Allow scripts to access the OAuth token** on the job; the template maps `$(System.AccessToken)` to `SYSTEM_ACCESSTOKEN` for the script (you do not need a separate `env` block in your YAML unless you customize the template).

Reference the public GitHub repo (create a **GitHub** service connection in Azure DevOps if needed; it can access public repositories):

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
```

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

### Contributing

Building the VSIX, running the task locally, previewing Adaptive Cards, and other maintainer workflows are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

### License

MIT — see [LICENSE](LICENSE).
