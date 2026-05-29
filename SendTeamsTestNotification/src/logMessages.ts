/** Pipeline / console messages (English only). */
export const log = {
  fetchingResults: (buildId: string) =>
    `Fetching test results via API for buildId=${buildId}...`,
  noTestRuns: 'No test runs found for this buildId.',
  noFailuresSkipped:
    'No failed or inconclusive tests. Notification was not sent.',
  foundFailed: (count: number) => `Found ${count} failed test(s) (API)`,
  foundInconclusive: (count: number) =>
    `Found ${count} inconclusive test(s) (API)`,
  sendingNotification: 'Sending notification to Teams...',
  notificationSent: (httpStatus: number) =>
    `Notification sent successfully to Teams (HTTP ${httpStatus})`,
  successNotificationSent: (httpStatus: number) =>
    `Success notification sent to Teams (HTTP ${httpStatus})`,
  debugNotSent:
    'DEBUG: Notification was not sent to Teams (notifyOnSuccess is false).',
};

export const errors = {
  webhookRequired: 'Teams webhook URL is required',
  buildIdRequired: 'Build ID is required',
  authRequired:
    'Set System.AccessToken (pipeline) or ADO_PAT (local) to fetch results via API.',
  notificationFailed: (httpStatus: number) =>
    `Failed to send notification (HTTP ${httpStatus})`,
};
