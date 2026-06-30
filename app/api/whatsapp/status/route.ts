import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/whatsapp/status
// Retrieves the current connection status and QR code from the database
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: statusInfo, error } = await supabase.rpc('get_whatsapp_gateway_status')

    if (error) {
      console.error('Error fetching gateway status:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(statusInfo)
  } catch (err: any) {
    console.error('Gateway status GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/whatsapp/status
// Handles updates from the gateway, or request/clear reset commands from frontend/gateway
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, status, qr } = body

    if (action === 'update') {
      if (!status) {
        return NextResponse.json({ error: 'status parameter is required for update.' }, { status: 400 })
      }
      
      const { data: updateRes, error: updateErr } = await supabase.rpc(
        'update_whatsapp_gateway_status',
        { p_status: status, p_qr: qr || null }
      )

      if (updateErr) {
        console.error('Error updating gateway status RPC:', updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json(updateRes)
    } 
    
    if (action === 'reset') {
      // Check User Session (only authenticated users can request reset)
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
      }

      const { data: success, error: resetErr } = await supabase.rpc('request_whatsapp_gateway_reset')

      if (resetErr) {
        console.error('Error requesting gateway reset RPC:', resetErr)
        return NextResponse.json({ error: resetErr.message }, { status: 500 })
      }

      // Immediately set status to disconnected and clear QR in the database
      // to give the user instant feedback that the connection is being severed.
      await supabase.rpc('update_whatsapp_gateway_status', {
        p_status: 'disconnected',
        p_qr: null
      })

      return NextResponse.json({ success })
    }

    if (action === 'clear_reset') {
      const { data: success, error: clearErr } = await supabase.rpc('clear_whatsapp_gateway_reset')

      if (clearErr) {
        console.error('Error clearing gateway reset RPC:', clearErr)
        return NextResponse.json({ error: clearErr.message }, { status: 500 })
      }

      return NextResponse.json({ success })
    }

    return NextResponse.json({ error: 'Invalid action parameter.' }, { status: 400 })
  } catch (err: any) {
    console.error('Gateway status POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
