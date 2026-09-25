import { isConfigured } from './settings.ts';
export { sendSms } from './integrations.ts';

/** Without an SMS gateway every login code is the fixed demo code. */
export function isDemoSms() {
  return !isConfigured('sms');
}
