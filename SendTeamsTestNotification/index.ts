import * as tl from 'azure-pipelines-task-lib/task';
import { AdoTestResultsClient } from './lib/adoClient';
import { buildAdaptiveCardPayload } from './lib/adaptiveCard';
import { I18n, parseLanguage } from './lib/i18n';
import { errors, log } from './lib/logMessages';

async function postWebhook(url: string, payload: object): Promise<number> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.status;
}

function isDebugEnabled(): boolean {
  if (tl.getBoolInput('debugMode', false)) {
    return true;
  }
  const raw =
    process.env.DEBUG_MODE ||
    process.env.INPUT_debugmode ||
    '';
  return /^(true|1|yes)$/i.test(String(raw).trim());
}

function logNotificationContent(payload: object): void {
  console.log('--- Notification content ---');
  console.log(JSON.stringify(payload, null, 2));
  console.log('--- End notification content ---');
}

function resolveAccessToken():
  | { token: string; scheme: 'Bearer' | 'Basic' }
  | undefined {
  const system =
    tl.getVariable('System.AccessToken') || process.env.SYSTEM_ACCESSTOKEN;
  if (system) {
    return { token: system, scheme: 'Bearer' };
  }
  const pat = process.env.ADO_PAT;
  if (pat) {
    return { token: pat, scheme: 'Basic' };
  }
  return undefined;
}

async function run(): Promise<void> {
  const teamsWebhookUrl = tl.getInput('teamsWebhookUrl', true)?.trim();
  const buildId = tl.getInput('buildId', true)?.trim();
  const organizationUri = tl.getInput('organizationUri', true)?.trim();
  const projectName = tl.getInput('projectName', true)?.trim();
  const language = parseLanguage(tl.getInput('language'));
  const cardTitleOverride = tl.getInput('cardTitle')?.trim();
  const openAttachmentsPane = tl.getBoolInput('openAttachmentsPane', false);
  const debugMode = isDebugEnabled();
  const notifyOnSuccess = tl.getBoolInput('notifyOnSuccess', false);

  const i18n = new I18n(language);

  if (!teamsWebhookUrl) {
    tl.setResult(tl.TaskResult.Failed, errors.webhookRequired);
    return;
  }
  if (!buildId) {
    tl.setResult(tl.TaskResult.Failed, errors.buildIdRequired);
    return;
  }

  const auth = resolveAccessToken();
  if (!auth) {
    tl.setResult(tl.TaskResult.Failed, errors.authRequired);
    return;
  }

  const client = new AdoTestResultsClient({
    organizationUri: organizationUri!,
    projectName: projectName!,
    buildId,
    openAttachmentsPane,
    getAccessToken: () => auth,
    onWarning: (msg) => console.warn(`⚠ ${msg}`),
  });

  console.log(log.fetchingResults(buildId));

  const results = await client.fetchAggregatedResults();
  if (!results) {
    console.log(log.noTestRuns);
    tl.setResult(tl.TaskResult.Succeeded);
    return;
  }

  const hasIssues =
    results.failedListCount > 0 || results.inconclusiveListCount > 0;

  if (results.failedListCount > 0) {
    console.log(log.foundFailed(results.totalFailed));
  }
  if (results.inconclusiveListCount > 0) {
    console.log(log.foundInconclusive(results.totalInconclusive));
  }

  const buildUrl = client.getBuildResultsUrl();
  const isSuccess = !hasIssues;
  const title =
    cardTitleOverride ||
    (isSuccess ? i18n.t('cardTitleSuccess') : i18n.t('cardTitle'));

  const payload = buildAdaptiveCardPayload(results, i18n, {
    buildUrl,
    title,
    isSuccess,
  });

  if (debugMode) {
    logNotificationContent(payload);
  }

  if (!hasIssues && !notifyOnSuccess) {
    console.log(log.noFailuresSkipped);
    if (debugMode) {
      console.log(log.debugNotSent);
    }
    tl.setResult(tl.TaskResult.Succeeded);
    return;
  }

  console.log(log.sendingNotification);
  const httpStatus = await postWebhook(teamsWebhookUrl, payload);

  if (httpStatus >= 200 && httpStatus < 300) {
    const msg = isSuccess
      ? log.successNotificationSent(httpStatus)
      : log.notificationSent(httpStatus);
    console.log(`✓ ${msg}`);
    tl.setResult(tl.TaskResult.Succeeded);
    return;
  }

  tl.setResult(tl.TaskResult.Failed, errors.notificationFailed(httpStatus));
}

run().catch((err) => {
  tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
});
