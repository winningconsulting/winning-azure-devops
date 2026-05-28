import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { AdoTestResultsClient } from '../lib/adoClient';
import type { TestResultEntry } from '../lib/types';

function makeEntries(count: number): TestResultEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    resultId: i + 1,
    testName: `Test ${i + 1}`,
    link: `https://example.com/${i + 1}`,
  }));
}

const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8'));
}

describe('AdoTestResultsClient.sliceListedEntries', () => {
  it('lists all entries when total is at most 15', () => {
    const entries = makeEntries(12);
    const slice = AdoTestResultsClient.sliceListedEntries(entries, 12);
    assert.equal(slice.listed.length, 12);
    assert.equal(slice.moreCount, 0);
    assert.equal(slice.hasMore, false);
  });

  it('lists 10 entries and summarizes the rest when total exceeds 15', () => {
    const entries = makeEntries(20);
    const slice = AdoTestResultsClient.sliceListedEntries(entries, 20);
    assert.equal(slice.listed.length, 10);
    assert.equal(slice.moreCount, 10);
    assert.equal(slice.hasMore, true);
  });

  it('shows full list at exactly 15 without a summary line', () => {
    const entries = makeEntries(15);
    const slice = AdoTestResultsClient.sliceListedEntries(entries, 15);
    assert.equal(slice.listed.length, 15);
    assert.equal(slice.moreCount, 0);
  });
});

describe('AdoTestResultsClient', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('aggregates failed tests from API responses', async () => {
    const build = loadFixture('build.json');
    const runs = loadFixture('testRuns.json');
    const run = loadFixture('testRun.json');
    const failed = loadFixture('failedResults.json');
    const empty = loadFixture('emptyResults.json');

    mock.method(global, 'fetch', async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/build/builds/')) {
        return new Response(JSON.stringify(build), { status: 200 });
      }
      if (u.includes('/test/runs?')) {
        return new Response(JSON.stringify(runs), { status: 200 });
      }
      if (u.match(/\/test\/runs\/100\?/)) {
        return new Response(JSON.stringify(run), { status: 200 });
      }
      if (u.includes('outcomes=Failed')) {
        return new Response(JSON.stringify(failed), { status: 200 });
      }
      if (u.includes('outcomes=Inconclusive')) {
        return new Response(JSON.stringify(empty), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });

    const client = new AdoTestResultsClient({
      organizationUri: 'https://dev.azure.com/org/',
      projectName: 'My Project',
      buildId: '42',
      openAttachmentsPane: false,
      getAccessToken: () => ({ token: 'pat', scheme: 'Basic' }),
      onWarning: () => {},
    });

    const results = await client.fetchAggregatedResults();
    assert.ok(results);
    assert.equal(results.failedListCount, 1);
    assert.equal(results.failedEntries[0].testName, 'Test A should pass');
    assert.ok(results.failedEntries[0].link.includes('paneView=attachments') === false);
  });

  it('adds attachments pane when enabled', async () => {
    const build = loadFixture('build.json');
    const runs = loadFixture('testRuns.json');
    const run = loadFixture('testRun.json');
    const failed = loadFixture('failedResults.json');
    const empty = loadFixture('emptyResults.json');

    mock.method(global, 'fetch', async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/build/builds/')) {
        return new Response(JSON.stringify(build), { status: 200 });
      }
      if (u.includes('/test/runs?')) {
        return new Response(JSON.stringify(runs), { status: 200 });
      }
      if (u.match(/\/test\/runs\/100\?/)) {
        return new Response(JSON.stringify(run), { status: 200 });
      }
      if (u.includes('outcomes=Failed')) {
        return new Response(JSON.stringify(failed), { status: 200 });
      }
      if (u.includes('outcomes=Inconclusive')) {
        return new Response(JSON.stringify(empty), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });

    const client = new AdoTestResultsClient({
      organizationUri: 'https://dev.azure.com/org/',
      projectName: 'My Project',
      buildId: '42',
      openAttachmentsPane: true,
      getAccessToken: () => ({ token: 'pat', scheme: 'Basic' }),
      onWarning: () => {},
    });

    const results = await client.fetchAggregatedResults();
    assert.ok(results?.failedEntries[0].link.includes('paneView=attachments'));
  });
});
