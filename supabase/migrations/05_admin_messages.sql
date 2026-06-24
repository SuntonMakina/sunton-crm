-- Create admin_messages table
CREATE TABLE IF NOT EXISTS public.admin_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type text CHECK (target_type IN ('user', 'department', 'all_call_center', 'all')),
    target_department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NOT NULL,
    priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
    is_read boolean DEFAULT false,
    read_at timestamptz,
    related_entity_type text CHECK (related_entity_type IN ('lead', 'task')),
    related_entity_id uuid,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins Manage Admin Messages" ON public.admin_messages;
DROP POLICY IF EXISTS "Users Read Admin Messages" ON public.admin_messages;
DROP POLICY IF EXISTS "Users Update Read Status" ON public.admin_messages;

-- RLS Policies
CREATE POLICY "Admins Manage Admin Messages" ON public.admin_messages 
    FOR ALL TO authenticated 
    USING (public.get_my_role() IN ('super_admin', 'admin'));

CREATE POLICY "Users Read Admin Messages" ON public.admin_messages 
    FOR SELECT TO authenticated 
    USING (
        recipient_user_id = auth.uid() OR
        target_type = 'all' OR
        (target_type = 'all_call_center' AND public.get_my_role() IN ('call_center_rep', 'sales_specialist', 'team_leader')) OR
        (target_type = 'department' AND target_department_id = public.get_my_department())
    );

CREATE POLICY "Users Update Read Status" ON public.admin_messages 
    FOR UPDATE TO authenticated 
    USING (
        recipient_user_id = auth.uid() OR
        target_type = 'all' OR
        (target_type = 'all_call_center' AND public.get_my_role() IN ('call_center_rep', 'sales_specialist', 'team_leader')) OR
        (target_type = 'department' AND target_department_id = public.get_my_department())
    )
    WITH CHECK (
        true
    );
