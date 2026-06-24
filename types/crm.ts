export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'team_leader'
  | 'call_center_rep'
  | 'sales_manager'
  | 'sales_specialist'
  | 'viewer'

export interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  email: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  department_id: string | null
  manager_id: string | null
  status: 'active' | 'inactive' | 'away'
  last_seen_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  name: string
  description: string | null
  manager_id: string | null
  is_active: boolean
}

export interface LeadSource {
  id: string
  name: string
  code: string
  color: string | null
  is_active: boolean
  sort_order: number
}

export interface LeadStatus {
  id: string
  name: string
  color: string | null
  sort_order: number
  is_final: boolean
  is_won: boolean
  is_lost: boolean
  is_active: boolean
}

export interface Lead {
  id: string
  lead_number: string
  first_name: string
  last_name: string
  full_name: string | null
  company_name: string | null
  phone: string
  phone_normalized: string
  secondary_phone: string | null
  email: string | null
  province: string | null
  district: string | null
  country: string
  source_id: string | null
  campaign_name: string | null
  campaign_id: string | null
  ad_name: string | null
  adset_name: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  requested_product: string | null
  requested_product_category: string | null
  message: string | null
  status_id: string | null
  priority: 'low' | 'normal' | 'high' | 'critical'
  temperature: 'cold' | 'warm' | 'hot'
  assigned_call_center_user_id: string | null
  assigned_sales_user_id: string | null
  assigned_at: string | null
  first_contact_at: string | null
  last_contact_at: string | null
  next_contact_at: string | null
  forwarded_to_sales_at: string | null
  converted_at: string | null
  lost_at: string | null
  lost_reason_id: string | null
  estimated_budget: number | null
  expected_purchase_date: string | null
  consent_marketing: boolean
  consent_kvkk: boolean
  consent_recorded_at: string | null
  duplicate_of_lead_id: string | null
  customer_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null

  // Joins
  lead_sources?: LeadSource
  lead_statuses?: LeadStatus
  cc_profile?: Profile
  sales_profile?: Profile
}

export interface Customer {
  id: string
  customer_number: string
  type: 'individual' | 'corporate'
  first_name: string | null
  last_name: string | null
  full_name: string | null
  company_name: string | null
  tax_office: string | null
  tax_number: string | null
  phone: string | null
  phone_normalized: string | null
  secondary_phone: string | null
  email: string | null
  website: string | null
  province: string | null
  district: string | null
  country: string | null
  address: string | null
  postal_code: string | null
  assigned_user_id: string | null
  source_id: string | null
  customer_status: string | null
  segment: 'bronze' | 'silver' | 'gold' | 'platinum' | 'standard'
  tags: string[] | null
  notes: string | null
  first_contact_at: string | null
  last_contact_at: string | null
  next_contact_at: string | null
  lead_id: string | null
  lifetime_value: number
  consent_marketing: boolean
  consent_kvkk: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null

  // Joins
  assigned_profile?: Profile
  lead_sources?: LeadSource
}

export interface Opportunity {
  id: string
  opportunity_number: string
  title: string
  customer_id: string
  lead_id: string | null
  pipeline_id: string | null
  stage_id: string | null
  assigned_user_id: string | null
  product_id: string | null
  product_name: string | null
  amount: number
  currency: string
  probability: number
  expected_close_date: string | null
  actual_close_date: string | null
  status: 'open' | 'won' | 'lost'
  source_id: string | null
  priority: 'low' | 'normal' | 'high' | 'critical'
  description: string | null
  lost_reason_id: string | null
  lost_notes: string | null
  last_activity_at: string | null
  next_activity_at: string | null
  stage_entered_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  
  // Joins
  customers?: Customer
  pipeline_stages?: PipelineStage
  assigned_profile?: Profile
}

export interface PipelineStage {
  id: string
  pipeline_id: string
  name: string
  color: string | null
  sort_order: number
  stage_type: 'new' | 'ongoing' | 'won' | 'lost'
  probability: number
  is_active: boolean
}

export interface Call {
  id: string
  lead_id: string | null
  customer_id: string | null
  user_id: string
  direction: 'incoming' | 'outgoing'
  outcome_id: string | null
  phone_number: string
  started_at: string
  answered_at: string | null
  ended_at: string | null
  duration_seconds: number
  status: 'scheduled' | 'ringing' | 'answered' | 'missed' | 'busy' | 'failed' | 'completed' | 'cancelled'
  subject: string | null
  notes: string | null
  follow_up_required: boolean
  follow_up_at: string | null
  created_at: string
  
  // Joins
  profiles?: Profile
  call_outcomes?: CallOutcome
  leads?: Lead
  customers?: Customer
}

export interface CallOutcome {
  id: string
  name: string
  color: string | null
  requires_follow_up: boolean
  converts_to_qualified: boolean
  forwards_to_sales: boolean
  marks_invalid: boolean
}

export interface Task {
  id: string
  task_number: string
  title: string
  description: string | null
  task_type: 'call' | 'callback' | 'meeting' | 'email' | 'offer' | 'visit' | 'general'
  status: 'pending' | 'ongoing' | 'completed' | 'overdue' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'critical'
  assigned_to: string | null
  assigned_by: string | null
  lead_id: string | null
  customer_id: string | null
  opportunity_id: string | null
  due_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  
  // Joins
  assignee?: Profile
  creator?: Profile
  leads?: Lead
  customers?: Customer
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  action_url: string | null
}

export interface Product {
  id: string
  name: string
  code: string | null
  category: string | null
  brand: string | null
  description: string | null
  default_price: number
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LostReason {
  id: string
  type: 'lead' | 'opportunity'
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
