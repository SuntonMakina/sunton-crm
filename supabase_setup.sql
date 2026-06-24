-- =========================================================================
-- SUNTON CALL CENTER CRM - COMPLETE SUPABASE SCHEMA SETUP
-- Bu dosyayı kopyalayıp Supabase SQL Editor içine yapıştırıp çalıştırabilirsiniz.
-- Önceki tabloların tamamını siler ve sıfırdan kurar.
-- =========================================================================

-- 1. DROP PRE-EXISTING TRIGGERS, VIEWS, FUNCTIONS & TABLES (CASCADE ile temizleme)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

DROP TABLE IF EXISTS public.user_targets CASCADE;
DROP TABLE IF EXISTS public.app_settings CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.automation_logs CASCADE;
DROP TABLE IF EXISTS public.automations CASCADE;
DROP TABLE IF EXISTS public.entity_tags CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.lead_status_history CASCADE;
DROP TABLE IF EXISTS public.lead_assignment_history CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;
DROP TABLE IF EXISTS public.task_comments CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.calls CASCADE;
DROP TABLE IF EXISTS public.opportunity_stage_history CASCADE;
DROP TABLE IF EXISTS public.opportunities CASCADE;
DROP TABLE IF EXISTS public.pipeline_stages CASCADE;
DROP TABLE IF EXISTS public.pipelines CASCADE;
DROP TABLE IF EXISTS public.lost_reasons CASCADE;
DROP TABLE IF EXISTS public.call_outcomes CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.customer_contacts CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.lead_statuses CASCADE;
DROP TABLE IF EXISTS public.lead_sources CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP SEQUENCE IF EXISTS public.lead_number_seq CASCADE;
DROP SEQUENCE IF EXISTS public.customer_number_seq CASCADE;
DROP SEQUENCE IF EXISTS public.opportunity_number_seq CASCADE;
DROP SEQUENCE IF EXISTS public.task_number_seq CASCADE;

DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.generate_document_number() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_department() CASCADE;
DROP FUNCTION IF EXISTS public.rpc_leads_by_day(date, date) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_leads_by_source(date, date) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_leads_by_status(date, date) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_calls_by_agent(date, date) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_call_outcomes(date, date) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_pipeline_stage_stats() CASCADE;
DROP FUNCTION IF EXISTS public.rpc_conversion_funnel(date, date) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_dashboard_kpis(date, date) CASCADE;

-- 2. EXTENSIONS & SYSTEM HELPERS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shared trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. LOOKUP TABLES & ENUMS
-- departments
CREATE TABLE public.departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    manager_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_departments
    BEFORE UPDATE ON public.departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- profiles
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY, -- references auth.users(id)
    first_name text,
    last_name text,
    full_name text,
    email text NOT NULL,
    phone text,
    avatar_url text,
    role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'team_leader', 'call_center_rep', 'sales_manager', 'sales_specialist', 'viewer')),
    department_id uuid REFERENCES public.departments(id),
    manager_id uuid REFERENCES public.profiles(id),
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'away')),
    last_seen_at timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key to departments for manager_id after profiles table exists
ALTER TABLE public.departments ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id) REFERENCES public.profiles(id);

-- lead_sources
CREATE TABLE public.lead_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    code text NOT NULL UNIQUE,
    color text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_lead_sources
    BEFORE UPDATE ON public.lead_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- lead_statuses
CREATE TABLE public.lead_statuses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    color text,
    sort_order integer DEFAULT 0,
    is_final boolean DEFAULT false,
    is_won boolean DEFAULT false,
    is_lost boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_lead_statuses
    BEFORE UPDATE ON public.lead_statuses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- products
CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text UNIQUE,
    category text,
    brand text,
    description text,
    default_price numeric(15,2) DEFAULT 0.00,
    currency text DEFAULT 'TRY',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_products
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- call_outcomes
CREATE TABLE public.call_outcomes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    color text,
    requires_follow_up boolean DEFAULT false,
    converts_to_qualified boolean DEFAULT false,
    forwards_to_sales boolean DEFAULT false,
    marks_invalid boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_call_outcomes
    BEFORE UPDATE ON public.call_outcomes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- lost_reasons
CREATE TABLE public.lost_reasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('lead', 'opportunity')),
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_lost_reasons
    BEFORE UPDATE ON public.lost_reasons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- pipelines
CREATE TABLE public.pipelines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    department_id uuid REFERENCES public.departments(id),
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_pipelines
    BEFORE UPDATE ON public.pipelines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- pipeline_stages
CREATE TABLE public.pipeline_stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text,
    sort_order integer DEFAULT 0,
    stage_type text CHECK (stage_type IN ('new', 'ongoing', 'won', 'lost')),
    probability integer DEFAULT 100,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_pipeline_stages
    BEFORE UPDATE ON public.pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 4. CORE ENTITIES & DOCUMENTS
-- Sequences for autogenerated fields
CREATE SEQUENCE IF NOT EXISTS public.lead_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.customer_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.opportunity_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.task_number_seq START 1;

-- leads table
CREATE TABLE public.leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_number text UNIQUE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    full_name text,
    company_name text,
    phone text NOT NULL,
    phone_normalized text NOT NULL,
    secondary_phone text,
    email text,
    province text,
    district text,
    country text DEFAULT 'Türkiye',
    source_id uuid REFERENCES public.lead_sources(id),
    campaign_name text,
    campaign_id text,
    ad_name text,
    adset_name text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    requested_product text,
    requested_product_category text,
    message text,
    status_id uuid REFERENCES public.lead_statuses(id),
    priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    temperature text DEFAULT 'warm' CHECK (temperature IN ('cold', 'warm', 'hot')),
    assigned_call_center_user_id uuid REFERENCES public.profiles(id),
    assigned_sales_user_id uuid REFERENCES public.profiles(id),
    assigned_at timestamptz,
    first_contact_at timestamptz,
    last_contact_at timestamptz,
    next_contact_at timestamptz,
    forwarded_to_sales_at timestamptz,
    converted_at timestamptz,
    lost_at timestamptz,
    lost_reason_id uuid REFERENCES public.lost_reasons(id),
    estimated_budget numeric(15,2),
    expected_purchase_date date,
    consent_marketing boolean DEFAULT false,
    consent_kvkk boolean DEFAULT false,
    consent_recorded_at timestamptz,
    duplicate_of_lead_id uuid REFERENCES public.leads(id),
    customer_id uuid, -- foreign key constraint will be added below after customer table definition
    whatsapp_step text DEFAULT 'new' CHECK (whatsapp_step IN ('new', 'viewed', 'messaged', 'called_1', 'called_2', 'no_answer', 'proposal', 'completed')),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

CREATE TRIGGER set_updated_at_leads
    BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- customers table
CREATE TABLE public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_number text UNIQUE,
    type text DEFAULT 'individual' CHECK (type IN ('individual', 'corporate')),
    first_name text,
    last_name text,
    full_name text,
    company_name text,
    tax_office text,
    tax_number text,
    phone text,
    phone_normalized text,
    secondary_phone text,
    email text,
    website text,
    province text,
    district text,
    country text DEFAULT 'Türkiye',
    address text,
    postal_code text,
    assigned_user_id uuid REFERENCES public.profiles(id),
    source_id uuid REFERENCES public.lead_sources(id),
    customer_status text DEFAULT 'active',
    segment text DEFAULT 'standard' CHECK (segment IN ('bronze', 'silver', 'gold', 'platinum', 'standard')),
    tags text[],
    notes text,
    first_contact_at timestamptz,
    last_contact_at timestamptz,
    next_contact_at timestamptz,
    lead_id uuid REFERENCES public.leads(id),
    lifetime_value numeric(15,2) DEFAULT 0.00,
    consent_marketing boolean DEFAULT false,
    consent_kvkk boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

CREATE TRIGGER set_updated_at_customers
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Link leads.customer_id references customers(id)
ALTER TABLE public.leads ADD CONSTRAINT fk_leads_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id);

-- customer_contacts
CREATE TABLE public.customer_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    title text,
    department text,
    phone text,
    email text,
    is_primary boolean DEFAULT false,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_customer_contacts
    BEFORE UPDATE ON public.customer_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- opportunities
