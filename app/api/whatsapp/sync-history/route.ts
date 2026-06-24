import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { chats, messages } = body

    if (!chats || !messages) {
      return NextResponse.json({ error: 'Missing parameters: chats and messages are required.' }, { status: 400 })
    }

    console.log(`Starting WhatsApp history sync via RPC: ${chats.length} chats and ${messages.length} messages received.`);

    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
      'handle_whatsapp_history_sync',
      {
        p_chats: chats,
        p_messages: messages
      }
    )

    if (rpcErr) {
      console.error('Error executing handle_whatsapp_history_sync RPC:', rpcErr)
      return NextResponse.json({ error: `Database history sync failed: ${rpcErr.message}` }, { status: 500 })
    }

    const leadsSynced = rpcResult.leads_synced || 0
    const conversationsSynced = rpcResult.conversations_synced || 0
    const messagesSynced = rpcResult.messages_synced || 0

    console.log(`WhatsApp history sync completed. Leads created: ${leadsSynced}, Convs created: ${conversationsSynced}, Messages imported: ${messagesSynced}`);

    return NextResponse.json({
      success: true,
      leadsSynced,
      conversationsSynced,
      messagesSynced
    })

  } catch (err: any) {
    console.error('History sync webhook error:', err)
    return NextResponse.json({ error: `Sync handling error: ${err.message}` }, { status: 500 })
  }
}
