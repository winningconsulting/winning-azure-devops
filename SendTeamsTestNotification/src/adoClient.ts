import type {
  AggregatedTestResults,
  ListedEntriesSlice,
  TestResultEntry,
} from './types';

const API_VERSION = '7.1';
const MAX_LISTED_FULL = 15;
const MAX_LISTED_WHEN_TRUNCATING = 10;

export type AccessTokenAuth = {
  token: string;
  scheme: 'Bearer' | 'Basic';
};

export interface AdoTestResultsClientConfig {
  organizationUri: string;
  projectName: string;
  buildId: string;
  openAttachmentsPane: boolean;
  getAccessToken: () => AccessTokenAuth | undefined;
  onWarning: (message: string) => void;
}

function urlEncodeSegment(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '%20');
}

function normalizeOrgUri(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}

export class AdoTestResultsClient {
  private orgUri: string;
  private projectPath: string;
  private projectName: string;
  private buildId: string;
  private openAttachmentsPane: boolean;
  private apiBase: string;
  private getAccessToken: () => AccessTokenAuth | undefined;
  private onWarning: (message: string) => void;

  constructor(config: AdoTestResultsClientConfig) {
    this.orgUri = normalizeOrgUri(config.organizationUri);
    this.projectName = config.projectName;
    this.projectPath = urlEncodeSegment(config.projectName);
    this.buildId = config.buildId;
    this.openAttachmentsPane = config.openAttachmentsPane;
    this.apiBase = `${this.orgUri}${this.projectPath}/_apis`;
    this.getAccessToken = config.getAccessToken;
    this.onWarning = config.onWarning;
  }

  getBuildResultsUrl(): string {
    return `${this.orgUri}${this.projectName}/_build/results?buildId=${this.buildId}&view=ms.vss-test-web.build-test-results-tab`;
  }

  private authHeaders(): Record<string, string> {
    const auth = this.getAccessToken();
    if (!auth) {
      throw new Error('No auth token');
    }
    if (auth.scheme === 'Basic') {
      const basic = Buffer.from(`:${auth.token}`).toString('base64');
      return {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      };
    }
    return {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
    };
  }

  private async adoGet(url: string): Promise<unknown> {
    try {
      const res = await fetch(url, { headers: this.authHeaders() });
      if (res.status < 200 || res.status >= 300) {
        const body = (await res.text()).slice(0, 500);
        this.onWarning(`Azure DevOps API HTTP ${res.status} for: ${url} ${body}`);
        return null;
      }
      const text = await res.text();
      if (!text) {
        this.onWarning(`Azure DevOps API empty response for: ${url}`);
        return null;
      }
      return JSON.parse(text) as unknown;
    } catch (e) {
      this.onWarning(String(e));
      return null;
    }
  }

  private async getBuildUri(): Promise<string | null> {
    const data = (await this.adoGet(
      `${this.apiBase}/build/builds/${this.buildId}?api-version=${API_VERSION}`
    )) as { uri?: string } | null;
    if (data?.uri) {
      return data.uri;
    }
    return `vstfs:///Build/Build/${this.buildId}`;
  }

  private async getTestRunIds(buildUri: string): Promise<number[]> {
    const encoded = encodeURIComponent(buildUri);
    const data = (await this.adoGet(
      `${this.apiBase}/test/runs?buildUri=${encoded}&api-version=${API_VERSION}`
    )) as { value?: { id?: number }[] } | null;
    if (!data?.value?.length) {
      return [];
    }
    return data.value
      .map((r) => r.id)
      .filter((id): id is number => typeof id === 'number');
  }

  private resultDisplayName(obj: {
    testCaseTitle?: string;
    automatedTestName?: string;
  }): string {
    return obj.testCaseTitle || obj.automatedTestName || '';
  }

  private buildTestResultPortalUrl(runId: number, resultId: number): string {
    let url = `${this.orgUri}${this.projectPath}/_build/results?buildId=${this.buildId}&view=ms.vss-test-web.build-test-results-tab&runId=${runId}&testRunId=${runId}&resultId=${resultId}`;
    if (this.openAttachmentsPane) {
      url += '&paneView=attachments';
    }
    return url;
  }

  private async listResultEntries(
    runId: number,
    outcomes: string
  ): Promise<TestResultEntry[]> {
    const data = (await this.adoGet(
      `${this.apiBase}/test/runs/${runId}/results?outcomes=${outcomes}&api-version=${API_VERSION}`
    )) as {
      value?: {
        id?: number;
        testCaseTitle?: string;
        automatedTestName?: string;
      }[];
    } | null;
    if (!data?.value) {
      return [];
    }
    const entries: TestResultEntry[] = [];
    for (const obj of data.value) {
      const resultId = obj.id;
      const testName = this.resultDisplayName(obj);
      if (resultId == null || !testName) {
        continue;
      }
      entries.push({
        resultId,
        testName,
        link: this.buildTestResultPortalUrl(runId, resultId),
      });
    }
    return entries;
  }

  async fetchAggregatedResults(): Promise<AggregatedTestResults | null> {
    const buildUri = await this.getBuildUri();
    if (!buildUri) {
      return null;
    }
    const runIds = await this.getTestRunIds(buildUri);
    if (runIds.length === 0) {
      return null;
    }

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalInconclusive = 0;
    const failedEntries: TestResultEntry[] = [];
    const inconclusiveEntries: TestResultEntry[] = [];

    for (const runId of runIds) {
      const runJson = (await this.adoGet(
        `${this.apiBase}/test/runs/${runId}?api-version=${API_VERSION}`
      )) as {
        totalTests?: number;
        passedTests?: number;
        failedTests?: number;
        inconclusiveTests?: number;
        notExecutedTests?: number;
      } | null;
      if (runJson) {
        totalTests += runJson.totalTests ?? 0;
        totalPassed += runJson.passedTests ?? 0;
        totalFailed += runJson.failedTests ?? 0;
        totalInconclusive +=
          (runJson.inconclusiveTests ?? 0) + (runJson.notExecutedTests ?? 0);
      }
      const failed = await this.listResultEntries(runId, 'Failed');
      const inconclusive = await this.listResultEntries(
        runId,
        'Inconclusive,NotExecuted'
      );
      failedEntries.push(...failed);
      inconclusiveEntries.push(...inconclusive);
    }

    const failedListCount = failedEntries.length;
    const inconclusiveListCount = inconclusiveEntries.length;
    if (failedListCount > totalFailed) {
      totalFailed = failedListCount;
    }
    if (inconclusiveListCount > totalInconclusive) {
      totalInconclusive = inconclusiveListCount;
    }
    if (totalTests === 0) {
      totalTests = totalPassed + totalFailed + totalInconclusive;
    }

    return {
      totalTests,
      totalPassed,
      totalFailed,
      totalInconclusive,
      failedEntries,
      inconclusiveEntries,
      failedListCount,
      inconclusiveListCount,
    };
  }

  static sliceListedEntries(
    entries: TestResultEntry[],
    total: number
  ): ListedEntriesSlice {
    if (total <= MAX_LISTED_FULL) {
      return {
        listed: entries.slice(0, total),
        hasMore: false,
        moreCount: 0,
      };
    }
    const listed = entries.slice(0, MAX_LISTED_WHEN_TRUNCATING);
    const moreCount = total - MAX_LISTED_WHEN_TRUNCATING;
    return { listed, hasMore: true, moreCount };
  }
}
