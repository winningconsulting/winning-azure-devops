#!/usr/bin/env node
/**
 * Build Adaptive Card JSON for local viewers (no Teams POST).
 *
 * Usage:
 *   npm run preview:card
 *   npm run preview:card -- --scenario failure-truncated -o card.json
 *   npm run preview:card -- --list-scenarios
 *   npm run preview:card -- --buildId 55659 --language pt-PT
 *   npm run preview:card -- --teams
 */
const path = require('path');
const fs = require('fs');
const {
  getScenario,
  printScenarioList,
  listScenarioNames,
} = require('./preview-card-fixtures');

const repoRoot = path.join(__dirname, '..');
const taskRoot = path.join(repoRoot, 'SendTeamsTestNotification');

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

function parseArgs(argv) {
  const opts = {
    mode: 'fake',
    scenario: 'failure-few',
    buildId: '',
    language: '',
    output: '',
    teams: false,
    cardTitle: '',
    listScenarios: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--buildId' && argv[i + 1]) {
      opts.mode = 'ado';
      opts.buildId = String(argv[++i]).trim();
    } else if (arg === '--scenario' && argv[i + 1]) {
      opts.mode = 'fake';
      opts.scenario = String(argv[++i]).trim();
    } else if (arg === '--fake' && argv[i + 1]) {
      opts.mode = 'fake';
      opts.scenario = String(argv[++i]).trim();
    } else if (arg === '--list-scenarios') {
      opts.listScenarios = true;
    } else if (arg === '--language' && argv[i + 1]) {
      opts.language = String(argv[++i]).trim();
    } else if (arg === '--output' && argv[i + 1]) {
      opts.output = String(argv[++i]).trim();
    } else if (arg === '-o' && argv[i + 1]) {
      opts.output = String(argv[++i]).trim();
    } else if (arg === '--teams') {
      opts.teams = true;
    } else if (arg === '--cardTitle' && argv[i + 1]) {
      opts.cardTitle = String(argv[++i]).trim();
    } else if (arg === '--help' || arg === '-h') {
      const names = listScenarioNames().join(', ');
      console.log(`Usage: node scripts/preview-adaptive-card.js [options]

Fake data (default):
  --scenario <name>   Embedded scenario (${names})
  --fake <name>       Alias for --scenario
  --list-scenarios    Describe all embedded scenarios

Azure DevOps:
  --buildId <id>      Fetch real results (.env.local: ADO_PAT, org, project)

Output:
  --language <code>   en or pt-PT (scenario default unless overridden)
  --cardTitle <text>  Override card title
  --output, -o <file> Write JSON to file (default: stdout)
  --teams             Teams webhook envelope (attachments)
`);
      process.exit(0);
    }
  }
  return opts;
}

function requireBuiltTask() {
  const adaptiveCardJs = path.join(taskRoot, 'lib', 'adaptiveCard.js');
  if (!fs.existsSync(adaptiveCardJs)) {
    console.error('Task not built. Run: npm run build');
    process.exit(1);
  }
  return {
    adaptiveCardJs,
    adoClientJs: path.join(taskRoot, 'lib', 'adoClient.js'),
    i18nJs: path.join(taskRoot, 'lib', 'i18n.js'),
  };
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

async function fetchResultsFromAdo(buildId) {
  const { adoClientJs } = requireBuiltTask();
  const { AdoTestResultsClient } = require(adoClientJs);

  const organizationUri = firstNonEmpty(
    'ORGANIZATION_URI',
    'INPUT_organizationuri',
    'https://dev.azure.com/your-org/'
  );
  const projectName = firstNonEmpty(
    'PROJECT_NAME',
    'INPUT_projectname',
    'YourProject'
  );
  const pat = process.env.ADO_PAT;
  const system = process.env.SYSTEM_ACCESSTOKEN;
  let auth;
  if (system) {
    auth = { token: system, scheme: 'Bearer' };
  } else if (pat) {
    auth = { token: pat, scheme: 'Basic' };
  }

  if (!auth) {
    console.error('Set ADO_PAT or SYSTEM_ACCESSTOKEN in .env.local for --buildId.');
    process.exit(1);
  }

  const client = new AdoTestResultsClient({
    organizationUri,
    projectName,
    buildId,
    openAttachmentsPane: envFlag('TEAMS_OPEN_ATTACHMENTS_PANE'),
    getAccessToken: () => auth,
    onWarning: (msg) => console.warn(`⚠ ${msg}`),
  });

  const results = await client.fetchAggregatedResults();
  if (!results) {
    console.error('No test results for build', buildId);
    process.exit(1);
  }
  return { results, buildUrl: client.getBuildResultsUrl() };
}

function buildCardPayload(results, buildUrl, language, cardTitleOverride, teams) {
  const { adaptiveCardJs, i18nJs } = requireBuiltTask();
  const {
    buildAdaptiveCardContent,
    buildAdaptiveCardPayload,
  } = require(adaptiveCardJs);
  const { I18n, parseLanguage } = require(i18nJs);

  const i18n = new I18n(parseLanguage(language));
  const hasIssues =
    results.failedListCount > 0 || results.inconclusiveListCount > 0;
  const isSuccess = !hasIssues;
  const title =
    cardTitleOverride ||
    (isSuccess ? i18n.t('cardTitleSuccess') : i18n.t('cardTitle'));
  const options = { buildUrl, title, isSuccess };

  if (teams) {
    return buildAdaptiveCardPayload(results, i18n, options);
  }
  return buildAdaptiveCardContent(results, i18n, options);
}

async function main() {
  loadEnvFile(path.join(repoRoot, '.env'));
  loadEnvFile(path.join(repoRoot, '.env.local'));

  const opts = parseArgs(process.argv.slice(2));

  if (opts.listScenarios) {
    printScenarioList();
    process.exit(0);
  }

  let results;
  let buildUrl;
  let language;

  if (opts.mode === 'fake') {
    const scenario = getScenario(opts.scenario);
    results = scenario.results;
    buildUrl = scenario.buildUrl;
    language =
      opts.language ||
      scenario.language ||
      firstNonEmpty('LANGUAGE', 'INPUT_language') ||
      'en';
    if (!opts.output && !opts.teams) {
      console.error(`# scenario: ${scenario.name} — ${scenario.description}`);
    }
  } else {
    const buildId = opts.buildId || process.env.BUILD_ID;
    if (!buildId) {
      console.error('Pass --buildId or set BUILD_ID.');
      process.exit(1);
    }
    const fetched = await fetchResultsFromAdo(buildId);
    results = fetched.results;
    buildUrl = fetched.buildUrl;
    language =
      opts.language || firstNonEmpty('LANGUAGE', 'INPUT_language') || 'en';
  }

  const payload = buildCardPayload(
    results,
    buildUrl,
    language,
    opts.cardTitle || firstNonEmpty('CARD_TITLE', 'INPUT_cardtitle'),
    opts.teams
  );

  const json = JSON.stringify(payload, null, 2);
  if (opts.output) {
    const outPath = path.isAbsolute(opts.output)
      ? opts.output
      : path.join(process.cwd(), opts.output);
    fs.writeFileSync(outPath, json, 'utf8');
    console.error(`Wrote ${outPath}`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
