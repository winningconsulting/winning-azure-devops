import { AdoTestResultsClient } from './adoClient';
import type { I18n } from './i18n';
import type { AggregatedTestResults, TestResultEntry } from './types';

export interface CardBuildOptions {
  buildUrl: string;
  title: string;
  isSuccess: boolean;
}

function formatTestsSection(
  entries: TestResultEntry[],
  moreCount: number,
  i18n: I18n
): string {
  const lines: string[] = [];
  entries.forEach((e, i) => {
    lines.push(`${i + 1}. [${e.testName}](${e.link})`);
  });
  if (moreCount > 0) {
    lines.push('');
    lines.push(i18n.t('moreTests', moreCount));
  }
  return lines.join('\n');
}

function buildStatsText(results: AggregatedTestResults, i18n: I18n): string {
  return `**${i18n.t('statsTotal')}:** ${results.totalTests} ${i18n.t('statsTestsLabel')}\n**✅ ${i18n.t('statsPassed')}:** ${results.totalPassed}\n**❌ ${i18n.t('statsFailed')}:** ${results.totalFailed}\n**⚠️ ${i18n.t('statsInconclusive')}:** ${results.totalInconclusive}`;
}

/** Adaptive Card JSON only (for local preview tools and viewers). */
export function buildAdaptiveCardContent(
  results: AggregatedTestResults,
  i18n: I18n,
  options: CardBuildOptions
): object {
  const body: object[] = [
    {
      type: 'TextBlock',
      size: 'Large',
      weight: 'Bolder',
      text: options.title,
      color: options.isSuccess ? 'Good' : 'Attention',
    },
    {
      type: 'TextBlock',
      text: buildStatsText(results, i18n),
      wrap: true,
      spacing: 'Small',
    },
  ];

  const failedSlice = AdoTestResultsClient.sliceListedEntries(
    results.failedEntries,
    results.totalFailed
  );
  if (results.failedListCount > 0) {
    const failedText = formatTestsSection(
      failedSlice.listed,
      failedSlice.moreCount,
      i18n
    );
    body.push(
      {
        type: 'TextBlock',
        text: `**${i18n.t('sectionFailed')}:**`,
        weight: 'Bolder',
        size: 'Small',
        spacing: 'Medium',
        separator: true,
      },
      {
        type: 'TextBlock',
        text: failedText,
        wrap: true,
        spacing: 'Small',
        fontType: 'Monospace',
      }
    );
  }

  const inconclusiveSlice = AdoTestResultsClient.sliceListedEntries(
    results.inconclusiveEntries,
    results.totalInconclusive
  );
  if (results.inconclusiveListCount > 0) {
    const inconclusiveText = formatTestsSection(
      inconclusiveSlice.listed,
      inconclusiveSlice.moreCount,
      i18n
    );
    body.push(
      {
        type: 'TextBlock',
        text: `**${i18n.t('sectionInconclusive')}:**`,
        weight: 'Bolder',
        size: 'Small',
        spacing: 'Medium',
        separator: true,
      },
      {
        type: 'TextBlock',
        text: inconclusiveText,
        wrap: true,
        spacing: 'Small',
        fontType: 'Monospace',
      }
    );
  }

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.0',
    body,
    actions: [
      {
        type: 'Action.OpenUrl',
        title: i18n.t('actionViewDetails'),
        url: options.buildUrl,
      },
    ],
  };
}

/** Teams incoming webhook / workflow message envelope. */
export function buildAdaptiveCardPayload(
  results: AggregatedTestResults,
  i18n: I18n,
  options: CardBuildOptions
): object {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: buildAdaptiveCardContent(results, i18n, options),
      },
    ],
  };
}
