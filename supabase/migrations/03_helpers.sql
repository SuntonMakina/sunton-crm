-- Helper functions for reports and RPCs

-- 1. Daily Leads Trend
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

-- 2. Leads by Source
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

-- 3. Leads by Status
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

-- 4. User Call Performance
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

-- 5. Call Outcome Distributions
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

-- 6. Sales Pipeline values
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

-- 7. Funnel Analytics
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

-- 8. Dashboard KPIs summary
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
