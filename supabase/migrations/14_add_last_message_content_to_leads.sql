-- Migration 14: Add last_message_content column to leads table
-- Used to store the last message text preview for WhatsApp chat layout.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_message_content text;