CREATE TABLE public.opportunities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_number text UNIQUE,
    title text NOT NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    lead_id uuid REFERENCES public.leads(id),
    pipeline_id uuid REFERENCES public.pipelines(id),
    stage_id uuid REFERENCES public.pipeline_stages(id),
    assigned_user_id uuid REFERENCES public.profiles(id),
    product_id uuid REFERENCES public.products(id),
    product_name text,
    amount numeric(15,2) DEFAULT 0.00,
    currency text DEFAULT 'TRY',
    probability integer DEFAULT 0,
    expected_close_date date,
    actual_close_date date,
    status text DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    source_id uuid REFERENCES public.lead_sources(id),
    priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    description text,
    lost_reason_id uuid REFERENCES public.lost_reasons(id),
    lost_notes text,
    last_activity_at timestamptz DEFAULT now(),
    next_activity_at timestamptz,
    stage_entered_at timestamptz DEFAULT now(),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

CREATE TRIGGER set_updated_at_opportunities
    BEFORE UPDATE ON public.opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- opportunity_stage_history
CREATE TABLE public.opportunity_stage_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
    previous_stage_id uuid REFERENCES public.pipeline_stages(id),
    new_stage_id uuid REFERENCES public.pipeline_stages(id) NOT NULL,
    changed_by uuid REFERENCES public.profiles(id),
    changed_at timestamptz DEFAULT now(),
    duration_in_previous_stage_seconds integer DEFAULT 0
);

-- calls
CREATE TABLE public.calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
    user_id uuid REFERENCES public.profiles(id),
    direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    outcome_id uuid REFERENCES public.call_outcomes(id),
    phone_number text NOT NULL,
    started_at timestamptz DEFAULT now(),
    answered_at timestamptz,
    ended_at timestamptz,
    duration_seconds integer DEFAULT 0,
    waiting_seconds integer DEFAULT 0,
    status text NOT NULL CHECK (status IN ('scheduled', 'ringing', 'answered', 'missed', 'busy', 'failed', 'completed', 'cancelled')),
    subject text,
    notes text,
    recording_url text,
    external_call_id text,
    provider text,
    follow_up_required boolean DEFAULT false,
    follow_up_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_calls
    BEFORE UPDATE ON public.calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- tasks
CREATE TABLE public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_number text UNIQUE,
    title text NOT NULL,
    description text,
    task_type text NOT NULL CHECK (task_type IN ('call', 'callback', 'meeting', 'email', 'offer', 'visit', 'general')),
    status text NOT NULL CHECK (status IN ('pending', 'ongoing', 'completed', 'overdue', 'cancelled')),
    priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    assigned_to uuid REFERENCES public.profiles(id),
    assigned_by uuid REFERENCES public.profiles(id),
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
    parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
    start_at timestamptz,
    due_at timestamptz,
    completed_at timestamptz,
    reminder_at timestamptz,
    is_recurring boolean DEFAULT false,
    recurrence_rule text,
    estimated_minutes integer DEFAULT 0,
    actual_minutes integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id),
    updated_by uuid REFERENCES public.profiles(id)
);

CREATE TRIGGER set_updated_at_tasks
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- task_comments
CREATE TABLE public.task_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id),
    comment text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_task_comments
    BEFORE UPDATE ON public.task_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- calendar_events
CREATE TABLE public.calendar_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    event_type text CHECK (event_type IN ('meeting', 'call', 'visit', 'personal', 'reminder')),
    user_id uuid REFERENCES public.profiles(id),
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
    task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    all_day boolean DEFAULT false,
    location text,
    meeting_url text,
    reminder_minutes integer DEFAULT 15,
    status text DEFAULT 'confirmed',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_calendar_events
    BEFORE UPDATE ON public.calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- conversations
CREATE TABLE public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    channel text NOT NULL CHECK (channel IN ('system', 'internal', 'whatsapp', 'email', 'chat', 'sms')),
    assigned_user_id uuid REFERENCES public.profiles(id),
    status text DEFAULT 'open' CHECK (status IN ('open', 'snoozed', 'closed')),
    last_message_at timestamptz DEFAULT now(),
    unread_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_conversations
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- messages
CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_type text NOT NULL CHECK (sender_type IN ('user', 'client', 'system')),
    sender_user_id uuid REFERENCES public.profiles(id),
    direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    channel text NOT NULL CHECK (channel IN ('system', 'internal', 'whatsapp', 'email', 'chat', 'sms')),
    content text NOT NULL,
    attachment_url text,
    external_message_id text,
    delivery_status text DEFAULT 'sent' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    read_at timestamptz,
    sent_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- notifications
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('new_lead', 'lead_assigned', 'task_assigned', 'task_approaching', 'task_overdue', 'callback_due', 'opportunity_updated', 'forwarded_to_sales', 'automation', 'system')),
    title text NOT NULL,
    message text NOT NULL,
    entity_type text,
    entity_id uuid,
    action_url text,
    is_read boolean DEFAULT false,
    read_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- lead_assignment_history
CREATE TABLE public.lead_assignment_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    previous_call_center_user_id uuid REFERENCES public.profiles(id),
    new_call_center_user_id uuid REFERENCES public.profiles(id),
    previous_sales_user_id uuid REFERENCES public.profiles(id),
    new_sales_user_id uuid REFERENCES public.profiles(id),
    assignment_type text DEFAULT 'manual' CHECK (assignment_type IN ('manual', 'automatic')),
    assigned_by uuid REFERENCES public.profiles(id),
    assigned_at timestamptz DEFAULT now(),
    notes text
);

-- lead_status_history
CREATE TABLE public.lead_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
    previous_status_id uuid REFERENCES public.lead_statuses(id),
    new_status_id uuid REFERENCES public.lead_statuses(id) NOT NULL,
    changed_by uuid REFERENCES public.profiles(id),
    changed_at timestamptz DEFAULT now(),
    notes text
);

-- activities (customer/lead timeline view)
CREATE TABLE public.activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL CHECK (entity_type IN ('lead', 'customer', 'opportunity', 'task')),
    entity_id uuid NOT NULL,
    activity_type text NOT NULL CHECK (activity_type IN ('lead_created', 'lead_assigned', 'status_changed', 'call_made', 'note_added', 'task_created', 'task_completed', 'forwarded_to_sales', 'opportunity_created', 'pipeline_changed', 'converted_to_customer', 'message_sent', 'whatsapp_step_changed')),
    title text NOT NULL,
    description text,
    user_id uuid REFERENCES public.profiles(id),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- notes
CREATE TABLE public.notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL CHECK (entity_type IN ('lead', 'customer', 'opportunity', 'task')),
    entity_id uuid NOT NULL,
    content text NOT NULL,
    is_pinned boolean DEFAULT false,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_notes
    BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- tags & entity_tags
CREATE TABLE public.tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    color text,
    entity_type text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE(name, entity_type)
);

CREATE TABLE public.entity_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(tag_id, entity_type, entity_id)
);

-- automations
CREATE TABLE public.automations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    trigger_type text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb,
    condition_config jsonb DEFAULT '{}'::jsonb,
    action_type text NOT NULL,
    action_config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    run_count integer DEFAULT 0,
    last_run_at timestamptz,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_automations
    BEFORE UPDATE ON public.automations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.automation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id uuid REFERENCES public.automations(id) ON DELETE CASCADE,
    entity_type text,
    entity_id uuid,
    status text NOT NULL CHECK (status IN ('success', 'failed')),
    input_data jsonb DEFAULT '{}'::jsonb,
    output_data jsonb DEFAULT '{}'::jsonb,
    error_message text,
    executed_at timestamptz DEFAULT now()
);

-- audit_logs
CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    previous_data jsonb,
    new_data jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz DEFAULT now()
);

