import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

let cachedAdminToken: string | null = null
let tokenExpiresAt = 0

async function getAdminToken() {
  const now = Date.now()
  if (cachedAdminToken && tokenExpiresAt > now + 60000) {
    return cachedAdminToken
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null

  try {
    const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`
    const res = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'mert@suntonmakina.com',
        password: 'Sunton123*'
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    cachedAdminToken = data.access_token
    tokenExpiresAt = now + (data.expires_in || 3600) * 1000
    return cachedAdminToken
  } catch (e) {
    return null
  }
}

export async function GET() {
  try {
    const currYear = new Date().getFullYear()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const adminToken = await getAdminToken()

    let maxSeq = 3533

    if (adminToken && supabaseUrl && supabaseKey) {
      const res = await fetch(`${supabaseUrl}/rest/v1/leads?select=lead_number&lead_number=not.is.null&order=lead_number.desc&limit=50`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${adminToken}`
        }
      })
      if (res.ok) {
        const leads = await res.json()
        if (Array.isArray(leads)) {
          for (const l of leads) {
            if (l.lead_number) {
              const m = l.lead_number.match(/(\d+)$/)
              if (m) {
                const num = parseInt(m[1], 10)
                if (num > maxSeq) maxSeq = num
              }
            }
          }
        }
      }
    } else {
      const supabase = await createClient()
      const { data: leads } = await supabase
        .from('leads')
        .select('lead_number')
        .not('lead_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200)

      if (leads && leads.length > 0) {
        for (const l of leads) {
          if (l.lead_number) {
            const m = l.lead_number.match(/(\d+)$/)
            if (m) {
              const num = parseInt(m[1], 10)
              if (num > maxSeq) maxSeq = num
            }
          }
        }
      }
    }

    let candidateSeq = maxSeq + 1
    let candidateNum = `LD-${currYear}-${String(candidateSeq).padStart(6, '0')}`

    return NextResponse.json({ lead_number: candidateNum, seq: candidateSeq })
  } catch (err: any) {
    const currYear = new Date().getFullYear()
    const randomSalt = Math.floor(1000 + Math.random() * 9000)
    const fallbackNum = `LD-${currYear}-${String(Date.now()).slice(-4)}${randomSalt.toString().slice(-2)}`
    return NextResponse.json({ lead_number: fallbackNum, fallback: true })
  }
}

