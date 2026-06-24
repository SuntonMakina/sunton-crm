import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Webhook Verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN || 'sunton_verify_token_123'

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully!')
      return new Response(challenge, { status: 200 })
    } else {
      return new Response('Verification token mismatch', { status: 403 })
    }
  }
  return new Response('Invalid webhook parameters', { status: 400 })
}

// POST: Handle Incoming Webhook Events
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const payload = await request.json()

    // Log the incoming payload for debugging
    console.log('Incoming WhatsApp Webhook Payload:', JSON.stringify(payload, null, 2))

    // Parse the changes list
    const entry = payload.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const message = value?.messages?.[0]
    const contact = value?.contacts?.[0]

    if (message && message.type === 'text') {
      const fromPhone = message.from // e.g., '905542298853'
      const content = message.text.body
      const timestamp = message.timestamp
      const fromMe = !!message.fromMe
      const messageId = message.id

      console.log(`Calling handle_webhook_incoming_message for ${fromPhone} (fromMe: ${fromMe}, messageId: ${messageId})...`)
      const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        'handle_webhook_incoming_message',
        {
          p_from_phone: fromPhone,
          p_content: content,
          p_profile_name: contact?.profile?.name || 'WhatsApp Müşterisi',
          p_timestamp: timestamp ? String(timestamp) : null,
          p_from_me: fromMe,
          p_external_message_id: messageId
        }
      )

      if (rpcErr) {
        console.error('Error executing handle_webhook_incoming_message RPC:', rpcErr)
        return NextResponse.json({ error: `Database logging failed: ${rpcErr.message}` }, { status: 500 })
      }

      console.log('Successfully logged incoming message via RPC. Result:', rpcResult)
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: `Webhook handling error: ${err.message}` }, { status: 500 })
  }
}