-- app_settings
CREATE TABLE public.app_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL,
    category text DEFAULT 'general',
    description text,
    is_public boolean DEFAULT false,
    updated_by uuid REFERENCES public.profiles(id),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_app_settings
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- user_targets
CREATE TABLE public.user_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_type text DEFAULT 'monthly' CHECK (period_type IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    period_start date NOT NULL,
    period_end date NOT NULL,
    target_leads integer DEFAULT 0,
    target_calls integer DEFAULT 0,
    target_qualified_leads integer DEFAULT 0,
    target_sales integer DEFAULT 0,
    target_revenue numeric(15,2) DEFAULT 0.00,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_updated_at_user_targets
    BEFORE UPDATE ON public.user_targets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 5. AUTOMATIC DOCUMENT NUMBER TRIGGER
CREATE OR REPLACE FUNCTION generate_document_number()
RETURNS TRIGGER AS $$
DECLARE
    curr_year text := to_char(now(), 'YYYY');
    seq_val bigint;
BEGIN
    IF TG_TABLE_NAME = 'leads' THEN
        seq_val := nextval('public.lead_number_seq');
        NEW.lead_number := 'LD-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
    ELSIF TG_TABLE_NAME = 'customers' THEN
        seq_val := nextval('public.customer_number_seq');
        NEW.customer_number := 'MS-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
    ELSIF TG_TABLE_NAME = 'opportunities' THEN
        seq_val := nextval('public.opportunity_number_seq');
        NEW.opportunity_number := 'FR-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
    ELSIF TG_TABLE_NAME = 'tasks' THEN
        seq_val := nextval('public.task_number_seq');
        NEW.task_number := 'TS-' || curr_year || '-' || lpad(seq_val::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lead_number_gen BEFORE INSERT ON public.leads FOR EACH ROW WHEN (NEW.lead_number IS NULL) EXECUTE FUNCTION generate_document_number();
CREATE TRIGGER trigger_customer_number_gen BEFORE INSERT ON public.customers FOR EACH ROW WHEN (NEW.customer_number IS NULL) EXECUTE FUNCTION generate_document_number();
CREATE TRIGGER trigger_opportunity_number_gen BEFORE INSERT ON public.opportunities FOR EACH ROW WHEN (NEW.opportunity_number IS NULL) EXECUTE FUNCTION generate_document_number();
CREATE TRIGGER trigger_task_number_gen BEFORE INSERT ON public.tasks FOR EACH ROW WHEN (NEW.task_number IS NULL) EXECUTE FUNCTION generate_document_number();


-- 6. SYSTEM PROFILE INITIALIZATION VIA TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    default_role text := 'call_center_rep';
    v_first_name text;
    v_last_name text;
    v_full_name text;
    v_role text;
BEGIN
    v_first_name := coalesce(new.raw_user_meta_data->>'first_name', split_part(new.raw_user_meta_data->>'full_name', ' ', 1));
    v_last_name := coalesce(new.raw_user_meta_data->>'last_name', split_part(new.raw_user_meta_data->>'full_name', ' ', 2));
    v_full_name := coalesce(new.raw_user_meta_data->>'full_name', (v_first_name || ' ' || v_last_name));
    
    -- Veritabanında henüz hiç profil kaydı yoksa, kayıt olan ilk kullanıcıyı super_admin yap.
    IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
        v_role := 'super_admin';
    ELSE
        v_role := coalesce(new.raw_user_meta_data->>'role', default_role);
        IF v_role NOT IN ('super_admin', 'admin', 'team_leader', 'call_center_rep', 'sales_manager', 'sales_specialist', 'viewer') THEN
            v_role := default_role;
        END IF;
    END IF;

    INSERT INTO public.profiles (
        id,
        first_name,
        last_name,
        full_name,
        email,
        phone,
        avatar_url,
        role,
        status,
        is_active
    ) VALUES (
        new.id,
        v_first_name,
        v_last_name,
        v_full_name,
        new.email,
        new.phone,
        new.raw_user_meta_data->>'avatar_url',
        v_role,
        'active',
        true
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =========================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- RLS Helper Functions (Avoid infinite recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN coalesce(v_role, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_my_department()
RETURNS uuid AS $$
DECLARE
    v_dept uuid;
BEGIN
    SELECT department_id INTO v_dept FROM public.profiles WHERE id = auth.uid();
    RETURN v_dept;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_targets ENABLE ROW LEVEL SECURITY;

-- 8. POLICIES DEFINITION
-- Departments
CREATE POLICY "Public Read Departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All Departments" ON public.departments FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Profiles
CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users Self Update Profiles" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admin All Profiles" ON public.profiles FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Lookups & System Settings
CREATE POLICY "Public Read Lookups" ON public.lead_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Manage Lookups" ON public.lead_sources FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "Public Read Statuses" ON public.lead_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Manage Statuses" ON public.lead_statuses FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "Public Read Products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Manage Products" ON public.products FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "Public Read Call Outcomes" ON public.call_outcomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Manage Call Outcomes" ON public.call_outcomes FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "Public Read Lost Reasons" ON public.lost_reasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Manage Lost Reasons" ON public.lost_reasons FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "Public Read Pipelines" ON public.pipelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Manage Pipelines" ON public.pipelines FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "Public Read Pipeline Stages" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Manage Pipeline Stages" ON public.pipeline_stages FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "Public Read App Settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Manage App Settings" ON public.app_settings FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "Public Read Tags" ON public.tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Manage Tags" ON public.tags FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- CRM Leads Security
CREATE POLICY "Leads RLS Policy" ON public.leads FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager') OR
    (public.get_my_role() = 'team_leader' AND (assigned_call_center_user_id IN (SELECT id FROM public.profiles WHERE department_id = public.get_my_department()) OR assigned_sales_user_id IN (SELECT id FROM public.profiles WHERE department_id = public.get_my_department()))) OR
    (public.get_my_role() = 'call_center_rep' AND assigned_call_center_user_id = auth.uid()) OR
    (public.get_my_role() = 'sales_specialist' AND assigned_sales_user_id = auth.uid())
);

-- CRM Customers Security
CREATE POLICY "Customers RLS Policy" ON public.customers FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager', 'team_leader', 'call_center_rep') OR
    (public.get_my_role() = 'sales_specialist' AND assigned_user_id = auth.uid())
);

-- Customer Contacts
CREATE POLICY "Customer Contacts RLS Policy" ON public.customer_contacts FOR ALL TO authenticated USING (true);

-- CRM Opportunities Security
CREATE POLICY "Opportunities RLS Policy" ON public.opportunities FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager') OR
    (public.get_my_role() = 'sales_specialist' AND assigned_user_id = auth.uid())
);

CREATE POLICY "Opportunity Stage History RLS Policy" ON public.opportunity_stage_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Opportunity Stage History Write" ON public.opportunity_stage_history FOR INSERT TO authenticated WITH CHECK (true);

-- Call Log Security
CREATE POLICY "Calls RLS Policy" ON public.calls FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager', 'team_leader') OR
    user_id = auth.uid()
);

-- Tasks & Checklist Security
CREATE POLICY "Tasks RLS Policy" ON public.tasks FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin') OR
    assigned_to = auth.uid() OR
    assigned_by = auth.uid()
);

CREATE POLICY "Task Comments RLS Policy" ON public.task_comments FOR ALL TO authenticated USING (true);

-- Calendar Schedules
CREATE POLICY "Calendar Events RLS Policy" ON public.calendar_events FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin') OR
    user_id = auth.uid()
);

-- Real-time Messages & Channels
CREATE POLICY "Conversations RLS Policy" ON public.conversations FOR ALL TO authenticated USING (true);
CREATE POLICY "Messages RLS Policy" ON public.messages FOR ALL TO authenticated USING (true);

-- Notifications (Strict user separation)
CREATE POLICY "Notifications User Specific" ON public.notifications FOR ALL TO authenticated USING (
    user_id = auth.uid()
);

-- Timelines, Histories & Logs
CREATE POLICY "Lead Assignment History RLS" ON public.lead_assignment_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lead Assignment History Write" ON public.lead_assignment_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Lead Status History RLS" ON public.lead_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lead Status History Write" ON public.lead_status_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Activities RLS" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Activities Write" ON public.activities FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Notes RLS" ON public.notes FOR ALL TO authenticated USING (true);
CREATE POLICY "Entity Tags RLS" ON public.entity_tags FOR ALL TO authenticated USING (true);

-- System Automations
CREATE POLICY "Automations RLS" ON public.automations FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin')
);
CREATE POLICY "Automation Logs RLS" ON public.automation_logs FOR SELECT TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin')
);

-- Security Auditing
CREATE POLICY "Audit Logs Admin Only" ON public.audit_logs FOR SELECT TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin')
);
CREATE POLICY "Audit Logs Write" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Performance Targets
CREATE POLICY "User Targets RLS" ON public.user_targets FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager') OR
    user_id = auth.uid()
);


-- =========================================================================
-- 9. ANALYTICS & DATABASE VIEWS & RPC FUNCTIONS
-- =========================================================================

