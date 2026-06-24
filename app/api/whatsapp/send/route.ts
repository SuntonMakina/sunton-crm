import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check User Session
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
    }

    const body = await request.json()
    const { leadId, phone, content, conversationId } = body

    if (!leadId || !phone || !content) {
      return NextResponse.json({ error: 'Eksik parametreler: leadId, phone ve content zorunludur.' }, { status: 400 })
    }

    // Read Env Variables
    const token = process.env.META_WHATSAPP_TOKEN
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID

    if (!token || !phoneNumberId) {
      return NextResponse.json({ 
        error: 'Sistem hatası: WhatsApp API yapılandırması (.env.local) eksik.' 
      }, { status: 500 })
    }

    // Normalize Recipient Phone Number
    const cleanPhone = phone.replace(/\D/g, '')
    let formattedPhone = cleanPhone
    if (cleanPhone.length === 11 && cleanPhone.startsWith('05')) {
      formattedPhone = '90' + cleanPhone.substring(1)
    } else if (cleanPhone.length === 10 && cleanPhone.startsWith('5')) {
      formattedPhone = '90' + cleanPhone
    }

    // Call Local Baileys WhatsApp Gateway
    const gatewayResponse = await fetch(`http://localhost:3001/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: formattedPhone,
        content: content
      })
    })

    const gatewayData = await gatewayResponse.json()
    if (!gatewayResponse.ok) {
      return NextResponse.json({ 
        error: gatewayData.error || 'WhatsApp Gateway mesaj gönderim hatası' 
      }, { status: gatewayResponse.status })
    }

    // Resolve or Create Conversation
    let finalConversationId = conversationId
    if (!finalConversationId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', leadId)
        .eq('channel', 'whatsapp')
        .single()
      
      if (conv) {
        finalConversationId = conv.id
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({
            lead_id: leadId,
            channel: 'whatsapp',
            assigned_user_id: user.id,
            status: 'open',
            unread_count: 0
          })
          .select()
          .single()
        
        if (convErr || !newConv) {
          return NextResponse.json({ error: 'Konuşma (conversation) kaydı oluşturulamadı.' }, { status: 500 })
        }
        finalConversationId = newConv.id
      }
    }

    // Insert message record into Supabase
    const { data: newMsg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: finalConversationId,
        sender_type: 'user',
        direction: 'outgoing',
        channel: 'whatsapp',
        content: content,
        delivery_status: 'sent',
        sender_user_id: user.id,
        external_message_id: gatewayData.messageId
      })
      .select()
      .single()

    if (msgErr || !newMsg) {
      return NextResponse.json({ error: `Veritabanı mesaj kayıt hatası: ${msgErr?.message}` }, { status: 500 })
    }

    // Update lead whatsapp_step if necessary
    const { data: lead } = await supabase
      .from('leads')
      .select('whatsapp_step')
      .eq('id', leadId)
      .single()

    if (lead && (lead.whatsapp_step === 'new' || lead.whatsapp_step === 'viewed')) {
      await supabase
        .from('leads')
        .update({ whatsapp_step: 'messaged' })
        .eq('id', leadId)

      await supabase.from('activities').insert({
        entity_type: 'lead',
        entity_id: leadId,
        activity_type: 'whatsapp_step_changed',
        title: 'WhatsApp Adımı: Mesaj Gönderildi',
        description: `İlk WhatsApp mesajı Meta API aracılığıyla iletildi.`,
        user_id: user.id
      })
    }

    return NextResponse.json({ success: true, message: newMsg })

  } catch (err: any) {
    return NextResponse.json({ error: `Sunucu hatası: ${err.message}` }, { status: 500 })
  }
}
