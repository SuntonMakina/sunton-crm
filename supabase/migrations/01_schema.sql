-- 1. EXTENSIONS & HELPERS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shared trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. LOOKUP TABLES & ENUMS
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

-- 3. CORE ENTITIES
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
    customer_id uuid, -- added constraint later
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

-- Now link leads.customer_id references customers(id)
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
    activity_type text NOT NULL CHECK (activity_type IN ('lead_created', 'lead_assigned', 'status_changed', 'call_made', 'note_added', 'task_created', 'task_completed', 'forwarded_to_sales', 'opportunity_created', 'pipeline_changed', 'converted_to_customer', 'message_sent')),
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


-- 4. SYSTEM TRIGGERS & PROCEDURES
-- Auto number generators on insert
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


-- Automatically handle auth user profile creation via trigger
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
    
    -- Check if metadata role exists and is allowed, otherwise assign default.
    -- If there are no profiles in the database, make the first registered user the super_admin.
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

-- Trigger attached to auth.users on insert
-- Note: Must be run on public schema but triggers on auth.users which is in public schema or handles cross-schema triggers.
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
