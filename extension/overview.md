# Winning Azure DevOps

Corporate extension for **Winning** pipelines.

## Send Teams test notification

Posts a Microsoft Teams Adaptive Card with the results of failed or inconclusive tests. Optionally notify when all tests passed (`notifyOnSuccess`).

Configure a Teams **incoming webhook** URL as a secret pipeline variable and enable **Allow scripts to access the OAuth token** on the job.

See the repository [README](../README.md) for setup, localization (`en` / `pt-PT`), and local testing.
