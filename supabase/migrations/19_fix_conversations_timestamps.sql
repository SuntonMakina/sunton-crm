-- Migration 19: Fix Historical WhatsApp Conversation Timestamps & Cleanup Empty Chats
-- 1. Delete conversations with zero messages (they are empty/undecrypted junk syncs)
DELETE FROM public.conversations c
WHERE c.channel = 'whatsapp'
  AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id);

-- 2. Delete WhatsApp leads that have no conversations and no calls/tasks (leads that were created but have no activity)
DELETE FROM public.leads l
WHERE l.status_id = '22222222-0000-0000-0000-000000000020'
  AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.lead_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM public.calls call WHERE call.lead_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.lead_id = l.id);

-- 3. Fix any corrupted year 56000+ timestamps due to millisecond insertion in messages
UPDATE public.messages
SET sent_at = to_timestamp(extract(epoch from sent_at) / 1000.0),
    created_at = to_timestamp(extract(epoch from created_at) / 1000.0)
WHERE sent_at > '2030-01-01 00:00:00+00';

-- 4. Fix any corrupted year 56000+ timestamps in leads
UPDATE public.leads
SET last_contact_at = to_timestamp(extract(epoch from last_contact_at) / 1000.0)
WHERE last_contact_at > '2030-01-01 00:00:00+00';

-- 5. For any remaining conversations (which have messages), align last_message_at to the latest message sent_at
UPDATE public.conversations c
SET last_message_at = COALESCE(
    (SELECT MAX(sent_at) FROM public.messages m WHERE m.conversation_id = c.id),
    c.created_at
);

