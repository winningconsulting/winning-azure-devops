#!/usr/bin/env node
/**
 * Runs SendTeamsTestNotification with friendly env vars mapped to INPUT_* (same as the agent).
 * Used locally (npm run start:local) and from templates/send-teams-test-notification.yml.
 *
 * Usage:
 *   node scripts/run-local.js --buildId 12345
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function isAzurePipelinesAgent() {
  const tf = String(process.env.TF_BUILD ?? '').toLowerCase();
  return tf === 'true' || Boolean(process.env.AGENT_ID);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

function firstNonEmpty(...keys) {
  for (const key of keys) {
    const v = process.env[key];
    if (v != null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

function envFlag(name) {
  const v = String(process.env[name] ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function boolEnvString(name) {
  return envFlag(name) ? 'true' : 'false';
}

/** Map friendly env vars to Azure Pipelines task INPUT_* names. */
function applyTaskInputs(options) {
  const { buildId } = options;

  const webhook = firstNonEmpty(
    'TEAMS_WEBHOOK_URL',
    'INPUT_teamswebhookurl'
  );
  if (!webhook) {
    console.error('Set TEAMS_WEBHOOK_URL (or INPUT_teamswebhookurl).');
    process.exit(1);
  }

  if (!buildId) {
    console.error('Missing buildId. Pass --buildId <id> or set BUILD_ID.');
    process.exit(1);
  }

  const onAgent = isAzurePipelinesAgent();
  const defaultOrg = onAgent
    ? ''
    : 'https://dev.azure.com/your-org/';
  const defaultProject = onAgent ? '' : 'YourProject';

  process.env.INPUT_teamswebhookurl = webhook;
  process.env.INPUT_buildid = buildId;
  process.env.INPUT_organizationuri = firstNonEmpty(
    'ORGANIZATION_URI',
    'INPUT_organizationuri',
    defaultOrg
  );
  process.env.INPUT_projectname = firstNonEmpty(
    'PROJECT_NAME',
    'INPUT_projectname',
    defaultProject
  );
  process.env.INPUT_language =
    firstNonEmpty('LANGUAGE', 'INPUT_language') || 'en';
  process.env.INPUT_cardtitle = firstNonEmpty(
    'CARD_TITLE',
    'INPUT_cardtitle'
  );
  process.env.INPUT_openattachmentspane = boolEnvString(
    'TEAMS_OPEN_ATTACHMENTS_PANE'
  );
  const debugOn = envFlag('DEBUG_MODE') || envFlag('INPUT_debugmode');
  process.env.INPUT_debugmode = debugOn ? 'true' : 'false';
  process.env.DEBUG_MODE = process.env.INPUT_debugmode;
  process.env.INPUT_notifyonsuccess = boolEnvString('NOTIFY_ON_SUCCESS');
}

function parseBuildIdFromArgs(argv) {
  let buildId = process.env.BUILD_ID;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--buildId' && argv[i + 1]) {
      buildId = argv[i + 1];
      i++;
    }
  }
  return buildId ? String(buildId).trim() : '';
}

function main() {
  const repoRoot = path.join(__dirname, '..');

  if (!isAzurePipelinesAgent()) {
    loadEnvFile(path.join(repoRoot, '.env'));
    loadEnvFile(path.join(repoRoot, '.env.local'));
  }

  const buildId = parseBuildIdFromArgs(process.argv.slice(2));
  applyTaskInputs({ buildId });

  const taskEntry = path.join(
    repoRoot,
    'SendTeamsTestNotification',
    'lib',
    'index.js'
  );

  if (!fs.existsSync(taskEntry)) {
    console.error('Task not built. Run: npm run build');
    process.exit(1);
  }

  const result = spawnSync(process.execPath, [taskEntry], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(repoRoot, 'SendTeamsTestNotification'),
  });

  process.exit(result.status ?? 1);
}

main();
