import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { lid, phone } = body

    if (!lid || !phone) {
      return NextResponse.json({ error: 'Missing parameters: lid and phone are required.' }, { status: 400 })
    }

    console.log(`Resolving WhatsApp LID to real phone in database: ${lid} -> ${phone}`)

    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
      'resolve_whatsapp_lid_lead',
      {
        p_lid: lid,
        p_real_phone: phone
      }
    )

    if (rpcErr) {
      console.error('Error executing resolve_whatsapp_lid_lead RPC:', rpcErr)
      return NextResponse.json({ error: `LID resolution database call failed: ${rpcErr.message}` }, { status: 500 })
    }

    console.log(`LID resolution completed successfully. Action taken: ${rpcResult.action}`, rpcResult)

    return NextResponse.json({
      success: true,
      action: rpcResult.action,
      leadId: rpcResult.lead_id || rpcResult.real_lead_id || null
    })

  } catch (err: any) {
    console.error('LID resolution endpoint error:', err)
    return NextResponse.json({ error: `LID resolution handler error: ${err.message}` }, { status: 500 })
  }
}
