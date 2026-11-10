// Allowed values, copied from the CHECK constraints in db/schema/.
// Used to build dropdowns; the database still enforces them.

export const CATEGORIES = [
  'painting', 'sculpture', 'manuscript', 'textile', 'ceramic',
  'metalwork', 'photograph', 'document', 'other',
] as const;

export const STATUSES = ['on_display', 'in_storage', 'on_loan', 'under_conservation', 'deaccessioned'] as const;

export const RISKS = ['high', 'medium', 'low', 'no_provenance'] as const;

export const ACQUISITION_METHODS = [
  'purchase', 'gift', 'bequest', 'excavation',
  'field_collection', 'loan', 'transfer', 'unknown',
] as const;
