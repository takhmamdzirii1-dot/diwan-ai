export type PaymentMethod = 'baridimob' | 'ccp' | 'cib' | 'edahabia';
export type PaymentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export type PaymentOrderKind = 'credit_pack' | 'subscription';

export type PaymentOrder = {
  id: string;
  user_id: string;
  plan_id: string;
  order_kind: PaymentOrderKind;
  plan_name: string;
  plan_description: string | null;
  payment_method: PaymentMethod;
  amount_dzd: number;
  credits_amount: number | null;
  entitlement: Record<string, unknown>;
  payment_reference: string;
  customer_reference: string | null;
  proof_storage_path: string | null;
  status: PaymentStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  resulting_credit_transaction_id: string | null;
  resulting_entitlement_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ManualTransferDestination = {
  method: 'baridimob' | 'ccp';
  accountHolder: string | null;
  accountNumber: string | null;
  accountKey: string | null;
  accountAddress: string | null;
  rip: string | null;
};

export type PaymentPlan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: PaymentOrderKind;
  priceDzd: number;
  unifiedCredits: number;
  active: boolean;
  displayOrder: number;
  featured: boolean;
};
