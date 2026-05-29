import en from '../strings/en.json';
import ptPT from '../strings/pt-PT.json';

export type LanguageCode = 'en' | 'pt-PT';

type MessageKey = keyof typeof en;

const bundles: Record<LanguageCode, Record<string, string>> = {
  en,
  'pt-PT': ptPT,
};

/** Localized strings for Teams Adaptive Card content only. */
export class I18n {
  private messages: Record<string, string>;

  constructor(language: LanguageCode) {
    this.messages = bundles[language] ?? bundles.en;
  }

  t(key: MessageKey, ...args: (string | number)[]): string {
    let text = this.messages[key] ?? bundles.en[key] ?? key;
    args.forEach((arg, i) => {
      text = text.replace(`{${i}}`, String(arg));
    });
    return text;
  }
}

export function parseLanguage(input: string | undefined): LanguageCode {
  if (input === 'pt-PT') {
    return 'pt-PT';
  }
  return 'en';
}
