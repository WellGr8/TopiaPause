import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('apps/web/public/_headers', () => {
  it('sends the audit CSP and frame denial for every static path', () => {
    const text = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
    expect(text).toContain("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
    expect(text).toContain("frame-ancestors 'none'");
    expect(text).toContain('X-Frame-Options: DENY');
    expect(text).toContain('X-Content-Type-Options: nosniff');
    expect(text).toContain('Referrer-Policy: strict-origin-when-cross-origin');
    expect(text).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=()');
  });
});
