/**
 * Fake aggregated test results for adaptive card preview (no Azure DevOps).
 */

const SAMPLE_BUILD_URL =
  'https://dev.azure.com/example/Contoso/_build/results?buildId=4242&view=ms.vss-test-web.build-test-results-tab';

function testLink(buildId, resultId) {
  return `https://dev.azure.com/example/Contoso/_build/results?buildId=${buildId}&view=ms.vss-test-web.build-test-results-tab&runId=1&testRunId=1&resultId=${resultId}`;
}

function makeEntries(count, options = {}) {
  const {
    buildId = 4242,
    namePrefix = 'CheckoutFlow',
    startResultId = 100001,
  } = options;
  const entries = [];
  for (let i = 0; i < count; i++) {
    const resultId = startResultId + i;
    entries.push({
      resultId,
      testName: `${namePrefix}_Case${i + 1}_WhenInvalidInput_ShouldReturnError`,
      link: testLink(buildId, resultId),
    });
  }
  return entries;
}

/** @type {Record<string, { description: string, language?: string, buildUrl: string, results: object }>} */
const SCENARIOS = {
  'failure-few': {
    description: 'Small failure set (3 tests), English',
    language: 'en',
    buildUrl: SAMPLE_BUILD_URL,
    results: {
      totalTests: 42,
      totalPassed: 39,
      totalFailed: 3,
      totalInconclusive: 0,
      failedListCount: 3,
      inconclusiveListCount: 0,
      failedEntries: makeEntries(3),
      inconclusiveEntries: [],
    },
  },
  'failure-truncated': {
    description:
      'More than 15 failures — list shows 10 items plus “… and N more” line',
    language: 'en',
    buildUrl: SAMPLE_BUILD_URL,
    results: {
      totalTests: 120,
      totalPassed: 100,
      totalFailed: 20,
      totalInconclusive: 0,
      failedListCount: 20,
      inconclusiveListCount: 0,
      failedEntries: makeEntries(20, { namePrefix: 'BulkEditProduct' }),
      inconclusiveEntries: [],
    },
  },
  inconclusive: {
    description: 'Inconclusive tests only',
    language: 'en',
    buildUrl: SAMPLE_BUILD_URL,
    results: {
      totalTests: 10,
      totalPassed: 8,
      totalFailed: 0,
      totalInconclusive: 2,
      failedListCount: 0,
      inconclusiveListCount: 2,
      failedEntries: [],
      inconclusiveEntries: makeEntries(2, { namePrefix: 'FlakyIntegration' }),
    },
  },
  mixed: {
    description: 'Failed and inconclusive sections together',
    language: 'en',
    buildUrl: SAMPLE_BUILD_URL,
    results: {
      totalTests: 50,
      totalPassed: 45,
      totalFailed: 3,
      totalInconclusive: 2,
      failedListCount: 3,
      inconclusiveListCount: 2,
      failedEntries: makeEntries(3, { namePrefix: 'ApiContract' }),
      inconclusiveEntries: makeEntries(2, {
        namePrefix: 'E2E_Order',
        startResultId: 200001,
      }),
    },
  },
  success: {
    description: 'All tests passed (success card)',
    language: 'en',
    buildUrl: SAMPLE_BUILD_URL,
    results: {
      totalTests: 256,
      totalPassed: 256,
      totalFailed: 0,
      totalInconclusive: 0,
      failedListCount: 0,
      inconclusiveListCount: 0,
      failedEntries: [],
      inconclusiveEntries: [],
    },
  },
};

function listScenarioNames() {
  return Object.keys(SCENARIOS);
}

function getScenario(name) {
  const key = name || 'failure-few';
  const scenario = SCENARIOS[key];
  if (!scenario) {
    const available = listScenarioNames().join(', ');
    throw new Error(`Unknown scenario "${name}". Available: ${available}`);
  }
  return {
    name: key,
    description: scenario.description,
    language: scenario.language,
    buildUrl: scenario.buildUrl,
    results: scenario.results,
  };
}

function printScenarioList() {
  console.log('Preview scenarios (fake data, no ADO):\n');
  for (const name of listScenarioNames()) {
    const { description } = SCENARIOS[name];
    console.log(`  ${name}`);
    console.log(`    ${description}\n`);
  }
}

module.exports = {
  SCENARIOS,
  listScenarioNames,
  getScenario,
  printScenarioList,
};
