/**
 * Parses URL hash parameters (e.g. #lang=cpp&blank=true&highlight=off&file=src/main.cpp)
 */
export interface UrlHashOptions {
  lang?: 'python' | 'cpp' | 'java';
  blank?: boolean;
  highlight?: boolean;
  file?: string;
}

export function parseHashString(hash: string): UrlHashOptions {
  if (!hash) return {};

  const clean = hash.replace(/^#\/?/, '');
  const params = new URLSearchParams(clean);
  const result: UrlHashOptions = {};

  const lang = params.get('lang') || params.get('project');
  if (lang === 'python' || lang === 'py') {
    result.lang = 'python';
  } else if (lang === 'cpp' || lang === 'c++') {
    result.lang = 'cpp';
  } else if (lang === 'java') {
    result.lang = 'java';
  }

  const blank = params.get('blank') || params.get('empty');
  if (blank !== null) {
    result.blank = blank !== 'false' && blank !== '0' && blank !== 'no';
  }

  const highlight = params.get('highlight') || params.get('color');
  if (highlight !== null) {
    result.highlight = highlight !== 'off' && highlight !== 'false' && highlight !== '0';
  }

  const file = params.get('file');
  if (file) {
    result.file = file;
  }

  return result;
}

export function parseUrlHash(): UrlHashOptions {
  if (typeof window === 'undefined' || !window.location.hash) {
    return {};
  }
  return parseHashString(window.location.hash);
}

/**
 * Updates URL hash with given options without triggering page reload
 */
export function setUrlHash(options: UrlHashOptions): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams();
  if (options.lang) params.set('lang', options.lang);
  if (options.blank) params.set('blank', 'true');
  if (options.highlight !== undefined) params.set('highlight', options.highlight ? 'on' : 'off');
  if (options.file) params.set('file', options.file);

  const hash = params.toString();
  window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname);
}
