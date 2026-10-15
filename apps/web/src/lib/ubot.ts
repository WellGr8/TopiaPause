import { createGuard, type CreateGuardOptions, type GuardCheckInput } from '@topiapause/guard-client';

/**
 * The in-app U-Bot mock checks and confirms through the same client a real
 * integration would use. u.bot has no public API, so the proposal itself stays scripted.
 */
export function ubotGuard(options: Omit<CreateGuardOptions, 'baseUrl'> = {}) {
  return createGuard({ baseUrl: '', ...options });
}

export type { GuardCheckInput };
