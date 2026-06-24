import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { phone, avatarUrl } = body

    if (!phone || !avatarUrl) {
      return NextResponse.json({ error: 'Missing parameters: phone and avatarUrl are required.' }, { status: 400 })
    }

    console.log(`Saving WhatsApp avatar URL for phone ${phone}: ${avatarUrl}`)

    const cleanPhone = phone.replace(/\D/g, '')

    const { data, error } = await supabase
      .from('leads')
      .update({ avatar_url: avatarUrl })
      .eq('phone_normalized', cleanPhone)
      .select('id')

    if (error) {
      console.error('Error updating avatar_url in leads:', error)
      return NextResponse.json({ error: `Failed to update avatar: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: data?.length || 0 })

  } catch (err: any) {
    console.error('Avatar resolution endpoint error:', err)
    return NextResponse.json({ error: `Avatar resolution error: ${err.message}` }, { status: 500 })
  }
}
