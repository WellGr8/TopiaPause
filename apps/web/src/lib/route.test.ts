import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hrefFor, parseRoute } from './route';

describe('app routes', () => {
  it('maps the landing page and the app tabs', () => {
    expect(parseRoute('/')).toEqual({ view: 'landing' });
    expect(parseRoute('/app')).toEqual({ view: 'chat' });
    expect(parseRoute('/app/activity')).toEqual({ view: 'activity' });
    expect(parseRoute('/app/rules')).toEqual({ view: 'rules' });
    expect(parseRoute('/app', '?tab=rules')).toEqual({ view: 'rules' });
    expect(parseRoute('/app/rules', '?tab=chat')).toEqual({ view: 'rules' });
  });

  it('keeps a scene on the chat deep link only', () => {
    expect(parseRoute('/app', '?scene=stay')).toEqual({ view: 'chat', scene: 'stay' });
    expect(parseRoute('/app/activity', '?scene=crypto')).toEqual({ view: 'activity' });
    expect(parseRoute('/nope')).toEqual({ view: 'landing' });
    expect(hrefFor('landing')).toBe('/');
    expect(hrefFor('chat')).toBe('/app');
    expect(hrefFor('chat', 'subscription')).toBe('/app?scene=subscription');
    expect(hrefFor('rules')).toBe('/app/rules');
  });

  it('lets the Worker serve index.html for / and /app, and keeps /api on the Worker', () => {
    const root = readFileSync(resolve(__dirname, '../../../../wrangler.jsonc'), 'utf8');
    const api = readFileSync(resolve(__dirname, '../../../../workers/api/wrangler.jsonc'), 'utf8');
    for (const src of [root, api]) {
      expect(src).toContain('"not_found_handling": "single-page-application"');
      expect(src).toContain('"/api/*"');
    }
  });
});
