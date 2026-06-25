import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { gatewayUrl } = await request.json()

    if (!gatewayUrl) {
      return NextResponse.json({ error: 'gatewayUrl is required.' }, { status: 400 })
    }

    console.log(`Registering WhatsApp Gateway URL to DB: ${gatewayUrl}`)
    const { data: success, error: rpcErr } = await supabase.rpc(
      'register_whatsapp_gateway',
      { p_url: gatewayUrl }
    )

    if (rpcErr) {
      console.error('Error executing register_whatsapp_gateway RPC:', rpcErr)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    return NextResponse.json({ success })
  } catch (err: any) {
    console.error('Register gateway endpoint error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
