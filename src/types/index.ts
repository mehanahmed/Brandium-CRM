export type LeadCategory =
  | "POP"
  | "POG"
  | "OC"
  | "APPOINTMENT"
  | "PROSPECT"
  | "BUDGET_ISSUE"
  | "CANCELLED"
  | "PENDING"
  | "IN PROGRESS"
  | "COMPLETED"
  | string;

export interface Lead {
  id: string;
  contactName: string;
  businessName: string;
  phone?: string | null;
  address?: string | null;
  category: LeadCategory;
  schedule?: string | null;
  customerType?: string | null;
  notes?: string | null;
  [key: string]: any;
}
