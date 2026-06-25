import { NextResponse } from 'next/server'

export async function GET() {
  const gatewayUrl = process.env.WHATSAPP_GATEWAY_URL || 'http://localhost:3001'
  return NextResponse.redirect(gatewayUrl)
}
