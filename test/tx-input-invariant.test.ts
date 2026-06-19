import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// Invariant (issue #30 §2.3): the transaction-submission paths take
// recipient / amount / chain ONLY from user-entered form state — never from URL
// query params or indexer/RPC responses. This is a tripwire for the most likely
// regression: wiring a query param (e.g. a "prefill recipient from a shared
// link" feature) into the send/wrap forms.
//
// If this fails because you intentionally introduced such a flow, do NOT just
// delete the check — re-audit the fund-safety argument first (see
// docs/release-verification.md), then update the invariant.
//
// Scope/limit: this targets the URL-query-param vector via the common idioms
// below. It is a smell test, not a proof; indexer/RPC-sourced inputs must still
// be caught in review.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SUBMIT_PATH_FILES = [
  'pages/xdm/send.tsx',
  'pages/wrap.tsx',
  'components/SendForm.tsx',
];

const FORBIDDEN_URL_PARAM_READS = [
  /\brouter\.query\b/, // next/router (pages router) query bag
  /\buseSearchParams\b/, // next/navigation hook
  /\bwindow\.location\.search\b/, // raw query string
];

describe('tx-input invariant: submit paths read no URL query params (#30 §2.3)', () => {
  it.each(SUBMIT_PATH_FILES)('%s does not read URL query params', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    for (const pattern of FORBIDDEN_URL_PARAM_READS) {
      expect(
        src,
        `${rel} matches ${pattern} — see #30 §2.3 / docs/release-verification.md before wiring URL or external data into a transaction input`,
      ).not.toMatch(pattern);
    }
  });
});
