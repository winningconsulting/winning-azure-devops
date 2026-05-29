export interface TestResultEntry {
  resultId: number;
  testName: string;
  link: string;
}

export interface AggregatedTestResults {
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalInconclusive: number;
  failedEntries: TestResultEntry[];
  inconclusiveEntries: TestResultEntry[];
  failedListCount: number;
  inconclusiveListCount: number;
}

export interface ListedEntriesSlice {
  listed: TestResultEntry[];
  hasMore: boolean;
  moreCount: number;
}
