-- RLS Helpers
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

-- 1. Enable RLS on all tables
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


-- 2. POLICIES definition

-- Departments
CREATE POLICY "Public Read Departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All Departments" ON public.departments FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Profiles
CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users Self Update Profiles" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admin All Profiles" ON public.profiles FOR ALL TO authenticated USING (public.get_my_role() IN ('super_admin', 'admin'));

-- Lookups (Sources, Statuses, Products, Call Outcomes, Lost Reasons, Pipelines, Pipeline Stages, App Settings, Tags)
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

-- Leads RLS
CREATE POLICY "Leads RLS Policy" ON public.leads FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager') OR
    (public.get_my_role() = 'team_leader' AND (assigned_call_center_user_id IN (SELECT id FROM public.profiles WHERE department_id = public.get_my_department()) OR assigned_sales_user_id IN (SELECT id FROM public.profiles WHERE department_id = public.get_my_department()))) OR
    (public.get_my_role() = 'call_center_rep' AND assigned_call_center_user_id = auth.uid()) OR
    (public.get_my_role() = 'sales_specialist' AND assigned_sales_user_id = auth.uid())
);

-- Customers RLS
CREATE POLICY "Customers RLS Policy" ON public.customers FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager', 'team_leader', 'call_center_rep') OR
    (public.get_my_role() = 'sales_specialist' AND assigned_user_id = auth.uid())
);

-- Customer Contacts
CREATE POLICY "Customer Contacts RLS Policy" ON public.customer_contacts FOR ALL TO authenticated USING (true);

-- Opportunities RLS
CREATE POLICY "Opportunities RLS Policy" ON public.opportunities FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager') OR
    (public.get_my_role() = 'sales_specialist' AND assigned_user_id = auth.uid())
);

-- Opportunity Stage History
CREATE POLICY "Opportunity Stage History RLS Policy" ON public.opportunity_stage_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Opportunity Stage History Write" ON public.opportunity_stage_history FOR INSERT TO authenticated WITH CHECK (true);

-- Calls RLS
CREATE POLICY "Calls RLS Policy" ON public.calls FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager', 'team_leader') OR
    user_id = auth.uid()
);

-- Tasks RLS
CREATE POLICY "Tasks RLS Policy" ON public.tasks FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin') OR
    assigned_to = auth.uid() OR
    assigned_by = auth.uid()
);

-- Task Comments
CREATE POLICY "Task Comments RLS Policy" ON public.task_comments FOR ALL TO authenticated USING (true);

-- Calendar Events
CREATE POLICY "Calendar Events RLS Policy" ON public.calendar_events FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin') OR
    user_id = auth.uid()
);

-- Conversations & Messages
CREATE POLICY "Conversations RLS Policy" ON public.conversations FOR ALL TO authenticated USING (true);
CREATE POLICY "Messages RLS Policy" ON public.messages FOR ALL TO authenticated USING (true);

-- Notifications
CREATE POLICY "Notifications User Specific" ON public.notifications FOR ALL TO authenticated USING (
    user_id = auth.uid()
);

-- Lead Assignment History & Lead Status History & Activities & Notes & Entity Tags
CREATE POLICY "Lead Assignment History RLS" ON public.lead_assignment_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lead Assignment History Write" ON public.lead_assignment_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Lead Status History RLS" ON public.lead_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lead Status History Write" ON public.lead_status_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Activities RLS" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Activities Write" ON public.activities FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Notes RLS" ON public.notes FOR ALL TO authenticated USING (true);
CREATE POLICY "Entity Tags RLS" ON public.entity_tags FOR ALL TO authenticated USING (true);

-- Automations & Automation Logs
CREATE POLICY "Automations RLS" ON public.automations FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin')
);
CREATE POLICY "Automation Logs RLS" ON public.automation_logs FOR SELECT TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin')
);

-- Audit Logs
CREATE POLICY "Audit Logs Admin Only" ON public.audit_logs FOR SELECT TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin')
);
CREATE POLICY "Audit Logs Write" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- User Targets
CREATE POLICY "User Targets RLS" ON public.user_targets FOR ALL TO authenticated USING (
    public.get_my_role() IN ('super_admin', 'admin', 'sales_manager') OR
    user_id = auth.uid()
);
