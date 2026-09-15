import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResolvedGatewayUrl } from '@/lib/whatsapp/gateway'

export async function GET() {
  try {
    const supabase = await createClient()
    const targetUrl = await getResolvedGatewayUrl(supabase)
    return NextResponse.redirect(targetUrl)
  } catch (err) {
    console.error('Redirect endpoint error:', err)
    return NextResponse.redirect(process.env.WHATSAPP_GATEWAY_URL || 'http://localhost:3001')
  }
}
