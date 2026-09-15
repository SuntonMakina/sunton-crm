import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResolvedGatewayUrl } from '@/lib/whatsapp/gateway'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return NextResponse.json({ error: 'Missing parameter: phone is required.' }, { status: 400 })
    }

    const supabase = await createClient()
    const gatewayUrl = await getResolvedGatewayUrl(supabase)
    
    console.log(`Proxying fetch-avatar to gateway: ${gatewayUrl}/fetch-avatar for phone: ${phone}`)
    
    const response = await fetch(`${gatewayUrl}/fetch-avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone })
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Failed to fetch avatar from WhatsApp gateway' }, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Fetch avatar proxy route error:', err)
    return NextResponse.json({ error: `Proxy server error: ${err.message}` }, { status: 500 })
  }
}
