import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildAdaptiveCardPayload } from '../lib/adaptiveCard';
import { I18n } from '../lib/i18n';
import type { AggregatedTestResults } from '../lib/types';

const baseResults: AggregatedTestResults = {
  totalTests: 5,
  totalPassed: 3,
  totalFailed: 1,
  totalInconclusive: 1,
  failedListCount: 1,
  inconclusiveListCount: 0,
  failedEntries: [
    {
      resultId: 1,
      testName: 'Test A',
      link: 'https://dev.azure.com/org/project/_build/results?buildId=1&resultId=1',
    },
  ],
  inconclusiveEntries: [],
};

describe('buildAdaptiveCardPayload', () => {
  it('builds failure card with failed section', () => {
    const i18n = new I18n('en');
    const payload = buildAdaptiveCardPayload(baseResults, i18n, {
      buildUrl: 'https://example.com/build',
      title: 'Failures',
      isSuccess: false,
    }) as {
      attachments: { content: { body: { text: string }[] } }[];
    };
    const body = payload.attachments[0].content.body;
    assert.ok(body.some((b) => b.text?.includes('Failed tests')));
    assert.equal(
      payload.attachments[0].content.body[0].text,
      'Failures'
    );
  });

  it('builds success card without failed sections', () => {
    const i18n = new I18n('en');
    const clean: AggregatedTestResults = {
      ...baseResults,
      totalFailed: 0,
      totalInconclusive: 0,
      failedListCount: 0,
      inconclusiveListCount: 0,
      failedEntries: [],
      inconclusiveEntries: [],
      totalPassed: 5,
      totalTests: 5,
    };
    const payload = buildAdaptiveCardPayload(clean, i18n, {
      buildUrl: 'https://example.com/build',
      title: 'All tests passed',
      isSuccess: true,
    }) as {
      attachments: { content: { body: unknown[] } }[];
    };
    const body = payload.attachments[0].content.body;
    assert.equal(body.length, 2);
  });

  it('uses Portuguese strings', () => {
    const i18n = new I18n('pt-PT');
    assert.equal(i18n.t('sectionFailed'), 'Testes falhados');
  });
});
