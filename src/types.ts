export type EpicSession = {
  access_token: string;
  expires_in?: number;
  expires_at?: string;
  refresh_token: string;
  refresh_expires?: number;
  refresh_expires_at?: string;
  account_id: string;
  client_id?: string;
  displayName?: string;
  display_name?: string;
  country?: string;
  token_type?: string;
  [key: string]: unknown;
};

export type FreeOffer = {
  title: string;
  namespace: string;
  offerId: string;
  catalogItemIds: string[];
  slug: string;
  url: string;
  startDate: string;
  endDate: string;
};

export type Entitlement = {
  id?: string;
  namespace?: string;
  catalogItemId?: string;
  entitlementName?: string;
  status?: string;
  endDate?: string;
  [key: string]: unknown;
};

export type ClaimState = {
  offers: Record<string, {
    title: string;
    status: 'claimed' | 'owned' | 'failed' | 'human-required';
    method?: 'api' | 'browser' | 'existing';
    updatedAt: string;
    message?: string;
  }>;
};