-- Daily Leads Trend
CREATE OR REPLACE FUNCTION public.rpc_leads_by_day(p_start_date date, p_end_date date)
RETURNS TABLE (
    lead_date date,
    lead_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.created_at::date as lead_date,
        count(*)::bigint as lead_count
    FROM public.leads l
    WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date
      AND l.is_active = true
    GROUP BY l.created_at::date
    ORDER BY lead_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Leads by Source
CREATE OR REPLACE FUNCTION public.rpc_leads_by_source(p_start_date date, p_end_date date)
RETURNS TABLE (
    source_name text,
    lead_count bigint,
    color text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.name as source_name,
        count(l.id)::bigint as lead_count,
        max(s.color) as color
    FROM public.leads l
    JOIN public.lead_sources s ON l.source_id = s.id
    WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date
      AND l.is_active = true
    GROUP BY s.name
    ORDER BY lead_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Leads by Status
CREATE OR REPLACE FUNCTION public.rpc_leads_by_status(p_start_date date, p_end_date date)
RETURNS TABLE (
    status_name text,
    lead_count bigint,
    color text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.name as status_name,
        count(l.id)::bigint as lead_count,
        max(s.color) as color
    FROM public.leads l
    JOIN public.lead_statuses s ON l.status_id = s.id
    WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date
      AND l.is_active = true
    GROUP BY s.name
    ORDER BY lead_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- User Call Performance
CREATE OR REPLACE FUNCTION public.rpc_calls_by_agent(p_start_date date, p_end_date date)
RETURNS TABLE (
    agent_name text,
    call_count bigint,
    total_duration_seconds bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.full_name as agent_name,
        count(c.id)::bigint as call_count,
        sum(coalesce(c.duration_seconds, 0))::bigint as total_duration_seconds
    FROM public.calls c
    JOIN public.profiles p ON c.user_id = p.id
    WHERE c.started_at::date >= p_start_date AND c.started_at::date <= p_end_date
    GROUP BY p.full_name
    ORDER BY call_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Call Outcome Distributions
CREATE OR REPLACE FUNCTION public.rpc_call_outcomes(p_start_date date, p_end_date date)
RETURNS TABLE (
    outcome_name text,
    call_count bigint,
    color text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.name as outcome_name,
        count(c.id)::bigint as call_count,
        max(o.color) as color
    FROM public.calls c
    JOIN public.call_outcomes o ON c.outcome_id = o.id
    WHERE c.started_at::date >= p_start_date AND c.started_at::date <= p_end_date
    GROUP BY o.name
    ORDER BY call_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Sales Pipeline values
CREATE OR REPLACE FUNCTION public.rpc_pipeline_stage_stats()
RETURNS TABLE (
    stage_name text,
    opportunity_count bigint,
    total_amount numeric,
    color text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ps.name as stage_name,
        count(o.id)::bigint as opportunity_count,
        coalesce(sum(o.amount), 0)::numeric as total_amount,
        max(ps.color) as color
    FROM public.pipeline_stages ps
    LEFT JOIN public.opportunities o ON o.stage_id = ps.id AND o.is_active = true
    GROUP BY ps.id, ps.name, ps.sort_order
    ORDER BY ps.sort_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Funnel Analytics
CREATE OR REPLACE FUNCTION public.rpc_conversion_funnel(p_start_date date, p_end_date date)
RETURNS TABLE (
    stage text,
    lead_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT '1. Toplam Lead'::text as stage, count(l.id)::bigint as lead_count FROM public.leads l WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date AND l.is_active = true
    UNION ALL
    SELECT '2. Görüşülen Lead'::text as stage, count(distinct l.id)::bigint as lead_count FROM public.leads l JOIN public.calls c ON c.lead_id = l.id WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date AND l.is_active = true AND c.status = 'completed'
    UNION ALL
    SELECT '3. Nitelikli Lead'::text as stage, count(l.id)::bigint as lead_count FROM public.leads l JOIN public.lead_statuses s ON l.status_id = s.id WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date AND l.is_active = true AND s.name = 'Nitelikli Lead'
    UNION ALL
    SELECT '4. Satışa İletilen'::text as stage, count(l.id)::bigint as lead_count FROM public.leads l WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date AND l.is_active = true AND l.forwarded_to_sales_at IS NOT NULL
    UNION ALL
    SELECT '5. Müşteriye Dönüşen'::text as stage, count(l.id)::bigint as lead_count FROM public.leads l WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date AND l.is_active = true AND l.converted_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Dashboard KPIs summary
CREATE OR REPLACE FUNCTION public.rpc_dashboard_kpis(p_start_date date, p_end_date date)
RETURNS jsonb AS $$
DECLARE
    v_total_leads bigint;
    v_new_leads bigint;
    v_pending_assign bigint;
    v_cc_assigned bigint;
    v_calls_made bigint;
    v_call_duration bigint;
    v_open_tasks bigint;
    v_overdue_tasks bigint;
    v_open_deals_val numeric;
    v_won_deals_val numeric;
    v_conversion_rate numeric;
    v_result jsonb;
BEGIN
    SELECT count(*)::bigint INTO v_total_leads FROM public.leads l WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date AND l.is_active = true;
    
    SELECT count(*)::bigint INTO v_new_leads FROM public.leads l 
    JOIN public.lead_statuses s ON l.status_id = s.id
    WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date AND l.is_active = true AND s.name = 'Yeni Lead';
    
    SELECT count(*)::bigint INTO v_pending_assign FROM public.leads l 
    JOIN public.lead_statuses s ON l.status_id = s.id
    WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date AND l.is_active = true AND s.name = 'Atama Bekliyor';
    
    SELECT count(*)::bigint INTO v_cc_assigned FROM public.leads l 
    JOIN public.lead_statuses s ON l.status_id = s.id
    WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date AND l.is_active = true AND s.name = 'Call Center’a Atandı';
    
    SELECT count(*)::bigint INTO v_calls_made FROM public.calls c WHERE c.started_at::date >= p_start_date AND c.started_at::date <= p_end_date;
    SELECT sum(coalesce(c.duration_seconds, 0))::bigint INTO v_call_duration FROM public.calls c WHERE c.started_at::date >= p_start_date AND c.started_at::date <= p_end_date;
    
    SELECT count(*)::bigint INTO v_open_tasks FROM public.tasks t WHERE t.status IN ('pending', 'ongoing');
    SELECT count(*)::bigint INTO v_overdue_tasks FROM public.tasks t WHERE t.status = 'overdue' OR (t.status IN ('pending', 'ongoing') AND t.due_at < now());
    
    SELECT coalesce(sum(o.amount), 0)::numeric INTO v_open_deals_val FROM public.opportunities o WHERE o.status = 'open' AND o.is_active = true;
    SELECT coalesce(sum(o.amount), 0)::numeric INTO v_won_deals_val FROM public.opportunities o WHERE o.status = 'won' AND o.is_active = true AND o.actual_close_date >= p_start_date AND o.actual_close_date <= p_end_date;
    
    IF v_total_leads > 0 THEN
        v_conversion_rate := round((count(l.id) FILTER (WHERE l.converted_at IS NOT NULL)::numeric / v_total_leads::numeric) * 100.0, 2)
        FROM public.leads l WHERE l.created_at::date >= p_start_date AND l.created_at::date <= p_end_date AND l.is_active = true;
    ELSE
        v_conversion_rate := 0.00;
    END IF;

    v_result := jsonb_build_object(
        'total_leads', v_total_leads,
        'new_leads', v_new_leads,
        'pending_assign', v_pending_assign,
        'cc_assigned', v_cc_assigned,
        'calls_made', v_calls_made,
        'call_duration_seconds', coalesce(v_call_duration, 0),
        'open_tasks', v_open_tasks,
        'overdue_tasks', v_overdue_tasks,
        'open_deals_value', v_open_deals_val,
        'won_deals_value', v_won_deals_val,
        'conversion_rate', coalesce(v_conversion_rate, 0.00)
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- =========================================================================
-- 10. SYSTEM SEED DATA & LOOKUPS
-- =========================================================================

-- Departments
INSERT INTO public.departments (id, name, description, is_active) VALUES
('eeeeeeee-0000-0000-0000-000000000001', 'Yönetim', 'Şirket üst düzey yönetimi', true),
('eeeeeeee-0000-0000-0000-000000000002', 'Call Center', 'Arama ve müşteri karşılama ekibi', true),
('eeeeeeee-0000-0000-0000-000000000003', 'Satış', 'Satış ve saha operasyon ekibi', true),
('eeeeeeee-0000-0000-0000-000000000004', 'Pazarlama', 'Reklam ve marka yönetimi', true),
('eeeeeeee-0000-0000-0000-000000000005', 'Servis', 'Teknik servis ve yedek parça', true)
ON CONFLICT (name) DO NOTHING;

-- Lead Sources
INSERT INTO public.lead_sources (id, name, code, color, sort_order, is_active) VALUES
('11111111-0000-0000-0000-000000000001', 'Meta Reklam', 'META_ADS', '#1877F2', 1, true),
('11111111-0000-0000-0000-000000000002', 'Google Ads', 'GOOGLE_ADS', '#4285F4', 2, true),
('11111111-0000-0000-0000-000000000003', 'Instagram', 'INSTAGRAM', '#E1306C', 3, true),
('11111111-0000-0000-0000-000000000004', 'Facebook', 'FACEBOOK', '#3B5998', 4, true),
('11111111-0000-0000-0000-000000000005', 'WhatsApp', 'WHATSAPP', '#25D366', 5, true),
('11111111-0000-0000-0000-000000000006', 'Web Sitesi', 'WEBSITE', '#00BCD4', 6, true),
('11111111-0000-0000-0000-000000000007', 'Telefon', 'PHONE', '#4CAF50', 7, true),
('11111111-0000-0000-0000-000000000008', 'E-posta', 'EMAIL', '#FF9800', 8, true),
('11111111-0000-0000-0000-000000000009', 'Fuar', 'FAIR', '#9C27B0', 9, true),
('11111111-0000-0000-0000-000000000010', 'Referans', 'REFERENCE', '#795548', 10, true),
('11111111-0000-0000-0000-000000000011', 'Organik', 'ORGANIC', '#607D8B', 11, true),
('11111111-0000-0000-0000-000000000012', 'Manuel Kayıt', 'MANUAL', '#3F51B5', 12, true),
('11111111-0000-0000-0000-000000000013', 'Diğer', 'OTHER', '#9E9E9E', 13, true)
ON CONFLICT (name) DO NOTHING;

-- Lead Statuses
INSERT INTO public.lead_statuses (id, name, color, sort_order, is_final, is_won, is_lost, is_active) VALUES
('22222222-0000-0000-0000-000000000001', 'Yeni Lead', '#2196F3', 1, false, false, false, true),
('22222222-0000-0000-0000-000000000002', 'Atama Bekliyor', '#FF9800', 2, false, false, false, true),
('22222222-0000-0000-0000-000000000003', 'Call Center’a Atandı', '#9C27B0', 3, false, false, false, true),
('22222222-0000-0000-0000-000000000004', 'İlk Arama Yapılacak', '#3F51B5', 4, false, false, false, true),
('22222222-0000-0000-0000-000000000005', 'Ulaşılamadı', '#E91E63', 5, false, false, false, true),
('22222222-0000-0000-0000-000000000006', 'Geri Aranacak', '#00BCD4', 6, false, false, false, true),
('22222222-0000-0000-0000-000000000007', 'Görüşme Yapıldı', '#4CAF50', 7, false, false, false, true),
('22222222-0000-0000-0000-000000000008', 'Nitelikli Lead', '#8BC34A', 8, false, false, false, true),
('22222222-0000-0000-0000-000000000009', 'Satış Uzmanına İletildi', '#009688', 9, false, false, false, true),
('22222222-0000-0000-0000-000000000010', 'Satış Sürecinde', '#CDDC39', 10, false, false, false, true),
('22222222-0000-0000-0000-000000000011', 'Satışa Dönüştü', '#4CAF50', 11, true, true, false, true),
('22222222-0000-0000-0000-000000000012', 'İlgilenmiyor', '#9E9E9E', 12, true, false, true, true),
('22222222-0000-0000-0000-000000000013', 'Geçersiz Lead', '#F44336', 13, true, false, true, true),
('22222222-0000-0000-0000-000000000014', 'Mükerrer Kayıt', '#795548', 14, true, false, true, true),
('22222222-0000-0000-0000-000000000015', 'Kara Liste', '#212121', 15, true, false, true, true)
ON CONFLICT (name) DO NOTHING;

-- Call Outcomes
INSERT INTO public.call_outcomes (id, name, color, requires_follow_up, converts_to_qualified, forwards_to_sales, marks_invalid, sort_order, is_active) VALUES
('33333333-0000-0000-0000-000000000001', 'Ulaşıldı', '#4CAF50', false, false, false, false, 1, true),
('33333333-0000-0000-0000-000000000002', 'Ulaşılamadı', '#E91E63', true, false, false, false, 2, true),
('33333333-0000-0000-0000-000000000003', 'Telefon Kapalı', '#9E9E9E', true, false, false, false, 3, true),
('33333333-0000-0000-0000-000000000004', 'Meşgul', '#FF9800', true, false, false, false, 4, true),
('33333333-0000-0000-0000-000000000005', 'Cevap Vermedi', '#FFC107', true, false, false, false, 5, true),
('33333333-0000-0000-0000-000000000006', 'Numara Hatalı', '#F44336', false, false, false, true, 6, true),
('33333333-0000-0000-0000-000000000007', 'Daha Sonra Aranacak', '#00BCD4', true, false, false, false, 7, true),
('33333333-0000-0000-0000-000000000008', 'Bilgi Verildi', '#8BC34A', false, false, false, false, 8, true),
('33333333-0000-0000-0000-000000000009', 'Teklif Talep Ediyor', '#3F51B5', true, true, false, false, 9, true),
('33333333-0000-0000-0000-000000000010', 'Satın Alma Planı Var', '#009688', true, true, true, false, 10, true),
('33333333-0000-0000-0000-000000000011', 'İlgileniyor', '#4CAF50', true, false, false, false, 11, true),
('33333333-0000-0000-0000-000000000012', 'İlgilenmiyor', '#9E9E9E', false, false, false, false, 12, true),
('33333333-0000-0000-0000-000000000013', 'Satış Uzmanına İletildi', '#9C27B0', false, false, true, false, 13, true),
('33333333-0000-0000-0000-000000000014', 'Satış Gerçekleşti', '#4CAF50', false, false, false, false, 14, true),
('33333333-0000-0000-0000-000000000015', 'Servise Yönlendirildi', '#2196F3', false, false, false, false, 15, true),
('33333333-0000-0000-0000-000000000016', 'Mükerrer Kayıt', '#795548', false, false, false, true, 16, true),
('33333333-0000-0000-0000-000000000017', 'Kara Liste', '#212121', false, false, false, true, 17, true)
ON CONFLICT (name) DO NOTHING;

-- Products
INSERT INTO public.products (id, name, code, category, brand, description, default_price, currency, is_active) VALUES
('44444444-0000-0000-0000-000000000001', 'Plaka Lazer Kesim Makinesi 3kW', 'LZR-PLK-3KW', 'Plaka Lazer Kesim', 'Sunton', '3kW fiber lazer gücüne sahip yüksek hızlı plaka kesim makinesi.', 2500000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000002', 'Plaka Lazer Kesim Makinesi 6kW', 'LZR-PLK-6KW', 'Plaka Lazer Kesim', 'Sunton', '6kW fiber lazer gücüne sahip endüstriyel plaka kesim makinesi.', 4200000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000003', 'Boru ve Profil Lazer Kesim Makinesi', 'LZR-BORU-3KW', 'Boru ve Profil Lazer Kesim', 'Sunton', 'Profesyonel boru ve profil kesim sistemi.', 3800000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000004', 'Abkant Pres 100 Ton', 'ABK-100T', 'Abkant Pres', 'Sunton', '100 ton bükme gücüne sahip CNC kontrollü abkant pres.', 1200000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000005', 'Abkant Pres 220 Ton', 'ABK-220T', 'Abkant Pres', 'Sunton', '220 ton bükme kapasiteli ağır hizmet CNC abkant pres.', 2100000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000006', 'Robotik Kaynak Hücresi', 'ROB-KAYNAK', 'Kaynak Sistemleri', 'Sunton', 'Endüstriyel kaynak işlemlerinde kullanılan otomatik robot hücresi.', 1800000.00, 'TRY', true),
('44444444-0000-0000-0000-000000000007', 'Lazer Kaynak Makinesi 1.5kW', 'LZR-KAY-1.5KW', 'Kaynak Sistemleri', 'Sunton', 'El tipi hassas lazer kaynak makinesi.', 450000.00, 'TRY', true)
ON CONFLICT (code) DO NOTHING;

-- Lost Reasons
INSERT INTO public.lost_reasons (id, type, name, description, is_active, sort_order) VALUES
('55555555-0000-0000-0000-000000000001', 'lead', 'Fiyat Yüksek Bulundu', 'Fiyatın rakiplere veya bütçeye göre yüksek olması', true, 1),
('55555555-0000-0000-0000-000000000002', 'lead', 'Rakip Tercih Edildi', 'Müşterinin başka bir firmayı tercih etmesi', true, 2),
('55555555-0000-0000-0000-000000000003', 'lead', 'Yatırım Ertelendi', 'Müşterinin yatırımı ileri bir tarihe ertelemesi', true, 3),
('55555555-0000-0000-0000-000000000004', 'lead', 'Ulaşılamadı', 'Tüm aramalara rağmen müşteriye ulaşılamamış olması', true, 4),
('55555555-0000-0000-0000-000000000005', 'lead', 'İlgilenmiyor / Yanlış Kayıt', 'Reklam formunun yanlışlıkla doldurulmuş olması', true, 5),
('55555555-0000-0000-0000-000000000006', 'opportunity', 'Fiyat Yüksek Bulundu', 'Teklif edilen bütçenin müşteri limitlerini aşması', true, 1),
('55555555-0000-0000-0000-000000000007', 'opportunity', 'Rakip Tercih Edildi', 'Rakiplerin teknik servis veya vade koşulları nedeniyle seçilmesi', true, 2),
('55555555-0000-0000-0000-000000000008', 'opportunity', 'Bütçe İptal Edildi', 'Müşteri bütçesinin başka departmana kaydırılması', true, 3),
('55555555-0000-0000-0000-000000000009', 'opportunity', 'Finansman Sorunu', 'Müşterinin leasing veya banka kredisi alamamış olması', true, 4),
('55555555-0000-0000-0000-000000000010', 'opportunity', 'Ürün Uygun Değil', 'Sunton ürünlerinin müşteri teknik şartnamesini karşılamaması', true, 5)
ON CONFLICT (id) DO NOTHING;

-- Pipelines & Stages
INSERT INTO public.pipelines (id, name, description, is_default, is_active) VALUES
('66666666-0000-0000-0000-000000000001', 'Makine Satış Pipeline', 'Ana makine satış süreci takibi', true, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.pipeline_stages (id, pipeline_id, name, color, sort_order, stage_type, probability, is_active) VALUES
('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', 'Yeni Fırsat', '#E3F2FD', 1, 'new', 10, true),
('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001', 'İlk Görüşme', '#BBDEFB', 2, 'ongoing', 20, true),
('77777777-0000-0000-0000-000000000003', '66666666-0000-0000-0000-000000000001', 'İhtiyaç Analizi', '#90CAF9', 3, 'ongoing', 35, true),
('77777777-0000-0000-0000-000000000004', '66666666-0000-0000-0000-000000000001', 'Ürün Belirlendi', '#64B5F6', 4, 'ongoing', 50, true),
('77777777-0000-0000-0000-000000000005', '66666666-0000-0000-0000-000000000001', 'Teklif Hazırlanıyor', '#42A5F5', 5, 'ongoing', 60, true),
('77777777-0000-0000-0000-000000000006', '66666666-0000-0000-0000-000000000001', 'Teklif Gönderildi', '#2196F3', 6, 'ongoing', 70, true),
('77777777-0000-0000-0000-000000000007', '66666666-0000-0000-0000-000000000001', 'Teklif Takibi', '#1E88E5', 7, 'ongoing', 80, true),
('77777777-0000-0000-0000-000000000008', '66666666-0000-0000-0000-000000000001', 'Müzakere', '#1976D2', 8, 'ongoing', 90, true),
('77777777-0000-0000-0000-000000000009', '66666666-0000-0000-0000-000000000001', 'Karar Bekleniyor', '#1565C0', 9, 'ongoing', 95, true),
('77777777-0000-0000-0000-000000000010', '66666666-0000-0000-0000-000000000001', 'Satış Kazanıldı', '#4CAF50', 10, 'won', 100, true),
('77777777-0000-0000-0000-000000000011', '66666666-0000-0000-0000-000000000001', 'Satış Kaybedildi', '#F44336', 11, 'lost', 0, true)
ON CONFLICT DO NOTHING;

-- Demo User Profiles (Virtual users for tracking & reports)
INSERT INTO public.profiles (id, first_name, last_name, full_name, email, phone, role, department_id, status, is_active) VALUES
('88888888-0000-0000-0000-000000000001', 'Bülent', 'Koç', 'Bülent Koç', 'bulent.koc@suntoncrm.com', '05321111111', 'admin', 'eeeeeeee-0000-0000-0000-000000000001', 'active', true),
('88888888-0000-0000-0000-000000000002', 'Ceren', 'Aydın', 'Ceren Aydın', 'ceren.aydin@suntoncrm.com', '05322222222', 'team_leader', 'eeeeeeee-0000-0000-0000-000000000002', 'active', true),
('88888888-0000-0000-0000-000000000003', 'Ahmet', 'Yılmaz', 'Ahmet Yılmaz', 'ahmet.yilmaz@suntoncrm.com', '05323333333', 'call_center_rep', 'eeeeeeee-0000-0000-0000-000000000002', 'active', true),
('88888888-0000-0000-0000-000000000004', 'Zeynep', 'Demir', 'Zeynep Demir', 'zeynep.demir@suntoncrm.com', '05324444444', 'call_center_rep', 'eeeeeeee-0000-0000-0000-000000000002', 'active', true),
('88888888-0000-0000-0000-000000000005', 'Can', 'Kaya', 'Can Kaya', 'can.kaya@suntoncrm.com', '05325555555', 'call_center_rep', 'eeeeeeee-0000-0000-0000-000000000002', 'active', true),
('88888888-0000-0000-0000-000000000006', 'Merve', 'Çelik', 'Merve Çelik', 'merve.celik@suntoncrm.com', '05326666666', 'call_center_rep', 'eeeeeeee-0000-0000-0000-000000000002', 'active', true),
('88888888-0000-0000-0000-000000000007', 'Serkan', 'Bulut', 'Serkan Bulut', 'serkan.bulut@suntoncrm.com', '05327777777', 'sales_manager', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('88888888-0000-0000-0000-000000000008', 'Hakan', 'Şahin', 'Hakan Şahin', 'hakan.sahin@suntoncrm.com', '05328888888', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('88888888-0000-0000-0000-000000000009', 'Elif', 'Yıldız', 'Elif Yıldız', 'elif.yildiz@suntoncrm.com', '05329999999', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('88888888-0000-0000-0000-000000000010', 'Murat', 'Güler', 'Murat Güler', 'murat.guler@suntoncrm.com', '05321010101', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('88888888-0000-0000-0000-000000000011', 'Selin', 'Öztürk', 'Selin Öztürk', 'selin.ozturk@suntoncrm.com', '05322020202', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true),
('88888888-0000-0000-0000-000000000012', 'Kemal', 'Aslan', 'Kemal Aslan', 'kemal.aslan@suntoncrm.com', '05323030303', 'sales_specialist', 'eeeeeeee-0000-0000-0000-000000000003', 'active', true)
ON CONFLICT (id) DO NOTHING;

-- App Configuration Settings
INSERT INTO public.app_settings (key, value, category, description, is_public) VALUES
('company_name', '"Sunton Makina"', 'general', 'Şirket adı', true),
('company_logo', '""', 'general', 'Şirket logosu URL', true),
('timezone', '"Europe/Istanbul"', 'general', 'Sistem saat dilimi', true),
('currency', '"TRY"', 'general', 'Varsayılan para birimi', true),
('lead_auto_distribution', '{"enabled": true, "method": "round_robin"}', 'distribution', 'Otomatik lead dağıtım kuralları', false)
ON CONFLICT (key) DO NOTHING;

-- Demo Customers (10 Records)
INSERT INTO public.customers (id, customer_number, type, first_name, last_name, full_name, company_name, phone, phone_normalized, email, province, district, assigned_user_id, source_id, segment, lifetime_value) VALUES
('99999999-0000-0000-0000-000000000001', 'MS-2026-000001', 'corporate', NULL, NULL, 'Tuğsan Metal San. Tic. Ltd. Şti.', 'Tuğsan Metal', '0352 321 45 67', '903523214567', 'info@tugsanmetal.com', 'Kayseri', 'Kocasinan', '88888888-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000001', 'gold', 4200000.00),
('99999999-0000-0000-0000-000000000002', 'MS-2026-000002', 'corporate', NULL, NULL, 'Özkan Lazer Makina A.Ş.', 'Özkan Lazer', '0212 543 21 09', '902125432109', 'destek@ozkanlazer.com', 'İstanbul', 'İkitelli', '88888888-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000002', 'platinum', 6700000.00),
('99999999-0000-0000-0000-000000000003', 'MS-2026-000003', 'corporate', NULL, NULL, 'Yıldız Havalandırma Sistemleri', 'Yıldız Havalandırma', '0224 441 23 45', '902244412345', 'yildiz@havalandirma.com', 'Bursa', 'Nilüfer', '88888888-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000006', 'standard', 1200000.00),
('99999999-0000-0000-0000-000000000004', 'MS-2026-000004', 'individual', 'Mustafa', 'Koçak', 'Mustafa Koçak', 'Koçak Ferforje', '0542 555 12 34', '905425551234', 'mustafa@kocakferforje.com', 'Ankara', 'Ostim', '88888888-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000007', 'silver', 450000.00),
('99999999-0000-0000-0000-000000000005', 'MS-2026-000005', 'corporate', NULL, NULL, 'Karadeniz Çelik Kapı', 'Karadeniz Çelik', '0362 266 11 22', '903622661122', 'satinalma@karadenizcelik.com', 'Samsun', 'Tekkeköy', '88888888-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000008', 'standard', 2100000.00),
('99999999-0000-0000-0000-000000000006', 'MS-2026-000006', 'individual', 'Bayram', 'Korkmaz', 'Bayram Korkmaz', 'Korkmaz Metal', '0555 432 10 98', '905554321098', 'bayram@korkmazmetal.com', 'İzmir', 'Bornova', '88888888-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000009', 'silver', 1800000.00),
('99999999-0000-0000-0000-000000000007', 'MS-2026-000007', 'corporate', NULL, NULL, 'Demirbaş Endüstriyel Mutfak', 'Demirbaş Mutfak', '0262 641 55 66', '902626415566', 'mutfak@demirbas.com', 'Kocaeli', 'Gebze', '88888888-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000010', 'gold', 3300000.00),
('99999999-0000-0000-0000-000000000008', 'MS-2026-000008', 'corporate', NULL, NULL, 'Özgür Asansör Sistemleri Sanayi', 'Özgür Asansör', '0216 411 99 88', '902164119988', 'ozgur@ozgurasansor.com', 'İstanbul', 'Tuzla', '88888888-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000005', 'standard', 0.00),
('99999999-0000-0000-0000-000000000009', 'MS-2026-000009', 'corporate', NULL, NULL, 'Ege Panel Çatı Panel Sistemleri', 'Ege Panel', '0232 479 88 00', '902324798800', 'egepanel@gmail.com', 'İzmir', 'Gaziemir', '88888888-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000006', 'silver', 2500000.00),
('99999999-0000-0000-0000-000000000010', 'MS-2026-000010', 'corporate', NULL, NULL, 'Mardin Tarım Aletleri İmalatı', 'Mardin Tarım', '0482 212 99 88', '904822129988', 'tarim@mardin.com', 'Mardin', 'Artuklu', '88888888-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000002', 'bronze', 3800000.00)
ON CONFLICT (customer_number) DO NOTHING;

-- Demo Opportunities (10 Records)
INSERT INTO public.opportunities (id, opportunity_number, title, customer_id, pipeline_id, stage_id, assigned_user_id, product_id, product_name, amount, currency, probability, status, expected_close_date) VALUES
('aaaaaaaa-0000-0000-0000-000000000001', 'FR-2026-000001', 'Tuğsan 6kW Lazer Satışı', '99999999-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000008', '44444444-0000-0000-0000-000000000002', 'Plaka Lazer Kesim Makinesi 6kW', 4200000.00, 'TRY', 100, 'won', '2026-06-10'),
('aaaaaaaa-0000-0000-0000-000000000002', 'FR-2026-000002', 'Özkan Lazer Hat Otomasyonu', '99999999-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000008', '88888888-0000-0000-0000-000000000009', '44444444-0000-0000-0000-000000000002', 'Plaka Lazer Kesim Makinesi 6kW', 6700000.00, 'TRY', 90, 'open', '2026-07-20'),
('aaaaaaaa-0000-0000-0000-000000000003', 'FR-2026-000003', 'Yıldız Havalandırma Abkant İhtiyacı', '99999999-0000-0000-0000-000000000003', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000010', '44444444-0000-0000-0000-000000000004', 'Abkant Pres 100 Ton', 1200000.00, 'TRY', 100, 'won', '2026-05-15'),
('aaaaaaaa-0000-0000-0000-000000000004', 'FR-2026-000004', 'Mustafa Koçak El Tipi Lazer Kaynak', '99999999-0000-0000-0000-000000000004', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000011', '44444444-0000-0000-0000-000000000007', 'Lazer Kaynak Makinesi 1.5kW', 450000.00, 'TRY', 100, 'won', '2026-06-01'),
('aaaaaaaa-0000-0000-0000-000000000005', 'FR-2026-000005', 'Karadeniz Kapı CNC Abkant', '99999999-0000-0000-0000-000000000005', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000012', '44444444-0000-0000-0000-000000000005', 'Abkant Pres 220 Ton', 2100000.00, 'TRY', 100, 'won', '2026-04-20'),
('aaaaaaaa-0000-0000-0000-000000000006', 'FR-2026-000006', 'Korkmaz Robotik Kaynak Hücresi', '99999999-0000-0000-0000-000000000006', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000008', '44444444-0000-0000-0000-000000000006', 'Robotik Kaynak Hücresi', 1800000.00, 'TRY', 100, 'won', '2026-06-05'),
('aaaaaaaa-0000-0000-0000-000000000007', 'FR-2026-000007', 'Demirbaş Mutfak Abkant Pres İhtiyacı', '99999999-0000-0000-0000-000000000007', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000009', '44444444-0000-0000-0000-000000000005', 'Abkant Pres 220 Ton', 2100000.00, 'TRY', 100, 'won', '2026-05-30'),
('aaaaaaaa-0000-0000-0000-000000000008', 'FR-2026-000008', 'Özgür Asansör Plaka Lazer Kesim', '99999999-0000-0000-0000-000000000008', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000010', '44444444-0000-0000-0000-000000000001', 'Plaka Lazer Kesim Makinesi 3kW', 2500000.00, 'TRY', 35, 'open', '2026-08-15'),
('aaaaaaaa-0000-0000-0000-000000000009', 'FR-2026-000009', 'Ege Panel Boru ve Profil Lazer Kesim', '99999999-0000-0000-0000-000000000009', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000011', '44444444-0000-0000-0000-000000000003', 'Boru ve Profil Lazer Kesim Makinesi', 2500000.00, 'TRY', 100, 'won', '2026-06-12'),
('aaaaaaaa-0000-0000-0000-000000000010', 'FR-2026-000010', 'Mardin Tarım Boru Lazer Projesi', '99999999-0000-0000-0000-000000000010', '66666666-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000010', '88888888-0000-0000-0000-000000000012', '44444444-0000-0000-0000-000000000003', 'Boru ve Profil Lazer Kesim Makinesi', 3800000.00, 'TRY', 100, 'won', '2026-06-14')
ON CONFLICT (opportunity_number) DO NOTHING;

-- Demo Leads (10 Records)
INSERT INTO public.leads (id, lead_number, first_name, last_name, full_name, company_name, phone, phone_normalized, email, province, district, source_id, requested_product, status_id, priority, temperature, assigned_call_center_user_id, assigned_sales_user_id, created_at) VALUES
('bbbbbbbb-0000-0000-0000-000000000001', 'LD-2026-000001', 'Mehmet', 'Solmaz', 'Mehmet Solmaz', 'Solmaz Metal Plastik', '0530 123 45 67', '905301234567', 'mehmet@solmazmetal.com', 'Kayseri', 'Melikgazi', '11111111-0000-0000-0000-000000000001', 'Plaka Lazer Kesim Makinesi 3kW', '22222222-0000-0000-0000-000000000011', 'high', 'hot', '88888888-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000008', '2026-06-01 10:00:00+03'),
('bbbbbbbb-0000-0000-0000-000000000002', 'LD-2026-000002', 'Ali', 'Yılmazer', 'Ali Yılmazer', 'Yılmazer Panjur', '0543 987 65 43', '905439876543', 'ali@yilmazerpanjur.com', 'İstanbul', 'Ümraniye', '11111111-0000-0000-0000-000000000002', 'Abkant Pres 100 Ton', '22222222-0000-0000-0000-000000000009', 'normal', 'warm', '88888888-0000-0000-0000-000000000004', '88888888-0000-0000-0000-000000000009', '2026-06-05 11:30:00+03'),
('bbbbbbbb-0000-0000-0000-000000000003', 'LD-2026-000003', 'Fatma', 'Güneş', 'Fatma Güneş', 'Güneş Havalandırma', '0555 111 22 33', '905551112233', 'satinalma@guneshavalandirma.com', 'Bursa', 'Osmangazi', '11111111-0000-0000-0000-000000000006', 'Abkant Pres 100 Ton', '22222222-0000-0000-0000-000000000011', 'normal', 'warm', '88888888-0000-0000-0000-000000000005', '88888888-0000-0000-0000-000000000010', '2026-06-10 14:15:00+03'),
('bbbbbbbb-0000-0000-0000-000000000004', 'LD-2026-000004', 'Süleyman', 'Kartal', 'Süleyman Kartal', 'Kartal Konstrüksiyon', '0533 222 33 44', '905332223344', 'suleyman@kartalcelik.com', 'Konya', 'Karatay', '11111111-0000-0000-0000-000000000005', 'Lazer Kaynak Makinesi 1.5kW', '22222222-0000-0000-0000-000000000007', 'high', 'hot', '88888888-0000-0000-0000-000000000006', NULL, '2026-06-12 09:45:00+03'),
('bbbbbbbb-0000-0000-0000-000000000005', 'LD-2026-000005', 'Ayşe', 'Aksoy', 'Ayşe Aksoy', 'Aksoy Pano', '0505 444 55 66', '905054445566', 'ayse@aksoypano.com', 'İzmir', 'Çiğli', '11111111-0000-0000-0000-000000000001', 'Plaka Lazer Kesim Makinesi 3kW', '22222222-0000-0000-0000-000000000001', 'normal', 'warm', NULL, NULL, '2026-06-15 17:00:00+03'),
('bbbbbbbb-0000-0000-0000-000000000006', 'LD-2026-000006', 'Ahmet', 'Kaya', 'Ahmet Kaya', 'Kaya İnşaat', '0532 999 88 77', '905329998877', 'ahmet@kayainsaat.com', 'Gaziantep', 'Şehitkamil', '11111111-0000-0000-0000-000000000002', 'Plaka Lazer Kesim Makinesi 6kW', '22222222-0000-0000-0000-000000000002', 'high', 'warm', NULL, NULL, '2026-06-15 10:20:00+03'),
('bbbbbbbb-0000-0000-0000-000000000007', 'LD-2026-000007', 'Hüseyin', 'Kurt', 'Hüseyin Kurt', 'Kurt Raf Sistemleri', '0544 333 22 11', '905443332211', 'huseyin@kurtraf.com', 'Manisa', 'Yunusemre', '11111111-0000-0000-0000-000000000003', 'Abkant Pres 220 Ton', '22222222-0000-0000-0000-000000000003', 'normal', 'warm', '88888888-0000-0000-0000-000000000003', NULL, '2026-06-14 11:00:00+03'),
('bbbbbbbb-0000-0000-0000-000000000008', 'LD-2026-000008', 'Hasan', 'Şen', 'Hasan Şen', 'Şen Havalandırma', '0533 444 55 66', '905334445566', 'hasan@senhavalandirma.com', 'Denizli', 'Merkezefendi', '11111111-0000-0000-0000-000000000007', 'Abkant Pres 100 Ton', '22222222-0000-0000-0000-000000000004', 'low', 'cold', '88888888-0000-0000-0000-000000000004', NULL, '2026-06-14 15:40:00+03'),
('bbbbbbbb-0000-0000-0000-000000000009', 'LD-2026-000009', 'Sait', 'Özel', 'Sait Özel', 'Özel Çelik Kapı', '0542 111 22 33', '905421112233', 'sait@ozelcelikkapi.com', 'Kayseri', 'Melikgazi', '11111111-0000-0000-0000-000000000005', 'Abkant Pres 220 Ton', '22222222-0000-0000-0000-000000000005', 'normal', 'cold', '88888888-0000-0000-0000-000000000005', NULL, '2026-06-13 16:30:00+03'),
('bbbbbbbb-0000-0000-0000-000000000010', 'LD-2026-000010', 'Nuri', 'Polat', 'Nuri Polat', 'Polat Metal A.Ş.', '0535 222 33 44', '905352223344', 'nuri@polatmetal.com', 'İstanbul', 'Pendik', '11111111-0000-0000-0000-000000000006', 'Robotik Kaynak Hücresi', '22222222-0000-0000-0000-000000000006', 'high', 'hot', '88888888-0000-0000-0000-000000000006', NULL, '2026-06-12 11:20:00+03')
ON CONFLICT (lead_number) DO NOTHING;

-- Demo Calls (5 Records)
INSERT INTO public.calls (id, lead_id, user_id, direction, outcome_id, phone_number, duration_seconds, status, subject, notes, created_at) VALUES
('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000003', 'outgoing', '33333333-0000-0000-0000-000000000001', '05301234567', 180, 'completed', 'İlk İrtibat ve Bilgi Talebi', 'Müşteri lazer makinesi ile yakından ilgileniyor. Fiyat teklifi bekliyor.', '2026-06-02 10:15:00+03'),
('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000004', 'outgoing', '33333333-0000-0000-0000-000000000002', '05439876543', 0, 'missed', 'Tanıtım Arama', 'Ulaşılamadı, meşgule atıldı.', '2026-06-05 14:00:00+03'),
('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000004', 'outgoing', '33333333-0000-0000-0000-000000000001', '05439876543', 240, 'completed', 'Geri Arama - İkinci Deneme', 'Müşteri 100 ton abkant pres ihtiyacı olduğunu belirtti. Selin Hanım yetkili uzman olarak atanacak.', '2026-06-05 16:30:00+03'),
('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000005', 'outgoing', '33333333-0000-0000-0000-000000000008', '05551112233', 120, 'completed', 'Genel Bilgilendirme', 'Ürün özellikleri anlatıldı ve kataloğu e-posta ile gönderildi.', '2026-06-11 11:00:00+03'),
('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000004', '88888888-0000-0000-0000-000000000006', 'outgoing', '33333333-0000-0000-0000-000000000007', '05332223344', 45, 'completed', 'Saat Belirleme Araması', 'Haftaya çarşamba günü geri aranmak üzere not alındı.', '2026-06-13 10:00:00+03')
ON CONFLICT DO NOTHING;

-- Demo Tasks (4 Records)
INSERT INTO public.tasks (id, task_number, title, description, task_type, status, priority, assigned_to, assigned_by, lead_id, start_at, due_at) VALUES
('dddddddd-0000-0000-0000-000000000001', 'TS-2026-000001', 'Solmaz Metal Geri Arama', 'Müşteriyi arayıp teklif detaylarını sor', 'callback', 'completed', 'high', '88888888-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', '2026-06-03 09:00:00+03', '2026-06-03 12:00:00+03'),
('dddddddd-0000-0000-0000-000000000002', 'TS-2026-000002', 'Yılmazer Panjur Ziyaret Toplantısı', 'İstanbul ofisinde teknik inceleme toplantısı yap', 'meeting', 'pending', 'normal', '88888888-0000-0000-0000-000000000009', '88888888-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000002', '2026-06-25 14:00:00+03', '2026-06-25 16:00:00+03'),
('dddddddd-0000-0000-0000-000000000003', 'TS-2026-000003', 'Süleyman Kartal Teklif Hazırlama', '1.5kW lazer kaynak cihazı için özel iskonto fiyatı oluştur', 'offer', 'completed', 'high', '88888888-0000-0000-0000-000000000008', '88888888-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000004', '2026-06-13 14:00:00+03', '2026-06-13 18:00:00+03'),
('dddddddd-0000-0000-0000-000000000004', 'TS-2026-000004', 'Aksoy Pano İlk İletişim Araması', 'Aksoy Pano ile ilk aramayı gerçekleştirip talebi nitelendir', 'call', 'pending', 'normal', '88888888-0000-0000-0000-000000000004', '88888888-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000005', '2026-06-20 09:00:00+03', '2026-06-20 18:00:00+03')
ON CONFLICT (task_number) DO NOTHING;

-- Demo Performance Targets
INSERT INTO public.user_targets (user_id, period_type, period_start, period_end, target_leads, target_calls, target_qualified_leads, target_sales, target_revenue) VALUES
('88888888-0000-0000-0000-000000000003', 'monthly', '2026-06-01', '2026-06-30', 100, 500, 30, 0, 0.00),
('88888888-0000-0000-0000-000000000004', 'monthly', '2026-06-01', '2026-06-30', 100, 500, 30, 0, 0.00),
('88888888-0000-0000-0000-000000000008', 'monthly', '2026-06-01', '2026-06-30', 0, 150, 0, 5, 5000000.00),
('88888888-0000-0000-0000-000000000009', 'monthly', '2026-06-01', '2026-06-30', 0, 150, 0, 5, 5000000.00)
ON CONFLICT DO NOTHING;
