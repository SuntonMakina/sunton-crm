import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: gatewayUrl, error } = await supabase.rpc('get_whatsapp_gateway_url')

    const targetUrl = (gatewayUrl && !error) 
      ? gatewayUrl 
      : (process.env.WHATSAPP_GATEWAY_URL || 'http://localhost:3001')

    return NextResponse.redirect(targetUrl)
  } catch (err) {
    console.error('Redirect endpoint error:', err)
    return NextResponse.redirect(process.env.WHATSAPP_GATEWAY_URL || 'http://localhost:3001')
  }
}
