import 'server-only';

import type { ManualTransferDestination, PaymentMethod } from './types';

export class PaymentGatewayUnavailableError extends Error {
  constructor(public readonly method: PaymentMethod) {
    super(`${method} checkout is not configured`);
    this.name = 'PaymentGatewayUnavailableError';
  }
}

export interface PaymentGateway {
  readonly method: PaymentMethod;
  readonly automatic: boolean;
  isConfigured(): boolean;
}

class UnconfiguredAutomaticGateway implements PaymentGateway {
  readonly automatic = true;
  constructor(readonly method: 'cib' | 'edahabia') {}
  isConfigured() { return false; }
}

class ManualGateway implements PaymentGateway {
  readonly automatic = false;
  constructor(readonly method: 'baridimob' | 'ccp') {}
  isConfigured() { return getManualTransferDestination(this.method) !== null; }
}

export const PAYMENT_GATEWAYS: Record<PaymentMethod, PaymentGateway> = {
  baridimob: new ManualGateway('baridimob'),
  ccp: new ManualGateway('ccp'),
  cib: new UnconfiguredAutomaticGateway('cib'),
  edahabia: new UnconfiguredAutomaticGateway('edahabia'),
};

export function getManualTransferDestination(method: 'baridimob' | 'ccp'): ManualTransferDestination | null {
  if (method === 'baridimob') {
    const rip = process.env.BARIDIMOB_RIP?.trim() || null;
    return rip ? { method, accountHolder: null, accountNumber: null, accountKey: null, accountAddress: null, rip } : null;
  }
  const accountHolder = process.env.CCP_ACCOUNT_HOLDER?.trim() || null;
  const accountNumber = process.env.CCP_ACCOUNT_NUMBER?.trim() || null;
  const accountKey = process.env.CCP_ACCOUNT_KEY?.trim() || null;
  const accountAddress = process.env.CCP_ACCOUNT_ADDRESS?.trim() || null;
  if (!accountHolder || !accountNumber || !accountKey || !accountAddress) return null;
  return { method, accountHolder, accountNumber, accountKey, accountAddress, rip: null };
}

export function requireGateway(method: PaymentMethod) {
  const gateway = PAYMENT_GATEWAYS[method];
  if (!gateway?.isConfigured()) throw new PaymentGatewayUnavailableError(method);
  return gateway;
}
