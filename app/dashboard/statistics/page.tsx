'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import {
  BarChart3,
  Calendar,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Users,
  ShieldAlert,
  Download,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Phone,
  MapPin,
  Clock,
  Briefcase,
  AlertTriangle,
  FileText,
  UserCheck,
  MessageSquare
} from 'lucide-react'

// Lead Record Interface as requested by the user
interface LeadRecord {
  "Lead ID": string;
  "İlk Temas Tarihi": string;
  "Ad Soyad / Firma": string;
  "Telefon Numarası": string;
  "İstenen Makine / Ürün": string;
  "İlk Mesaj / Arama Notu": string;
  "Görüşme Özeti / Sonuç": string;
  "Ek Notlar": string;
  "Sonraki Aksiyon": string;
  "Satış Uzmanı": string;
  rawLead?: any;
}

interface QualityReport {
  evaluatedTotal: number;
  potentialTotal: number;
  problematicTotal: number;
  
  unrelatedCount: number;
  accidentalClickCount: number;
  unreachableCount: number;
  notInterestedCount: number;
  potentialCount: number;
  pendingReviewCount: number;
  callbackCount: number;

  forwardedTotal: number;
  notForwardedTotal: number;
  potentialForwardedCount: number;
  potentialNotForwardedCount: number;

  qualityRows: Array<{ key: string; label: string; count: number }>;
  classifiedLeads: Array<{
    lead: LeadRecord;
    rawLead: any;
    qualityCategory: string;
    qualityCategoryKey: string;
    reason: string;
    matchedField: string;
    matchedPhrase: string;
    isForwarded: boolean;
  }>;
}

// Word boundaries regex in JS matching target keywords
const accidentalRegex = /\b(yanlislikla tikladim|yanlislikla tikladi|elim carpti|kazara tikladim|kazara tiklamis|yanlis basvuru yaptim|istemeden form doldurdum|yanlislikla mesaj attim|yanlislikla gonderildi|yanlislikla gonderilmistir)\b/;

const unrelatedRegex = /\b(is basvurusu|is ilani|is ariyorum|is arayan|reklam ve tanitim|spam mesaj|yanlis firma|yanlis sirket|ahsap kesim|ahsap kesme|cam kesim|cam kesme|tas kesim|tas kesme|mermer kesim|mermer kesme|sunger kesim|sunger kesme|komur kesim|komur kesme|kumas kesim|kumas kesme|pleksi kesim|pleksi kesme|forklift|lazer kesim disi|alakasiz talep|konu disi|spam|reklam)\b/;

const disinterestedRegex = /\b(ilgilenmiyor|vazgecti|talebi iptal|baska yerden aldi|baska firmadan aldi|rakip firmadan aldi|rakipten aldi|makineyi satin aldi|makine almis|makine satin almis|makine aldi|yatirim dusunmuyor|artik ihtiyaci yok|teklif istemiyor|talebini geri cekti)\b/;

const unreachableRegex = /\b(ulasilamadi|telefonu acmadi|cevap vermedi|telefon kapali|servis disi|mesgul|mesajlara cevap vermedi|arandi ulasilamadi|tekrar aranacak|geri donus yapmadi|cevap vermiyor|ulasilamiyor|ulasamadim|acmadi|kapali|donus yapmadi)\b/;

const potentialRegex = /\b(kw|watt|model|ebat|boyut|olcu|fiyat|teklif|katalog|bilgi|sunum|yatirim|lazer|kesim|kaynak|abkant|makine|makinesi|makinalari|makineyi)\b/;

// Normalization function matching database's normalize_turkish_text_v2
function normalizeTurkish(val: string | null | undefined): string {
  if (!val) return '';
  let res = String(val).toLowerCase();
  
  const replacements: Record<string, string> = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ş': 's', 'ö': 'o', 'ü': 'u'
  };
  
  res = res.replace(/[çğıışöüı]/g, m => replacements[m] || m);
  res = res.replace(/[.,;:!?()'"\-+=]/g, ' ');
  res = res.replace(/\s+/g, ' ');
  return res.trim();
}

function parseRawDateToIso(rawDate: string): string | null {
  if (!rawDate) return null;
  const s = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  const parts = s.split('.');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  if (s.includes('T')) {
    return s.split('T')[0];
  }
  return null;
}

function getLocalDateStringWithShift(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr.split('T')[0]
    
    // Get time representation in Europe/Istanbul timezone
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    
    const formattedParts = formatter.formatToParts(d)
    const partMap: Record<string, string> = {}
    formattedParts.forEach(p => {
      partMap[p.type] = p.value
    })
    
    const localDate = `${partMap.year}-${partMap.month}-${partMap.day}`
    const localHours = parseInt(partMap.hour, 10)
    const localMinutes = parseInt(partMap.minute, 10)
    
    // Check if the time is after 17:30 (17:30 to 23:59)
    if (localHours > 17 || (localHours === 17 && localMinutes >= 30)) {
      const shiftedDate = new Date(d.getTime() + 24 * 60 * 60 * 1000)
      return shiftedDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' })
    }
    
    return localDate
  } catch (e) {
    return dateStr.split('T')[0]
  }
}

function getLeadDate(lead: any): string | null {
  if (lead.first_contact_date) {
    return lead.first_contact_date;
  }
  const rawDate = lead.legacy_raw_data?.["İlk Temas Tarihi"];
  if (rawDate) {
    return parseRawDateToIso(rawDate);
  }
  if (lead.first_contact_at) {
    return getLocalDateStringWithShift(lead.first_contact_at);
  }
  if (lead.legacy_source_file === null && lead.conversations && lead.conversations.length > 0) {
    const conv = lead.conversations[0];
    const convDate = conv.last_message_at || conv.created_at;
    if (convDate) {
      return getLocalDateStringWithShift(convDate);
    }
  }
  if (lead.created_at) {
    return getLocalDateStringWithShift(lead.created_at);
  }
  return null;
}

function getLeadChannel(lead: any): string {
  const rawChannel = lead.legacy_raw_data?.["İletişim Kanalı"];
  if (lead.legacy_source_file && rawChannel) {
    const lower = String(rawChannel).toLowerCase();
    if (lower.includes('whatsapp') || lower.includes('wp')) return 'WhatsApp Mesajı';
    if (lower.includes('telefon') || lower.includes('arama') || lower.includes('tel')) return 'Telefon';
    if (lower.includes('eposta') || lower.includes('e-posta') || lower.includes('mail')) return 'E-posta';
    if (lower.includes('instagram') || lower.includes('dm')) return 'Instagram';
    if (lower.includes('facebook') || lower.includes('fb')) return 'Facebook';
    if (lower.includes('web') || lower.includes('site') || lower.includes('form')) return 'Web Sitesi';
    return 'Diğer';
  }
  
  if (lead.communication_channels?.name) {
    return lead.communication_channels.name;
  }
  return 'Belirtilmemiş';
}

function cleanPhoneNum(phone: string | null | undefined): string {
  if (!phone) return ''
  return String(phone).replace(/\D/g, '')
}

function isForwardedToSales(lead: LeadRecord): boolean {
  const rep = (lead["Satış Uzmanı"] || '').trim().toLowerCase();
  if (!rep) return false;
  if (rep === '-' || rep === '—' || rep === 'yok' || rep === 'belirtilmemis' || rep === 'belirtilmemiş' || rep === 'atanmadi' || rep === 'atanmadı') {
    return false;
  }
  return true;
}

function isLeadSold(lead: LeadRecord): boolean {
  if (lead.rawLead?.converted_to_sale === true || lead.rawLead?.converted_at) {
    return true;
  }
  const statusName = String(lead.rawLead?.lead_status_text || lead.rawLead?.lead_statuses?.name || '').trim();
  if (statusName === 'Satışa Dönüştü' || statusName === 'Satış Tamamlandı') {
    return true;
  }
  const saleStatus = String(lead.rawLead?.sale_status || lead.rawLead?.legacy_raw_data?.["Satış Durumu"] || '').trim().toLowerCase();
  if (saleStatus.includes('satis tamamlandi') || saleStatus.includes('satış tamamlandı') || saleStatus === 'satis' || saleStatus === 'satış' || saleStatus.includes('kazanildi') || saleStatus.includes('kazanıldı')) {
    return true;
  }
  return false;
}

function classifyLeadQuality(lead: LeadRecord): { qualityCategory: string; reason: string; matchedField: string; matchedPhrase: string } {
  const fields = [
    { name: "İlk Mesaj / Arama Notu", value: lead["İlk Mesaj / Arama Notu"] },
    { name: "Görüşme Özeti / Sonuç", value: lead["Görüşme Özeti / Sonuç"] },
    { name: "Ek Notlar", value: lead["Ek Notlar"] },
    { name: "Sonraki Aksiyon", value: lead["Sonraki Aksiyon"] },
    { name: "İstenen Makine / Ürün", value: lead["İstenen Makine / Ürün"] }
  ];

  // 1. Accidental click
  for (const field of fields) {
    if (field.name === "İstenen Makine / Ürün") continue;
    const norm = normalizeTurkish(field.value);
    const match = accidentalRegex.exec(norm);
    if (match) {
      return {
        qualityCategory: "Yanlışlıkla tıklayan / elim çarptı",
        reason: `${field.name} alanında yanlışlıkla başvuru ifadesi bulundu.`,
        matchedField: field.name,
        matchedPhrase: match[0]
      };
    }
  }

  // 2. Unrelated
  for (const field of fields) {
    const norm = normalizeTurkish(field.value);
    const match = unrelatedRegex.exec(norm);
    if (match) {
      return {
        qualityCategory: "Alakasız / konu dışı lead",
        reason: `${field.name} alanında kapsam dışı talep veya reklam/spam tespit edildi.`,
        matchedField: field.name,
        matchedPhrase: match[0]
      };
    }
  }

  // 3. Not Interested
  for (const field of fields) {
    if (field.name === "İstenen Makine / Ürün") continue;
    const norm = normalizeTurkish(field.value);
    const match = disinterestedRegex.exec(norm);
    if (match) {
      return {
        qualityCategory: "İlgilenmeyen / vazgeçen / başka yerden alan",
        reason: `${field.name} alanında ilgilenmediği veya vazgeçtiği tespit edildi.`,
        matchedField: field.name,
        matchedPhrase: match[0]
      };
    }
  }

  // 4. Unreachable
  for (const field of fields) {
    if (field.name === "İstenen Makine / Ürün") continue;
    const norm = normalizeTurkish(field.value);
    const match = unreachableRegex.exec(norm);
    if (match) {
      return {
        qualityCategory: "Ulaşılamayan / açmayan / cevap vermeyen",
        reason: `${field.name} alanında müşteriye ulaşılamadığı tespit edildi.`,
        matchedField: field.name,
        matchedPhrase: match[0]
      };
    }
  }

  // 5. Potential
  for (const field of fields) {
    const norm = normalizeTurkish(field.value);
    const match = potentialRegex.exec(norm);
    if (match) {
      return {
        qualityCategory: "Potansiyel kayıt",
        reason: `${field.name} alanında sektörel kelimeler tespit edildi.`,
        matchedField: field.name,
        matchedPhrase: match[0]
      };
    }
  }

  return {
    qualityCategory: "Değerlendirme bekliyor",
    reason: "Kayıt detaylarında belirleyici bir kelime bulunamadı, manuel inceleme gerekiyor.",
    matchedField: "—",
    matchedPhrase: "—"
  };
}

function buildQualityReport(adaptedLeads: LeadRecord[]): QualityReport {
  let unrelatedCount = 0;
  let accidentalClickCount = 0;
  let unreachableCount = 0;
  let notInterestedCount = 0;
  let potentialCount = 0;
  let pendingReviewCount = 0;
  let callbackCount = 0;

  let forwardedTotal = 0;
  let notForwardedTotal = 0;
  let potentialForwardedCount = 0;
  let potentialNotForwardedCount = 0;

  const classifiedLeads = adaptedLeads.map((adapted) => {
    const rawLead = adapted.rawLead;
    
    let categoryKey = rawLead?.final_quality_category;
    let resolvedCat = '';
    let resolvedReason = '';
    let matchedField = '';
    let matchedPhrase = '';

    if (!categoryKey || categoryKey === 'pending_review') {
      // Fallback to rule-based frontend classification
      const ruleClassification = classifyLeadQuality(adapted);
      
      const reverseLabelMap: Record<string, string> = {
        'Alakasız / konu dışı lead': 'unrelated',
        'Yanlışlıkla tıklayan / elim çarptı': 'accidental_click',
        'Ulaşılamayan / açmayan / cevap vermeyen': 'unreachable',
        'İlgilenmeyen / vazgeçen / başka yerden alan': 'not_interested',
        'Potansiyel kayıt': 'potential',
        'Değerlendirme bekliyor': 'pending_review',
        'Geri aranacak / bizi arayacak (Callback)': 'callback'
      };
      
      categoryKey = reverseLabelMap[ruleClassification.qualityCategory] || 'pending_review';
      resolvedCat = ruleClassification.qualityCategory;
      resolvedReason = ruleClassification.reason;
      matchedField = ruleClassification.matchedField;
      matchedPhrase = ruleClassification.matchedPhrase;
    } else {
      const labelMap: Record<string, string> = {
        unrelated: 'Alakasız / konu dışı lead',
        accidental_click: 'Yanlışlıkla tıklayan / elim çarptı',
        unreachable: 'Ulaşılamayan / açmayan / cevap vermeyen',
        not_interested: 'İlgilenmeyen / vazgeçen / başka yerden alan',
        potential: 'Potansiyel kayıt',
        pending_review: 'Değerlendirme bekliyor',
        callback: 'Geri aranacak / bizi arayacak (Callback)'
      };
      resolvedCat = labelMap[categoryKey] || 'Değerlendirme bekliyor';
      resolvedReason = rawLead?.quality_reason || 'Sınıflandırılmamış';
      matchedField = rawLead?.quality_classification_method === 'rule' ? 'Kural Tabanlı' : 
                            (rawLead?.quality_classification_method === 'ai' ? 'Yapay Zeka (AI)' : 
                             (rawLead?.quality_classification_method === 'manual' ? 'Manuel' : '—'));
      matchedPhrase = rawLead?.quality_classification_version || '—';
    }

    if (categoryKey === 'unrelated') unrelatedCount++;
    else if (categoryKey === 'accidental_click') accidentalClickCount++;
    else if (categoryKey === 'unreachable') unreachableCount++;
    else if (categoryKey === 'not_interested') notInterestedCount++;
    else if (categoryKey === 'potential') potentialCount++;
    else if (categoryKey === 'pending_review') pendingReviewCount++;
    else if (categoryKey === 'callback') callbackCount++;

    const isForwarded = isForwardedToSales(adapted);
    if (isForwarded) {
      forwardedTotal++;
      if (categoryKey === 'potential') {
        potentialForwardedCount++;
      }
    } else {
      notForwardedTotal++;
      if (categoryKey === 'potential') {
        potentialNotForwardedCount++;
      }
    }

    return {
      lead: adapted,
      rawLead,
      qualityCategory: resolvedCat,
      qualityCategoryKey: categoryKey,
      reason: resolvedReason,
      matchedField,
      matchedPhrase,
      isForwarded
    };
  });

  const evaluatedTotal = adaptedLeads.length;
  const problematicTotal = unrelatedCount + accidentalClickCount + unreachableCount + notInterestedCount;
  const potentialTotal = potentialCount;

  const qualityRows = [
    { key: 'unrelated', label: 'Alakasız / konu dışı lead', count: unrelatedCount },
    { key: 'accidental_click', label: 'Yanlışlıkla tıklayan / elim çarptı', count: accidentalClickCount },
    { key: 'unreachable', label: 'Ulaşılamayan / açmayan / cevap vermeyen', count: unreachableCount },
    { key: 'not_interested', label: 'İlgilenmeyen / vazgeçen / başka yerden alan', count: notInterestedCount },
    { key: 'callback', label: 'Geri aranacak / bizi arayacak (Callback)', count: callbackCount },
    { key: 'problematic_total', label: 'Problemli / niteliksiz toplam', count: problematicTotal },
    { key: 'potential', label: 'Geriye kalan potansiyel kayıt', count: potentialTotal },
    { key: 'pending_review', label: 'Değerlendirme bekliyor', count: pendingReviewCount }
  ];

  return {
    evaluatedTotal,
    potentialTotal,
    problematicTotal,
    
    unrelatedCount,
    accidentalClickCount,
    unreachableCount,
    notInterestedCount,
    potentialCount,
    pendingReviewCount,
    callbackCount,

    forwardedTotal,
    notForwardedTotal,
    potentialForwardedCount,
    potentialNotForwardedCount,

    qualityRows,
    classifiedLeads
  };
}

function isWaLead(l: any): boolean {
  if (!l) return false;
  const channelName = String(l.communication_channels?.name || l.legacy_raw_data?.["İletişim Kanalı"] || '').toLowerCase();
  const sourceCode = String(l.lead_sources?.code || '').toLowerCase();
  const sourceName = String(l.lead_sources?.name || l.legacy_raw_data?.["Lead Kaynağı"] || '').toLowerCase();
  
  return (
    channelName.includes('whatsapp') || channelName.includes('wp') ||
    sourceCode.includes('wa') || sourceCode.includes('whatsapp') ||
    sourceName.includes('whatsapp') || sourceName.includes('wp') ||
    l.status_id === '22222222-0000-0000-0000-000000000020'
  );
}

function computeWhatsAppStats(
  conversations: any[],
  leads: any[],
  messages: any[],
  mStart: string,
  mEnd: string
) {
  const cleanPhoneNum = (phone: string | null | undefined): string => {
    if (!phone) return '';
    const cleaned = String(phone).replace(/\D/g, '');
    return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
  };

  const phoneToLeads = new Map<string, any[]>();
  leads.forEach(l => {
    const ph = cleanPhoneNum(l.phone || l.phone_normalized);
    if (ph) {
      if (!phoneToLeads.has(ph)) {
        phoneToLeads.set(ph, []);
      }
      phoneToLeads.get(ph)!.push(l);
    }
  });

  const phoneToConvs = new Map<string, any[]>();
  conversations.forEach(c => {
    const lead = c.lead_id ? leads.find(l => l.id === c.lead_id) : null;
    const ph = cleanPhoneNum(lead?.phone || lead?.phone_normalized || '');
    if (ph) {
      if (!phoneToConvs.has(ph)) {
        phoneToConvs.set(ph, []);
      }
      phoneToConvs.get(ph)!.push(c);
    }
  });

  const getLocalDateString = (dateStr: string | null | undefined) => {
    return getLocalDateStringWithShift(dateStr);
  };

  const isInPeriod = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const localDate = getLocalDateString(dateStr);
    return localDate && localDate >= mStart && localDate <= mEnd;
  };

  const activePhones = new Set<string>();

  conversations.forEach(c => {
    const lead = c.lead_id ? leads.find(l => l.id === c.lead_id) : null;
    const ph = cleanPhoneNum(lead?.phone || lead?.phone_normalized || '');
    if (ph && isInPeriod(c.last_message_at || c.created_at)) {
      activePhones.add(ph);
    }
  });

  leads.forEach(l => {
    const ph = cleanPhoneNum(l.phone || l.phone_normalized);
    const leadDate = getLeadDate(l);
    const inPeriod = leadDate && leadDate >= mStart && leadDate <= mEnd;
    if (ph && inPeriod && isWaLead(l)) {
      activePhones.add(ph);
    }
  });

  let unconvertedChatsCount = 0;
  let newLeadsCount = 0;
  let contactedLeadsCount = 0;
  let uncontactedLeadsCount = 0;

  const resolvedLeadsList: any[] = [];

  activePhones.forEach(ph => {
    const phoneLeads = phoneToLeads.get(ph) || [];
    const convertedLead = phoneLeads.find(l => l.status_id !== '22222222-0000-0000-0000-000000000020');
    const unconvertedLead = phoneLeads.find(l => l.status_id === '22222222-0000-0000-0000-000000000020');
    const resolvedLead = convertedLead || unconvertedLead;
    if (!resolvedLead) return;

    const isConverted = !!convertedLead;
    resolvedLeadsList.push({
      lead: resolvedLead,
      isConverted
    });

    if (isConverted) {
      newLeadsCount++;
      const hasBeenCalled = resolvedLead.conversation_completed === true || (resolvedLead.calls && resolvedLead.calls.length > 0) || !!resolvedLead.sales_representative_text || !!resolvedLead.legacy_sales_specialist_name;
      if (hasBeenCalled) {
        contactedLeadsCount++;
      } else {
        uncontactedLeadsCount++;
      }
    } else {
      unconvertedChatsCount++;
    }
  });

  return {
    totalChats: activePhones.size,
    newLeadsCount,
    contactedLeadsCount,
    uncontactedLeadsCount,
    unconvertedChatsCount,
    resolvedLeadsList
  };
}

export default function StatisticsPage() {
  const supabase = createClient()

  // Filter states (saved to localStorage for persistence across reloads)
  const [periodFilter, setPeriodFilter] = useState('tum_eski')
  const [channelFilter, setChannelFilter] = useState('all_channels')
  const [scopeFilter, setScopeFilter] = useState('legacy_only')
  const [customStartDate, setCustomStartDate] = useState(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })
  const [customEndDate, setCustomEndDate] = useState(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })

  // Refresh trigger state
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // UI States
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [callsCount, setCallsCount] = useState<number>(0)
  const [periodCalls, setPeriodCalls] = useState<any[]>([])
  const [reportData, setReportData] = useState<QualityReport | null>(null)
  
  const [managerStats, setManagerStats] = useState<{
    whatsappConvsCount: number;
    newLeadsCount: number;
    contactedLeadsCount: number;
    uncontactedLeadsCount: number;
    unconvertedChatsCount: number;
  } | null>(null)

  const [activeTab, setActiveTab] = useState<'quality' | 'whatsapp_messages'>('whatsapp_messages')
  const [allRawMessages, setAllRawMessages] = useState<any[]>([])
  const [allRawLeads, setAllRawLeads] = useState<any[]>([])
  const [allRawConversations, setAllRawConversations] = useState<any[]>([])
  
  // Debug leads list (First unrelated leads)
  const [debugUnrelatedLeads, setDebugUnrelatedLeads] = useState<any[]>([])
  const [loadingDebug, setLoadingDebug] = useState(false)
  
  // Current logged in administrator profile
  const [myProfile, setMyProfile] = useState<any>(null)
  
  // Drawer states
  const [activeMetric, setActiveMetric] = useState<string | null>(null) // e.g. 'unrelated', 'forwarded'
  const [drawerSearch, setDrawerSearch] = useState('')
  const [drawerLeads, setDrawerLeads] = useState<any[]>([])
  const [loadingDrawer, setLoadingDrawer] = useState(false)
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null)
  
  // Manual override editing states
  const [overrideCategory, setOverrideCategory] = useState<string>('')
  const [overrideReason, setOverrideReason] = useState<string>('')
  const [savingOverrideId, setSavingOverrideId] = useState<string | null>(null)
  const [auditLogs, setAuditLogs] = useState<Record<string, any[]>>({})
  
  // Floating Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [reanalysisProgress, setReanalysisProgress] = useState('')

  // Trigger floating toast
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 4000)
  }

  // Persist and load filters to/from localStorage
  useEffect(() => {
    // Clear React Query cache key or localStorage cache if any (Rule 12)
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i)
          if (key && (key.includes('query') || key.includes('cache') || key.includes('statistics_'))) {
            localStorage.removeItem(key)
          }
        }
      }
    } catch (e) {
      console.error('Error clearing localStorage cache:', e)
    }

    if (typeof window !== 'undefined') {
      const savedPeriod = localStorage.getItem('stats_period_filter')
      const savedChannel = localStorage.getItem('stats_channel_filter')
      const savedScope = localStorage.getItem('stats_scope_filter')
      const savedStart = localStorage.getItem('stats_custom_start')
      const savedEnd = localStorage.getItem('stats_custom_end')

      if (savedPeriod) setPeriodFilter(savedPeriod)
      if (savedChannel) setChannelFilter(savedChannel)
      if (savedScope && savedScope !== 'all_data') setScopeFilter(savedScope)
      if (savedStart) setCustomStartDate(savedStart)
      if (savedEnd) setCustomEndDate(savedEnd)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('stats_period_filter', periodFilter)
  }, [periodFilter])

  useEffect(() => {
    localStorage.setItem('stats_channel_filter', channelFilter)
  }, [channelFilter])

  useEffect(() => {
    localStorage.setItem('stats_scope_filter', scopeFilter)
  }, [scopeFilter])

  useEffect(() => {
    localStorage.setItem('stats_custom_start', customStartDate)
  }, [customStartDate])

  useEffect(() => {
    localStorage.setItem('stats_custom_end', customEndDate)
  }, [customEndDate])

  // Fetch administrator profile
  useEffect(() => {
    const getProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
          if (data) setMyProfile(data)
        }
      } catch (err) {
        console.error('Error fetching admin profile:', err)
      }
    }
    getProfile()
  }, [])

  // Resolve start/end dates based on period filter
  const resolvedDates = useMemo(() => {
    const formatLocalDate = (date: Date): string => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    let start_date: string | null = null
    let end_date: string | null = null
    const today = new Date()

    if (periodFilter === 'bugun') {
      const todayStr = formatLocalDate(today)
      start_date = todayStr
      end_date = todayStr
    } else if (periodFilter === 'dun') {
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      const yesterdayStr = formatLocalDate(yesterday)
      start_date = yesterdayStr
      end_date = yesterdayStr
    } else if (periodFilter === 'tum_eski') {
      start_date = '2026-01-01'
      end_date = formatLocalDate(today)
    } else if (periodFilter === 'ocak_2026') {
      start_date = '2026-01-01'
      end_date = '2026-01-31'
    } else if (periodFilter === 'subat_2026') {
      start_date = '2026-02-01'
      end_date = '2026-02-28'
    } else if (periodFilter === 'mart_2026') {
      start_date = '2026-03-01'
      end_date = '2026-03-31'
    } else if (periodFilter === 'nisan_2026') {
      start_date = '2026-04-01'
      end_date = '2026-04-30'
    } else if (periodFilter === 'bu_ay') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      start_date = formatLocalDate(start)
      end_date = formatLocalDate(end)
    } else if (periodFilter === 'gecen_ay') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      start_date = formatLocalDate(start)
      end_date = formatLocalDate(end)
    } else if (periodFilter === 'mayis_2026') {
      start_date = '2026-05-01'
      end_date = '2026-05-31'
    } else if (periodFilter === 'haziran_2026') {
      start_date = '2026-06-01'
      end_date = '2026-06-30'
    } else if (periodFilter === 'tek_gun') {
      start_date = customStartDate || null
      end_date = customStartDate || null
    } else if (periodFilter === 'ozel') {
      start_date = customStartDate || null
      end_date = customEndDate || null
    }

    return { start_date, end_date }
  }, [periodFilter, customStartDate, customEndDate])

  const salesRepStats = useMemo(() => {
    if (!reportData) return []
    const repGroups: Record<string, { count: number; leads: any[] }> = {}
    
    reportData.classifiedLeads.forEach(item => {
      const isForwarded = item.isForwarded
      if (isForwarded) {
        const repName = (item.lead["Satış Uzmanı"] || '').trim() || 'Belirtilmemiş'
        if (!repGroups[repName]) {
          repGroups[repName] = { count: 0, leads: [] }
        }
        repGroups[repName].count++
        repGroups[repName].leads.push(item)
      }
    })
    
    return Object.entries(repGroups)
      .map(([name, data]) => ({
        name,
        count: data.count,
        leads: data.leads
      }))
      .sort((a, b) => b.count - a.count)
  }, [reportData])

  const callerStats = useMemo(() => {
    const groups: Record<string, { count: number; calls: any[] }> = {}
    periodCalls.forEach(call => {
      const callerName = call.profiles?.full_name || 'Bilinmeyen Temsilci'
      if (!groups[callerName]) {
        groups[callerName] = { count: 0, calls: [] }
      }
      groups[callerName].count++
      groups[callerName].calls.push(call)
    })
    return Object.entries(groups)
      .map(([name, data]) => ({
        name,
        count: data.count,
        calls: data.calls
      }))
      .sort((a, b) => b.count - a.count)
  }, [periodCalls])

  const dailyStatsData = useMemo(() => {
    if (!reportData) return []

    const getLocalCallDate = (createdAtStr: string) => {
      if (!createdAtStr) return null;
      if (!createdAtStr.includes('T') && !createdAtStr.includes('+') && !createdAtStr.includes('Z')) {
        return createdAtStr;
      }
      try {
        const d = new Date(createdAtStr);
        if (isNaN(d.getTime())) return createdAtStr.split('T')[0];
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      } catch (e) {
        return createdAtStr.split('T')[0];
      }
    }
    
    const dailyMap: Record<string, { date: string; leadsCount: number; callsCount: number; forwardedCount: number }> = {}
    
    const initDate = (dStr: string) => {
      if (!dailyMap[dStr]) {
        dailyMap[dStr] = { date: dStr, leadsCount: 0, callsCount: 0, forwardedCount: 0 }
      }
    }
    
    reportData.classifiedLeads.forEach(item => {
      const dStr = getLeadDate(item.rawLead)
      if (dStr) {
        initDate(dStr)
        dailyMap[dStr].leadsCount++
        if (item.isForwarded) {
          dailyMap[dStr].forwardedCount++
        }
      }
    })
    
    periodCalls.forEach(call => {
      if (call.created_at) {
        const dStr = getLocalCallDate(call.created_at)
        if (dStr) {
          initDate(dStr)
          dailyMap[dStr].callsCount++
        }
      }
    })
    
    const sortedData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))
    
    return sortedData.map(item => {
      const parts = item.date.split('-')
      let displayDate = item.date
      if (parts.length === 3) {
        displayDate = `${parts[2]}.${parts[1]}`
      }
      return {
        ...item,
        displayDate
      }
    })
  }, [reportData, periodCalls])

  const cleanPhoneNum = (phone: string | null | undefined): string => {
    if (!phone) return ''
    const cleaned = String(phone).replace(/\D/g, '')
    return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned
  }

  const whatsappMessageStats = useMemo(() => {
    const todayStr = getLocalDateStringWithShift(new Date().toISOString()) || ''
    const mStart = resolvedDates.start_date || todayStr
    const mEnd = resolvedDates.end_date || todayStr

    const stats = computeWhatsAppStats(allRawConversations, allRawLeads, allRawMessages, mStart, mEnd)

    const getFormattedDate = (dateStr: string) => {
      try {
        const parts = dateStr.split('-')
        if (parts.length === 3) return `${parts[2]}.${parts[1]}`
        return dateStr
      } catch (e) {
        return dateStr
      }
    }

    const getLocalDateString = (dateStr: string | null | undefined) => {
      return getLocalDateStringWithShift(dateStr);
    };

    // Daily Trend
    const allDays = new Set<string>()
    allRawConversations.forEach(c => {
      const dateStr = c.last_message_at || c.created_at
      const dayStr = getLocalDateString(dateStr)
      if (dayStr && dayStr >= mStart && dayStr <= mEnd) {
        allDays.add(dayStr)
      }
    })
    allRawLeads.forEach(l => {
      const dayStr = getLeadDate(l)
      if (dayStr && dayStr >= mStart && dayStr <= mEnd && isWaLead(l)) {
        allDays.add(dayStr)
      }
    })

    const sortedDays = Array.from(allDays).sort()

    const dailyTrend = sortedDays.map(dayStr => {
      const dayStats = computeWhatsAppStats(allRawConversations, allRawLeads, allRawMessages, dayStr, dayStr)
      return {
        date: getFormattedDate(dayStr),
        incomingChats: dayStats.totalChats,
        addedToCrm: dayStats.newLeadsCount,
        calledLeads: dayStats.contactedLeadsCount,
        pendingLeads: dayStats.uncontactedLeadsCount,
        unconvertedChats: dayStats.unconvertedChatsCount
      }
    })

    // Agent performance table
    const agentMap = new Map()
    const leadsMap = new Map(allRawLeads.map(l => [l.id, l]))
    const phoneToConvs = new Map<string, any[]>()
    allRawConversations.forEach(c => {
      const lead = c.lead_id ? leadsMap.get(c.lead_id) : null
      const ph = cleanPhoneNum(lead?.phone || lead?.phone_normalized || '')
      if (ph) {
        if (!phoneToConvs.has(ph)) {
          phoneToConvs.set(ph, [])
        }
        phoneToConvs.get(ph)!.push(c)
      }
    })

    const phoneToLeads = new Map<string, any[]>()
    allRawLeads.forEach(l => {
      const ph = cleanPhoneNum(l.phone || l.phone_normalized)
      if (ph) {
        if (!phoneToLeads.has(ph)) {
          phoneToLeads.set(ph, [])
        }
        phoneToLeads.get(ph)!.push(l)
      }
    })

    stats.resolvedLeadsList.forEach(x => {
      const resolvedLead = x.lead
      const ph = cleanPhoneNum(resolvedLead.phone || resolvedLead.phone_normalized)
      const convs = phoneToConvs.get(ph) || []
      const newestConv = convs.sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''))[0]
      const agentName = newestConv?.profiles?.full_name || resolvedLead.profiles?.full_name || 'Atanmamış'

      if (!agentMap.has(agentName)) {
        agentMap.set(agentName, {
          name: agentName,
          totalChats: 0,
          addedToCrm: 0,
          calledLeads: 0,
          unconvertedChats: 0
        })
      }

      const agentStats = agentMap.get(agentName)
      agentStats.totalChats++

      if (x.isConverted) {
        agentStats.addedToCrm++
        const hasBeenCalled = resolvedLead.conversation_completed === true || (resolvedLead.calls && resolvedLead.calls.length > 0) || !!resolvedLead.sales_representative_text || !!resolvedLead.legacy_sales_specialist_name
        if (hasBeenCalled) {
          agentStats.calledLeads++
        }
      } else {
        agentStats.unconvertedChats++
      }
    })

    const agentPerformance = Array.from(agentMap.values())
      .map(item => {
        const rate = item.totalChats > 0 ? ((item.addedToCrm / item.totalChats) * 100).toFixed(0) : '0'
        return {
          ...item,
          conversionRate: `${rate}%`
        }
      })
      .sort((a, b) => b.totalChats - a.totalChats)

    // Unconverted chats list (Unutulan / Eklenmeyen)
    const unconvertedChatsList: any[] = []
    stats.resolvedLeadsList.forEach(x => {
      if (x.isConverted) return;
      const resolvedLead = x.lead
      const ph = cleanPhoneNum(resolvedLead.phone || resolvedLead.phone_normalized)
      const convs = phoneToConvs.get(ph) || []
      const newestConv = convs.sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''))[0]
      if (!newestConv) return

      const convMsgs = allRawMessages.filter(m => m.conversation_id === newestConv.id)
      const latestMsg = convMsgs.sort((a, b) => (b.sent_at || b.created_at || '').localeCompare(a.sent_at || a.created_at || ''))[0]

      unconvertedChatsList.push({
        id: newestConv.id,
        phone: resolvedLead.phone || resolvedLead.phone_normalized || 'Telefon Yok',
        name: resolvedLead ? (
          resolvedLead.full_name && resolvedLead.full_name !== 'Belirtilmemiş'
            ? resolvedLead.full_name
            : `${resolvedLead.first_name || ''} ${resolvedLead.last_name || ''}`.trim() || 'Yeni Ziyaretçi'
        ) : 'Yeni Ziyaretçi',
        lastMessageAt: newestConv.last_message_at,
        preview: latestMsg?.content || 'Mesaj detayı bulunmuyor'
      })
    })

    unconvertedChatsList.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))

    return {
      totalChats: stats.totalChats,
      newLeadsCount: stats.newLeadsCount,
      contactedLeadsCount: stats.contactedLeadsCount,
      uncontactedLeadsCount: stats.uncontactedLeadsCount,
      unconvertedChatsCount: stats.unconvertedChatsCount,
      dailyTrend,
      agentPerformance,
      unconvertedChatsList: unconvertedChatsList.slice(0, 10)
    }
  }, [allRawConversations, allRawLeads, allRawMessages, resolvedDates])

  // Fetch stats count data from get_lead_quality_stats RPC
  const fetchStatsData = async () => {
    setLoading(true)
    setErrorMsg('')
    setMigrationNeeded(false)
    try {
      const { start_date, end_date } = resolvedDates

      let utcStart: string | null = null
      let utcEnd: string | null = null
      if (start_date) {
        const d = new Date(start_date)
        d.setDate(d.getDate() - 1)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        utcStart = `${y}-${m}-${day}T14:30:00.000Z`
      }
      if (end_date) {
        utcEnd = `${end_date}T14:30:00.000Z`
      }

      // Query calls matching active date filter
      let callsQuery = supabase
        .from('calls')
        .select('*, profiles:user_id(full_name)')
      
      if (utcStart) {
        callsQuery = callsQuery.gte('created_at', utcStart)
      }
      if (utcEnd) {
        callsQuery = callsQuery.lte('created_at', utcEnd)
      }
      
      const { data: cData, error: cErr } = await callsQuery
      const activeCalls = (!cErr && cData) ? cData : []

      // Query conversations matching active date filter (for WhatsApp contacts)
      let convQuery = supabase
        .from('conversations')
        .select('*, profiles:assigned_user_id(full_name)')
        .eq('channel', 'whatsapp')
      
      const { data: convData, error: convErr } = await convQuery
      const rawConversations = (!convErr && convData) ? convData : []

      // 1. Fetch all active leads from Supabase. We apply scopeFilter in-memory
      // to ensure that the Manager Tracking Panel calculations and drawer lookups always have access
      // to the full dataset.
      let query = supabase
        .from('leads')
        .select('*, communication_channels:communication_channel_id(name), lead_sources:source_id(name, code), calls(id), conversations(last_message_at, created_at), profiles:assigned_call_center_user_id(id, full_name)')
        .eq('is_active', true)

      const { data: rawLeads, error } = await query
      if (error) throw error

      if (!rawLeads) {
        setAllRawLeads([])
        setAllRawConversations([])
        setAllRawMessages([])
        setStats(null)
        setReportData(null)
        return
      }

      // Exclude test/internal phone numbers
      const EXCLUDED_PHONES = new Set([
        '905335745839',
        '905416003432',
        '905061122350',
        '905452733802',
        '905366507583',
        '905070471333',
        '905379527983',
        '905345743401',
        '905379527977'
      ])

      const cleanPhoneNum = (phone: string | null | undefined): string => {
        if (!phone) return ''
        return String(phone).replace(/\D/g, '')
      }

      const cleanRawLeads = rawLeads.filter(lead => {
        const ph = cleanPhoneNum(lead.phone || lead.phone_normalized)
        return !EXCLUDED_PHONES.has(ph) && !EXCLUDED_PHONES.has(ph.replace(/^90/, ''))
      })
      setAllRawLeads(cleanRawLeads)

      const leadsMap = new Map(rawLeads ? rawLeads.map(l => [l.id, l]) : [])
      const filteredConversations = rawConversations.filter(c => {
        const lead = c.lead_id ? leadsMap.get(c.lead_id) : null
        if (lead) {
          const ph = cleanPhoneNum(lead.phone || lead.phone_normalized)
          if (EXCLUDED_PHONES.has(ph) || EXCLUDED_PHONES.has(ph.replace(/^90/, ''))) {
            return false
          }
        }
        return true
      })
      setAllRawConversations(filteredConversations)

      // Query messages matching active date filter (for WhatsApp messaging statistics)
      // Since Supabase REST API limits the response to max 1000 rows, we use a paginated range loop to fetch all messages.
      let rawMessages: any[] = []
      let fromIdx = 0
      const limitVal = 1000
      let hasMoreMsgs = true

      while (hasMoreMsgs) {
        let msgQuery = supabase
          .from('messages')
          .select('*, conversations(lead_id)')
          .order('sent_at', { ascending: false })
          .range(fromIdx, fromIdx + limitVal - 1)
        
        if (utcStart) {
          msgQuery = msgQuery.gte('sent_at', utcStart)
        }
        if (utcEnd) {
          msgQuery = msgQuery.lte('sent_at', utcEnd)
        }
        
        const { data: chunk, error: msgErr } = await msgQuery
        if (msgErr) throw msgErr
        
        if (chunk && chunk.length > 0) {
          rawMessages = [...rawMessages, ...chunk]
          if (chunk.length < limitVal) {
            hasMoreMsgs = false
          } else {
            fromIdx += limitVal
          }
        } else {
          hasMoreMsgs = false
        }
      }

      const cleanRawMessages = rawMessages.filter(msg => {
        const leadId = msg.conversations?.lead_id
        if (leadId) {
          const lead = leadsMap.get(leadId)
          if (lead) {
            const ph = cleanPhoneNum(lead.phone || lead.phone_normalized)
            if (EXCLUDED_PHONES.has(ph) || EXCLUDED_PHONES.has(ph.replace(/^90/, ''))) {
              return false
            }
          }
        }
        return true
      })
      setAllRawMessages(cleanRawMessages)

      // No deduplication by lead ID (each Excel row is a separate lead)
      let uniqueRawLeads = cleanRawLeads

      // Apply scope filter in memory for the legacy stats and quality report
      if (scopeFilter === 'legacy_only') {
        uniqueRawLeads = uniqueRawLeads.filter(lead => lead.legacy_source_file !== null)
      }

      const isWaLead = (l: any) => {
        return (
          l.source_id === '474b7a22-c53f-43ba-a8bd-75ce0977a798' || 
          l.source_id === '11111111-0000-0000-0000-000000000005' ||
          l.status_id === '22222222-0000-0000-0000-000000000020' ||
          l.lead_sources?.code === 'META_WA'
        ) && l.legacy_source_file === null;
      }

      // --- COMPUTATION FOR MANAGER STATS PANEL ---
      // Calculate these metrics using rawLeads and rawConversations based on the active period (start_date/end_date).
      // If start_date/end_date are null (Tüm Eski Veriler), we use the current date (today) as default
      // because manager tracking is most relevant for "today's" or "daily" activity.
      const todayStr = getLocalDateStringWithShift(new Date().toISOString()) || ''
      const mStart = start_date || todayStr
      const mEnd = end_date || todayStr

      const stats = computeWhatsAppStats(filteredConversations, cleanRawLeads, cleanRawMessages, mStart, mEnd)

      setManagerStats({
        whatsappConvsCount: stats.totalChats,
        newLeadsCount: stats.newLeadsCount,
        contactedLeadsCount: stats.contactedLeadsCount,
        uncontactedLeadsCount: stats.uncontactedLeadsCount,
        unconvertedChatsCount: stats.unconvertedChatsCount
      })

      // Filter out non-legacy (CRM) leads created before their respective official starts to prevent development test data and history sync from polluting lead stats:
      // - Unregistered WhatsApp leads (status_id = '22222222-0000-0000-0000-000000000020') start from 2026-06-01.
      // - Registered CRM leads start from 2026-06-01.
      uniqueRawLeads = uniqueRawLeads.filter(lead => {
        if (lead.legacy_source_file === null) {
          const leadDate = getLeadDate(lead)
          if (lead.status_id === '22222222-0000-0000-0000-000000000020') {
            if (!leadDate || leadDate < '2026-06-01') {
              return false
            }
          } else {
            if (!leadDate || leadDate < '2026-06-01') {
              return false
            }
          }
        }
        return true
      })

      // 3. Filter by resolved date in JavaScript (Rule 1)
      let filteredRawLeads = uniqueRawLeads
      if (start_date || end_date) {
        filteredRawLeads = uniqueRawLeads.filter(lead => {
          const leadDate = getLeadDate(lead)
          if (!leadDate) return false
          if (start_date && leadDate < start_date) return false
          if (end_date && leadDate > end_date) return false
          return true
        })
      }

      // 4. Channel Filter in frontend (matches rule 5)
      if (channelFilter !== 'all_channels') {
        filteredRawLeads = filteredRawLeads.filter(lead => {
          const ch = getLeadChannel(lead)
          return ch === channelFilter
        })
      }

      // 5. Transform to adaptedLead (Rule 7)
      const adaptedLeads: LeadRecord[] = filteredRawLeads.map(lead => ({
        "Lead ID": lead.legacy_lead_id ?? lead.lead_number ?? lead.id,
        "İlk Temas Tarihi": lead.first_contact_date ?? lead.first_contact_at ?? lead.legacy_raw_data?.["İlk Temas Tarihi"],
        "Ad Soyad / Firma": lead.full_name ?? lead.company_name ?? lead.legacy_raw_data?.["Ad Soyad / Firma"],
        "Telefon Numarası": lead.phone ?? lead.legacy_raw_data?.["Telefon Numarası"],
        "İstenen Makine / Ürün": lead.requested_product ?? lead.legacy_raw_data?.["İstenen Makine / Ürün"],
        "İlk Mesaj / Arama Notu": lead.first_message_note ?? lead.message ?? lead.legacy_raw_data?.["İlk Mesaj / Arama Notu"],
        "Görüşme Özeti / Sonuç": lead.conversation_summary ?? lead.legacy_raw_data?.["Görüşme Özeti / Sonuç"],
        "Ek Notlar": lead.extra_notes ?? lead.legacy_raw_data?.["Ek Notlar"],
        "Sonraki Aksiyon": lead.next_action ?? lead.legacy_raw_data?.["Sonraki Aksiyon"],
        "Satış Uzmanı": lead.legacy_sales_specialist_name ?? lead.sales_representative_text ?? lead.legacy_raw_data?.["Satış Uzmanı"],
        rawLead: lead
      }))

      // 6. Run buildQualityReport (Rule 8)
      const report = buildQualityReport(adaptedLeads)
      setReportData(report)

      // Filter conversations by rawLeads (to respect scopeFilter and other queries)
      // Only count a WhatsApp conversation if the associated lead is queued (next_contact_at is not null or callback_status is pending) OR has logged calls.
      const rawLeadsMap = new Map(uniqueRawLeads ? uniqueRawLeads.map(l => [l.id, l]) : [])
      const activeConversations = rawConversations.filter(c => {
        const lead = rawLeadsMap.get(c.lead_id)
        if (!lead) return false
        
        // Exclude legacy leads from WhatsApp conversation virtual calls count,
        // as their completed calls are already tracked via legacyCalls
        if (lead.legacy_source_file !== null) {
          return false
        }

        const isWa = (
          lead.source_id === '474b7a22-c53f-43ba-a8bd-75ce0977a798' || 
          lead.source_id === '11111111-0000-0000-0000-000000000005' ||
          lead.status_id === '22222222-0000-0000-0000-000000000020' ||
          lead.lead_sources?.code === 'META_WA'
        ) && lead.legacy_source_file === null;

        if (isWa) {
          const hasCalls = lead.calls && lead.calls.length > 0;
          const isQueued = lead.next_contact_at !== null || lead.callback_status === 'pending';
          return isQueued || hasCalls;
        }
        return true
      })

      // Transform conversations to virtual calls
      const virtualCalls = activeConversations.map(c => ({
        id: `conv-${c.id}`,
        created_at: c.last_message_at || c.created_at,
        notes: 'WhatsApp Görüşmesi',
        profiles: {
          full_name: c.profiles?.full_name || 'Bilinmeyen Temsilci'
        },
        lead_id: c.lead_id,
        user_id: c.assigned_user_id,
        channel: 'whatsapp'
      }))

      // Apply channel filter to calls/conversations
      let filteredActiveCalls = activeCalls
      let filteredVirtualCalls = virtualCalls

      if (channelFilter === 'WhatsApp Mesajı') {
        filteredActiveCalls = []
      } else if (channelFilter === 'Telefon') {
        filteredVirtualCalls = []
      } else if (channelFilter !== 'all_channels') {
        // Any other channel has no phone calls or whatsapp conversations
        filteredActiveCalls = []
        filteredVirtualCalls = []
      }

      // Map legacy calls from adaptedLeads
      const legacyCalls = adaptedLeads
        .filter(l => l.rawLead.legacy_source_file !== null && l.rawLead.conversation_completed !== null)
        .map(l => ({
          id: `legacy-${l.rawLead.id}`,
          created_at: l.rawLead.conversation_date || l.rawLead.first_contact_date || l.rawLead.first_contact_at,
          notes: l.rawLead.conversation_summary,
          profiles: {
            full_name: 'Geçmiş Aktarım'
          },
          lead_id: l.rawLead.id
        }))

      const combinedCalls = [...filteredActiveCalls, ...filteredVirtualCalls, ...legacyCalls]
      setPeriodCalls(combinedCalls)
      setCallsCount(combinedCalls.length)

      // Set stats state so that we can render the UI without modifying existing UI bindings
      setStats({
        evaluated_total: report.evaluatedTotal,
        unrelated_count: report.unrelatedCount,
        accidental_click_count: report.accidentalClickCount,
        unreachable_count: report.unreachableCount,
        not_interested_count: report.notInterestedCount,
        callback_count: report.callbackCount,
        problematic_total: report.problematicTotal,
        potential_count: report.potentialTotal,
        pending_review_count: report.pendingReviewCount,
        forwarded_total: report.forwardedTotal,
        not_forwarded_total: report.notForwardedTotal,
        potential_forwarded_count: report.potentialForwardedCount,
        potential_not_forwarded_count: report.potentialNotForwardedCount
      })

      // 6. Run console verifications exactly as requested
      console.table({
        total: report.evaluatedTotal,
        potential: report.potentialTotal,
        qualityTotal: report.qualityRows
          .filter((row) => row.key !== "problematic_total")
          .reduce((sum, row) => sum + row.count, 0),
      })

      const classified = report.classifiedLeads
      console.log({
        unrelated: classified
          .filter(x => x.qualityCategory === "Alakasız / konu dışı lead")
          .map(x => x.lead["Lead ID"]),

        accidental: classified
          .filter(x => x.qualityCategory === "Yanlışlıkla tıklayan / elim çarptı")
          .map(x => x.lead["Lead ID"]),

        unreachable: classified
          .filter(x => x.qualityCategory === "Ulaşılamayan / açmayan / cevap vermeyen")
          .map(x => x.lead["Lead ID"]),

        notInterested: classified
          .filter(x => x.qualityCategory === "İlgilenmeyen / vazgeçen / başka yerden alan")
          .map(x => x.lead["Lead ID"]),

        potential: classified
          .filter(x => x.qualityCategory === "Potansiyel kayıt")
          .map(x => x.lead["Lead ID"]),

        pending: classified
          .filter(x => x.qualityCategory === "Değerlendirme bekliyor")
          .map(x => x.lead["Lead ID"]),
      })

      // 7. Update classification audit debug section (unrelated leads list)
      const unrelatedLeadsList = report.classifiedLeads
        .filter(x => x.qualityCategoryKey === 'unrelated')
        .map(x => ({
          lead_id: x.rawLead.id,
          legacy_lead_id: x.lead["Lead ID"],
          matched_field: x.matchedField,
          matched_phrase: x.matchedPhrase,
          first_message_note: x.lead["İlk Mesaj / Arama Notu"],
          conversation_summary: x.lead["Görüşme Özeti / Sonuç"],
          extra_notes: x.lead["Ek Notlar"],
          requested_product: x.lead["İstenen Makine / Ürün"],
          next_action: x.lead["Sonraki Aksiyon"],
          lead_quality_manually_overridden: x.rawLead.lead_quality_manually_overridden
        }))
      setDebugUnrelatedLeads(unrelatedLeadsList)

    } catch (err: any) {
      console.error('Error fetching statistics:', err)
      setErrorMsg(err.message || 'İstatistikler yüklenirken bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch leads for the drawer modal from frontend reportData (Rule 14)
  const fetchDrawerLeads = async () => {
    if (!activeMetric || !reportData) return
    setLoadingDrawer(true)
    try {
      if (activeMetric && activeMetric.startsWith('manager_')) {
        const todayStr = getLocalDateStringWithShift(new Date().toISOString()) || ''
        const mStart = resolvedDates.start_date || todayStr
        const mEnd = resolvedDates.end_date || todayStr

        const stats = computeWhatsAppStats(allRawConversations, allRawLeads, allRawMessages, mStart, mEnd)

        let filteredLeads: any[] = []
        if (activeMetric === 'manager_wp_convs') {
          filteredLeads = stats.resolvedLeadsList
        } else if (activeMetric === 'manager_unconverted_chats') {
          filteredLeads = stats.resolvedLeadsList.filter(x => !x.isConverted)
        } else if (activeMetric === 'manager_added_leads') {
          filteredLeads = stats.resolvedLeadsList.filter(x => x.isConverted)
        } else if (activeMetric === 'manager_contacted_leads') {
          filteredLeads = stats.resolvedLeadsList.filter(x => 
            x.isConverted && 
            (x.lead.conversation_completed === true || (x.lead.calls && x.lead.calls.length > 0) || !!x.lead.sales_representative_text || !!x.lead.legacy_sales_specialist_name)
          )
        } else if (activeMetric === 'manager_uncontacted_leads') {
          filteredLeads = stats.resolvedLeadsList.filter(x => 
            x.isConverted && 
            !(x.lead.conversation_completed === true || (x.lead.calls && x.lead.calls.length > 0) || !!x.lead.sales_representative_text || !!x.lead.legacy_sales_specialist_name)
          )
        }

        const mapped = filteredLeads.map(x => {
          const l = x.lead
          const classifiedItem = reportData?.classifiedLeads.find(item => item.rawLead.id === l.id)
          return {
            lead_id: l.id,
            legacy_lead_id: l.legacy_lead_id,
            lead_number: l.lead_number,
            full_name: l.full_name || l.company_name || (l.first_name ? `${l.first_name} ${l.last_name || ''}` : '') || 'Belirtilmemiş',
            phone: l.phone,
            province: l.province,
            resolved_channel: getLeadChannel(l),
            requested_product: l.requested_product,
            sales_representative_text: l.legacy_sales_specialist_name || l.sales_representative_text,
            first_contact_date: l.first_contact_date || l.first_contact_at,
            resolved_date: getLeadDate(l),
            lead_status_text: l.lead_status_text,
            first_message_note: l.first_message_note || l.message,
            conversation_summary: l.conversation_summary,
            extra_notes: l.extra_notes,
            next_action: l.next_action,
            final_quality_category: l.lead_quality_category || classifiedItem?.qualityCategoryKey || 'pending_review',
            classification_reason: l.lead_quality_reason || classifiedItem?.reason,
            matched_field: classifiedItem?.matchedField,
            matched_phrase: classifiedItem?.matchedPhrase,
            lead_quality_manually_overridden: l.quality_manually_overridden ?? l.lead_quality_manually_overridden,
            lead_quality_category: l.final_quality_category ?? l.lead_quality_category,
            lead_quality_reason: l.quality_reason ?? l.lead_quality_reason,
            quality_classification_method: l.quality_classification_method,
            quality_confidence: l.quality_confidence,
            quality_classified_at: l.quality_classified_at,
            quality_classification_version: l.quality_classification_version,
            quality_reason: l.quality_reason,
            quality_manually_overridden: l.quality_manually_overridden,
            assigned_sales: l.profiles
          }
        })
        setDrawerLeads(mapped)
        setLoadingDrawer(false)
        return
      }

      const classified = reportData.classifiedLeads
      let filtered: any[] = []
      
      if (activeMetric && activeMetric.startsWith('sales_by_rep_')) {
        const repName = activeMetric.replace('sales_by_rep_', '')
        filtered = classified.filter(x => x.isForwarded && ((x.lead["Satış Uzmanı"] || '').trim() || 'Belirtilmemiş') === repName)
      } else if (activeMetric && activeMetric.startsWith('calls_by_user_')) {
        const callerName = activeMetric.replace('calls_by_user_', '')
        const matchingCalls = periodCalls.filter(c => (c.profiles?.full_name || 'Bilinmeyen Temsilci') === callerName)
        const leadIds = new Set(matchingCalls.map(c => c.lead_id).filter(Boolean))
        filtered = classified.filter(x => leadIds.has(x.rawLead?.id))
      } else {
        switch (activeMetric) {
          case 'evaluated_total':
            filtered = classified
            break
          case 'total_calls':
            const leadIdsWithCalls = new Set(periodCalls.map(c => c.lead_id).filter(Boolean))
            filtered = classified.filter(x => leadIdsWithCalls.has(x.rawLead?.id))
            break
          case 'unrelated':
            filtered = classified.filter(x => x.qualityCategoryKey === 'unrelated')
            break
          case 'accidental_click':
            filtered = classified.filter(x => x.qualityCategoryKey === 'accidental_click')
            break
          case 'unreachable':
            filtered = classified.filter(x => x.qualityCategoryKey === 'unreachable')
            break
          case 'not_interested':
            filtered = classified.filter(x => x.qualityCategoryKey === 'not_interested')
            break
          case 'callback':
            filtered = classified.filter(x => x.qualityCategoryKey === 'callback')
            break
          case 'problematic_total':
            filtered = classified.filter(x => ['unrelated', 'accidental_click', 'unreachable', 'not_interested'].includes(x.qualityCategoryKey))
            break
          case 'potential':
            filtered = classified.filter(x => x.qualityCategoryKey === 'potential')
            break
          case 'pending_review':
            filtered = classified.filter(x => x.qualityCategoryKey === 'pending_review')
            break
          case 'forwarded':
            filtered = classified.filter(x => x.isForwarded)
            break
          case 'not_forwarded':
            filtered = classified.filter(x => !x.isForwarded)
            break
          case 'net_potential_forwarded':
            filtered = classified.filter(x => x.qualityCategoryKey === 'potential' && x.isForwarded)
            break
          case 'net_potential_not_forwarded':
            filtered = classified.filter(x => x.qualityCategoryKey === 'potential' && !x.isForwarded)
            break
          default:
            break
        }
      }

      const mapped = filtered.map(x => ({
        lead_id: x.rawLead.id,
        legacy_lead_id: x.lead["Lead ID"],
        lead_number: x.rawLead.lead_number,
        full_name: x.lead["Ad Soyad / Firma"],
        phone: x.lead["Telefon Numarası"],
        province: x.rawLead.province,
        resolved_channel: getLeadChannel(x.rawLead),
        requested_product: x.lead["İstenen Makine / Ürün"],
        sales_representative_text: x.lead["Satış Uzmanı"],
        first_contact_date: x.lead["İlk Temas Tarihi"],
        resolved_date: getLeadDate(x.rawLead),
        lead_status_text: x.rawLead.lead_status_text,
        first_message_note: x.lead["İlk Mesaj / Arama Notu"],
        conversation_summary: x.lead["Görüşme Özeti / Sonuç"],
        extra_notes: x.lead["Ek Notlar"],
        next_action: x.lead["Sonraki Aksiyon"],
        final_quality_category: x.qualityCategoryKey,
        classification_reason: x.reason,
        matched_field: x.matchedField,
        matched_phrase: x.matchedPhrase,
        lead_quality_manually_overridden: x.rawLead.quality_manually_overridden ?? x.rawLead.lead_quality_manually_overridden,
        lead_quality_category: x.rawLead.final_quality_category ?? x.rawLead.lead_quality_category,
        lead_quality_reason: x.rawLead.quality_reason ?? x.rawLead.lead_quality_reason,
        quality_classification_method: x.rawLead.quality_classification_method,
        quality_confidence: x.rawLead.quality_confidence,
        quality_classified_at: x.rawLead.quality_classified_at,
        quality_classification_version: x.rawLead.quality_classification_version,
        quality_reason: x.rawLead.quality_reason,
        quality_manually_overridden: x.rawLead.quality_manually_overridden,
        assigned_sales: x.rawLead.profiles
      }))

      setDrawerLeads(mapped)
    } catch (err) {
      console.error('Error loading drawer leads:', err)
      showToast('Kayıt detayları yüklenirken hata oluştu.', 'error')
    } finally {
      setLoadingDrawer(false)
    }
  }

  // Load stats and debug list whenever filters or refresh trigger changes
  useEffect(() => {
    fetchStatsData()
  }, [periodFilter, channelFilter, scopeFilter, customStartDate, customEndDate, refreshTrigger])

  // Load drawer leads whenever activeMetric or active filters change
  useEffect(() => {
    if (activeMetric) {
      fetchDrawerLeads()
    } else {
      setDrawerLeads([])
    }
  }, [activeMetric, reportData])

  // Fetch Audit Logs for a specific lead
  const fetchLeadAuditLogs = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('lead_quality_audit_logs')
        .select(`
          id,
          old_category,
          new_category,
          changed_at,
          reason,
          profiles:changed_by(full_name)
        `)
        .eq('lead_id', leadId)
        .order('changed_at', { ascending: false })

      if (error) throw error
      if (data) {
        setAuditLogs(prev => ({ ...prev, [leadId]: data }))
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err)
    }
  }

  // Handle expanding a lead detail view in the drawer
  const handleToggleExpandLead = (leadId: string) => {
    if (expandedLeadId === leadId) {
      setExpandedLeadId(null)
    } else {
      setExpandedLeadId(leadId)
      const lead = drawerLeads.find(l => l.lead_id === leadId)
      if (lead) {
        setOverrideCategory(lead.final_quality_category || 'pending_review')
        setOverrideReason('')
        fetchLeadAuditLogs(leadId)
      }
    }
  }

  // Manual override submit handler
  const handleSaveOverride = async (leadId: string) => {
    if (!myProfile) {
      showToast('Kullanıcı oturumu bulunamadı.', 'error')
      return
    }

    setSavingOverrideId(leadId)
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          lead_quality_category: overrideCategory,
          lead_quality_manually_overridden: true,
          lead_quality_overridden_by: myProfile.id,
          lead_quality_overridden_at: new Date().toISOString(),
          lead_quality_reason: overrideReason.trim() ? overrideReason.trim() : 'Yönetici manuel düzeltmesi',
          // Section 3 columns
          final_quality_category: overrideCategory,
          quality_classification_method: 'manual',
          quality_manually_overridden: true,
          quality_reason: overrideReason.trim() ? overrideReason.trim() : 'Yönetici manuel düzeltmesi',
          quality_classified_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (error) throw error
      
      showToast('Kategori veritabanında başarıyla güncellendi.')
      setRefreshTrigger(prev => prev + 1)
      fetchLeadAuditLogs(leadId)
    } catch (err: any) {
      console.error('Error saving override:', err)
      showToast(err.message || 'Kategori güncellenirken hata oluştu.', 'error')
    } finally {
      setSavingOverrideId(null)
    }
  }

  // CSV Exporter using local reportData (Rule 14 & 9 consistency)
  const handleExportCSV = () => {
    if (!reportData || reportData.classifiedLeads.length === 0) {
      showToast('Dışa aktarılacak veri bulunamadı.', 'error')
      return
    }

    setExporting(true)
    try {
      const headers = [
        'Lead ID', 'İlk Temas Tarihi', 'Ad Soyad / Firma', 'Telefon', 
        'Şehir', 'İletişim Kanalı', 'Talep Edilen Ürün', 'Satış Uzmanı', 
        'Görüşme Özeti', 'Lead Durumu', 'Sonraki Aksiyon', 'Kalite Kategorisi', 'Kategori Nedeni'
      ]

      const rows = reportData.classifiedLeads.map(item => [
        item.lead["Lead ID"] || '',
        item.lead["İlk Temas Tarihi"] || '',
        item.lead["Ad Soyad / Firma"] || '',
        item.lead["Telefon Numarası"] || '',
        item.rawLead.province || '',
        getLeadChannel(item.rawLead) || '',
        item.lead["İstenen Makine / Ürün"] || '',
        item.lead["Satış Uzmanı"] || '',
        item.lead["Görüşme Özeti / Sonuç"] || '',
        item.rawLead.lead_status_text || '',
        item.lead["Sonraki Aksiyon"] || '',
        item.qualityCategory || '',
        item.reason || ''
      ])

      const csvContent = '\ufeff' + [
        headers.join(';'),
        ...rows.map(row => row.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(';'))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `sunton_kalite_istatistikleri_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('CSV dosyası başarıyla indirildi.')
    } catch (err: any) {
      console.error('Error exporting CSV:', err)
      showToast('Dışa aktarım sırasında bir hata oluştu.', 'error')
    } finally {
      setExporting(false)
    }
  }

  // Filter drawer list client-side dynamically based on typing
  const filteredDrawerLeads = useMemo(() => {
    if (!drawerSearch.trim()) return drawerLeads
    const term = drawerSearch.toLowerCase().trim()
    return drawerLeads.filter(l => {
      const idMatch = (l.legacy_lead_id || l.lead_number || l.lead_id || '').toLowerCase().includes(term)
      const nameMatch = (l.full_name || '').toLowerCase().includes(term)
      const phoneMatch = (l.phone || '').includes(term)
      return idMatch || nameMatch || phoneMatch
    })
  }, [drawerLeads, drawerSearch])

  // Percent formatter Turkish format
  const formatPercent = (count: number, total: number) => {
    if (total === 0 || !total) return '—'
    const pct = (count / total) * 100
    return `%${pct.toFixed(2).replace('.', ',')}`
  }

  const handleStartReanalysis = async () => {
    setReanalyzing(true)
    setReanalysisProgress('Başlıyor...')
    showToast('Eski leadler analiz edilmeye başlandı.', 'success')

    try {
      let remaining = 1
      let totalProcessed = 0

      while (remaining > 0) {
        const response = await fetch('/api/classify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'classify-batch',
            batchSize: 20
          })
        })

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Batch analysis error');
        }

        const data = await response.json()
        if (data.processed === 0) {
          break
        }

        totalProcessed += data.succeeded
        remaining = data.remaining
        setReanalysisProgress(`İşlenen: ${totalProcessed}, Kalan: ${remaining}`)
      }

      showToast(`Analiz tamamlandı. Toplam ${totalProcessed} kayıt güncellendi.`, 'success')
      setRefreshTrigger(prev => prev + 1)
    } catch (err: any) {
      console.error('Batch analysis error:', err)
      showToast(err.message || 'Analiz sırasında hata oluştu.', 'error')
    } finally {
      setReanalyzing(false)
      setReanalysisProgress('')
    }
  }

  // Get active drawer title
  const getDrawerTitle = () => {
    if (activeMetric && activeMetric.startsWith('sales_by_rep_')) {
      const repName = activeMetric.replace('sales_by_rep_', '')
      return `${repName} - İletilen Lead Listesi`
    }
    if (activeMetric && activeMetric.startsWith('calls_by_user_')) {
      const callerName = activeMetric.replace('calls_by_user_', '')
      return `${callerName} - Yapılan Görüşmelerin Listesi`
    }
    switch (activeMetric) {
      case 'evaluated_total': return 'Toplam Gelen Müşteri Adayı Listesi'
      case 'total_calls': return 'Yapılan Tüm Görüşmelerin Listesi'
      case 'unrelated': return 'Alakasız / Konu Dışı Lead Listesi'
      case 'accidental_click': return 'Yanlışlıkla Tıklayan Listesi'
      case 'unreachable': return 'Ulaşılamayan / Cevap Vermeyen Listesi'
      case 'not_interested': return 'İlgilenmeyen / Vazgeçen Listesi'
      case 'callback': return 'Callback (Geri Arama / Bizi Arayacak) Listesi'
      case 'problematic_total': return 'Problemli / Niteliksiz Toplam Listesi'
      case 'potential': return 'Geriye Kalan Potansiyel Kayıt Listesi'
      case 'pending_review': return 'Değerlendirme Bekliyor Listesi'
      case 'forwarded': return 'Satış Uzmanına İletilen Leadler'
      case 'not_forwarded': return 'Satış Uzmanına İletilmeyen Leadler'
      case 'net_potential_forwarded': return 'Potansiyel olup satış uzmanına iletilen'
      case 'net_potential_not_forwarded': return 'Potansiyel olup henüz satış uzmanına iletilmeyen'
      case 'manager_wp_convs': return 'Gelen WhatsApp Sohbetleri Listesi'
      case 'manager_added_leads': return 'Sisteme Eklenen Lead Listesi'
      case 'manager_contacted_leads': return 'Aranan Lead Listesi'
      case 'manager_uncontacted_leads': return 'Aranmayan / Bekleyen Lead Listesi'
      case 'manager_unconverted_chats': return 'Unutulan / Eklenmeyen Sohbet Listesi'
      default: return 'Detay İnceleme'
    }
  }

  // Check if evaluation totals match
  const isMismatch = useMemo(() => {
    if (!stats) return false
    const sum = Number(stats.problematic_total) + Number(stats.potential_count) + Number(stats.pending_review_count) + Number(stats.callback_count || 0)
    return sum !== Number(stats.evaluated_total)
  }, [stats])

  return (
    <div className="space-y-6 select-none relative pb-10">
      
      {/* Toast feedback banner */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 font-semibold ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
            : 'bg-red-500/10 text-red-600 border-red-500/20'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Title & Filter Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-amber-500" />
            Çağrı Merkezi & Kalite İstatistikleri
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Eski Excel kayıtları üzerinden dinamik olarak hesaplanan kalite ve satış yönlendirme performans raporu.</p>
        </div>

        {/* Action Controls & Filters bar */}
        <div className="flex flex-wrap items-center gap-3 bg-card border border-border/85 p-2 rounded-xl shadow-sm">
          
          {/* Data Scope Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground font-semibold px-1 uppercase tracking-wider">Veri Kapsamı:</span>
            <span className="h-8 flex items-center text-xs bg-background border border-border/80 rounded-lg px-3 font-semibold text-foreground">
              Geçmiş Veriler (Excel)
            </span>
          </div>

           {/* Period Filter */}
          <div className="flex items-center gap-1 border-l border-border/60 pl-2">
            <span className="text-[10px] text-muted-foreground font-semibold px-1 uppercase tracking-wider">Dönem:</span>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="h-8 text-xs bg-background border border-border/80 rounded-lg px-2 focus:outline-none cursor-pointer font-semibold"
            >
              <option value="tum_eski">Tüm Eski Veriler</option>
              <option value="bugun">Bugün</option>
              <option value="dun">Dün</option>
              <option value="bu_ay">Bu Ay</option>
              <option value="gecen_ay">Geçen Ay</option>
              <option value="ocak_2026">Ocak 2026</option>
              <option value="subat_2026">Şubat 2026</option>
              <option value="mart_2026">Mart 2026</option>
              <option value="nisan_2026">Nisan 2026</option>
              <option value="mayis_2026">Mayıs 2026</option>
              <option value="haziran_2026">Haziran 2026</option>
              <option value="tek_gun">Tek Gün Seç...</option>
              <option value="ozel">Özel Tarih Aralığı...</option>
            </select>
          </div>

          {/* Custom Date picker input for single day */}
          {periodFilter === 'tek_gun' && (
            <div className="flex items-center gap-1.5 border-l border-border/60 pl-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 text-xs bg-background border border-border/80 rounded-lg px-2 focus:outline-none"
              />
            </div>
          )}

          {/* Custom Date Range picker inputs */}
          {periodFilter === 'ozel' && (
            <div className="flex items-center gap-1.5 border-l border-border/60 pl-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 text-xs bg-background border border-border/80 rounded-lg px-2 focus:outline-none"
              />
              <span className="text-muted-foreground text-xs">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 text-xs bg-background border border-border/80 rounded-lg px-2 focus:outline-none"
              />
            </div>
          )}

          {/* Communication Channel Filter */}
          <div className="flex items-center gap-1 border-l border-border/60 pl-2">
            <span className="text-[10px] text-muted-foreground font-semibold px-1 uppercase tracking-wider">Kanal:</span>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-8 text-xs bg-background border border-border/80 rounded-lg px-2 focus:outline-none cursor-pointer font-semibold"
            >
              <option value="all_channels">Tüm Kanallar</option>
              <option value="WhatsApp Mesajı">WhatsApp Mesajı</option>
              <option value="Telefon">Telefon</option>
              <option value="E-posta">E-posta</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
              <option value="Web Sitesi">Web Sitesi</option>
              <option value="Diğer">Diğer</option>
              <option value="Belirtilmemiş">Belirtilmemiş</option>
            </select>
          </div>

          {/* Refresh & CSV & Re-Analyze Buttons */}
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-2">
            <button
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              className="h-8 w-8 bg-muted hover:bg-accent border border-border/80 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              title="Verileri Yenile"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground hover:text-foreground ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="h-8 px-3 bg-primary text-primary-foreground font-semibold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-primary/95 transition-colors shadow-sm disabled:opacity-50"
              title="CSV Olarak Dışa Aktar"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? 'Aktarılıyor...' : 'CSV Dışa Aktar'}
            </button>
            <button
              onClick={handleStartReanalysis}
              disabled={reanalyzing || loading}
              className="h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
              title="Eski Leadleri Yeniden Analiz Et (Kural + AI)"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reanalyzing ? 'animate-spin' : ''}`} />
              {reanalyzing ? `Analiz ediliyor... (${reanalysisProgress})` : 'Eski Leadleri Yeniden Analiz Et'}
            </button>
          </div>
        </div>
      </div>

      {/* Migration / Schema Mismatch Warning Panel */}
      {migrationNeeded && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <h3 className="font-bold text-sm">Veritabanı Yapılandırması Eksik (strict-v2)</h3>
          </div>
          <p className="text-xs leading-relaxed max-w-2xl">
            Çağrı Merkezi & Kalite İstatistikleri raporunun çalışabilmesi için veritabanında yeni şema tanımları (SQL view, strict-v2 sınıflandırma tetikleyicisi ve RPC fonksiyonları) bulunmalıdır. 
            Lütfen Supabase panelinizdeki <strong>SQL Editor</strong> alanını açarak <strong>supabase/migrations/07_lead_quality_status.sql</strong> dosyasındaki kodları kopyalayıp çalıştırın.
          </p>
        </div>
      )}

      {/* Error State */}
      {errorMsg && !migrationNeeded && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-600 rounded-2xl p-4 flex items-center gap-3 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex border border-border bg-card p-1.5 rounded-xl shadow-xs gap-1.5 select-none w-fit mb-5">
        <button
          onClick={() => setActiveTab('quality')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'quality'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
          }`}
        >
          <FileText className="h-4 w-4" />
          Çağrı Merkezi & Kalite İstatistikleri
        </button>
        <button
          onClick={() => setActiveTab('whatsapp_messages')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'whatsapp_messages'
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          WhatsApp Mesaj İstatistikleri
        </button>
      </div>

      {/* Loading State Skeleton */}
      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-64 bg-card border border-border/80 rounded-2xl animate-pulse" />
          <div className="h-64 bg-card border border-border/80 rounded-2xl animate-pulse" />
        </div>
      ) : activeTab === 'quality' ? (
        stats && (
          <div className="space-y-6">
            
            {/* Manager-only Daily Tracking Panel (Rule 23) */}
            {(myProfile?.role === 'super_admin' || myProfile?.role === 'admin') && managerStats && (
              <div className="bg-card border-2 border-primary/20 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2 uppercase tracking-wide">
                      <ShieldAlert className="h-5 w-5 text-primary" />
                      Yönetici Anlık Takip Paneli (CRM Aktif Kontrol)
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      {periodFilter === 'tum_eski' 
                        ? "Bugünün anlık CRM veri takibi (Hafta sonları ve tatil günleri hariç aktiftir)" 
                        : `${getDrawerTitle().replace('Listesi', '')} dönemi için anlık CRM durum takibi`}
                    </p>
                  </div>
                  <span className="bg-primary/10 text-primary text-[9px] font-mono font-bold px-2 py-0.5 rounded">
                    Sadece Yönetici
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  
                  {/* WhatsApp Sohbetleri */}
                  <div 
                    onClick={() => setActiveMetric('manager_wp_convs')}
                    className="bg-muted/15 border border-border/80 rounded-xl p-4 flex flex-col justify-between min-h-[130px] hover:border-primary/50 transition-all cursor-pointer hover:shadow-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Gelen WP Sohbetleri</span>
                        <Phone className="h-4 w-4 text-primary opacity-80" />
                      </div>
                      <h3 className="text-xl font-black text-foreground">{managerStats.whatsappConvsCount}</h3>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-normal mt-1.5">Müşterilerden gelen tüm WhatsApp mesajları</p>
                  </div>

                  {/* Kaydedilen Lead */}
                  <div 
                    onClick={() => setActiveMetric('manager_added_leads')}
                    className="bg-muted/15 border border-border/80 rounded-xl p-4 flex flex-col justify-between min-h-[130px] hover:border-primary/50 transition-all cursor-pointer hover:shadow-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Sisteme Eklenenler</span>
                        <Users className="h-4 w-4 text-blue-500 opacity-80" />
                      </div>
                      <h3 className="text-xl font-black text-foreground">{managerStats.newLeadsCount}</h3>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-normal mt-1.5">Sohbetten lead kartına dönüştürülenler</p>
                  </div>

                  {/* Arananlar */}
                  <div 
                    onClick={() => setActiveMetric('manager_contacted_leads')}
                    className="bg-muted/15 border border-border/80 rounded-xl p-4 flex flex-col justify-between min-h-[130px] hover:border-primary/50 transition-all cursor-pointer hover:shadow-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Aranan Leadler</span>
                        <UserCheck className="h-4 w-4 text-emerald-500 opacity-80" />
                      </div>
                      <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400">{managerStats.contactedLeadsCount}</h3>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-normal mt-1.5">Sisteme eklenip araması tamamlananlar</p>
                  </div>

                  {/* Aranmayanlar */}
                  <div 
                    onClick={() => setActiveMetric('manager_uncontacted_leads')}
                    className="bg-muted/15 border border-border/80 rounded-xl p-4 flex flex-col justify-between min-h-[130px] hover:border-primary/50 transition-all cursor-pointer hover:shadow-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Aranmayan / Bekleyen</span>
                        <Clock className="h-4 w-4 text-amber-500 opacity-80" />
                      </div>
                      <h3 className="text-xl font-black text-amber-600 dark:text-amber-400">{managerStats.uncontactedLeadsCount}</h3>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-normal mt-1.5">Lead olarak eklenip henüz aranmayanlar</p>
                  </div>

                  {/* Unutulanlar / Eklenmeyenler */}
                  <div 
                    onClick={() => setActiveMetric('manager_unconverted_chats')}
                    className={`border rounded-xl p-4 flex flex-col justify-between min-h-[130px] transition-all cursor-pointer hover:shadow-xs ${
                      managerStats.unconvertedChatsCount > 0 
                        ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/50' 
                        : 'bg-muted/15 border-border/80 hover:border-primary/50'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Unutulan / Eklenmeyen</span>
                        <AlertTriangle className={`h-4 w-4 opacity-80 ${managerStats.unconvertedChatsCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                      </div>
                      <h3 className={`text-xl font-black ${managerStats.unconvertedChatsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                        {managerStats.unconvertedChatsCount}
                      </h3>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-normal mt-1.5">Yazan ama henüz lead kartı açılmayan sohbetler</p>
                  </div>

                </div>
              </div>
            )}

            {/* 4 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div 
                onClick={() => setActiveMetric('evaluated_total')}
                className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all hover:shadow-xs"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Toplam Gelen Lead</span>
                  <h3 className="text-2xl font-extrabold text-foreground">{stats.evaluated_total}</h3>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Users className="h-5 w-5" />
                </div>
              </div>

              <div 
                onClick={() => setActiveMetric('total_calls')}
                className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all hover:shadow-xs"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Yapılan Görüşmeler</span>
                  <h3 className="text-2xl font-extrabold text-foreground">{callsCount}</h3>
                </div>
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <Phone className="h-5 w-5" />
                </div>
              </div>

              <div 
                onClick={() => setActiveMetric('forwarded')}
                className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all hover:shadow-xs"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Satış Temsilcilerine İletilen</span>
                  <h3 className="text-2xl font-extrabold text-foreground">{stats.forwarded_total}</h3>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <UserCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Satışa İletilme Oranı</span>
                  <h3 className="text-2xl font-extrabold text-foreground">{formatPercent(Number(stats.forwarded_total), Number(stats.evaluated_total))}</h3>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Günlük Trend Grafiği (Day-by-Day Daily Stats) */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Günlük Performans Trendi
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Seçilen dönemdeki günlük lead giriş, arama ve satış yönlendirme sayıları.</p>
                </div>
              </div>
              <div className="h-72 w-full">
                {dailyStatsData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
                    Bu dönemde grafik için veri bulunmuyor.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyStatsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorForwarded" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="displayDate" stroke="#94A3B8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          fontSize: 11, 
                          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                        }} 
                      />
                      <Legend verticalAlign="top" height={36} iconSize={8} wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="leadsCount" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" name="Gelen Lead" />
                      <Area type="monotone" dataKey="callsCount" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" name="Yapılan Görüşme" />
                      <Area type="monotone" dataKey="forwardedCount" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorForwarded)" name="Satışa İletilen" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Mismatch warnings */}
            {isMismatch && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl p-4 flex items-start gap-3 text-xs leading-normal">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm mb-0.5">Veri Sınıflandırma Uyarısı</span>
                  Bazı kayıtlar birden fazla kategoriye girmiş veya sınıflandırılamamış olabilir. Kategori Toplamı ({Number(stats.problematic_total) + Number(stats.potential_count) + Number(stats.pending_review_count) + Number(stats.callback_count || 0)}) ile Değerlendirilen Toplam ({stats.evaluated_total}) uyuşmuyor.
                </div>
              </div>
            )}

            {/* Table 1: Lead Kalite Kırılımı */}
            <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border bg-amber-500/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  <h3 className="text-sm font-bold text-foreground">
                    Lead Kalite Kırılımı
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2.5 py-1 rounded-md">
                  Değerlendirilen Toplam: <strong>{stats.evaluated_total}</strong>
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider">
                      <th className="p-3">Lead Kalite Kırılım Kategorisi</th>
                      <th className="p-3 text-center w-32">Sayı</th>
                      <th className="p-3 text-center w-48">Excel Bazında %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr 
                      onClick={() => setActiveMetric('unrelated')}
                      className="hover:bg-muted/65 hover:translate-x-0.5 transition-all duration-150 cursor-pointer font-medium"
                    >
                      <td className="p-3 flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                        Alakasız / konu dışı lead
                      </td>
                      <td className="p-3 text-center font-bold text-foreground">{stats.unrelated_count}</td>
                      <td className="p-3 text-center font-semibold text-muted-foreground">{formatPercent(Number(stats.unrelated_count), Number(stats.evaluated_total))}</td>
                    </tr>
                    
                    <tr 
                      onClick={() => setActiveMetric('accidental_click')}
                      className="hover:bg-muted/65 hover:translate-x-0.5 transition-all duration-150 cursor-pointer font-medium"
                    >
                      <td className="p-3 flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                        Yanlışlıkla tıklayan / elim çarptı
                      </td>
                      <td className="p-3 text-center font-bold text-foreground">{stats.accidental_click_count}</td>
                      <td className="p-3 text-center font-semibold text-muted-foreground">{formatPercent(Number(stats.accidental_click_count), Number(stats.evaluated_total))}</td>
                    </tr>

                    <tr 
                      onClick={() => setActiveMetric('unreachable')}
                      className="hover:bg-muted/65 hover:translate-x-0.5 transition-all duration-150 cursor-pointer font-medium"
                    >
                      <td className="p-3 flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                        Ulaşılamayan / açmayan / cevap vermeyen
                      </td>
                      <td className="p-3 text-center font-bold text-foreground">{stats.unreachable_count}</td>
                      <td className="p-3 text-center font-semibold text-muted-foreground">{formatPercent(Number(stats.unreachable_count), Number(stats.evaluated_total))}</td>
                    </tr>

                    <tr 
                      onClick={() => setActiveMetric('not_interested')}
                      className="hover:bg-muted/65 hover:translate-x-0.5 transition-all duration-150 cursor-pointer font-medium"
                    >
                      <td className="p-3 flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full bg-pink-500 shrink-0" />
                        İlgilenmeyen / vazgeçen / başka yerden alan
                      </td>
                      <td className="p-3 text-center font-bold text-foreground">{stats.not_interested_count}</td>
                      <td className="p-3 text-center font-semibold text-muted-foreground">{formatPercent(Number(stats.not_interested_count), Number(stats.evaluated_total))}</td>
                    </tr>

                    <tr 
                      onClick={() => setActiveMetric('callback')}
                      className="hover:bg-muted/65 hover:translate-x-0.5 transition-all duration-150 cursor-pointer font-medium"
                    >
                      <td className="p-3 flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                        Geri aranacak / bizi arayacak (Callback)
                      </td>
                      <td className="p-3 text-center font-bold text-foreground">{stats.callback_count || 0}</td>
                      <td className="p-3 text-center font-semibold text-muted-foreground">{formatPercent(Number(stats.callback_count || 0), Number(stats.evaluated_total))}</td>
                    </tr>
                    
                    {/* Sum of problematic */}
                    <tr 
                      onClick={() => setActiveMetric('problematic_total')}
                      className="bg-amber-500/[0.02] hover:bg-amber-500/[0.04] transition-colors font-extrabold text-foreground border-t border-border/80 cursor-pointer"
                    >
                      <td className="p-3 pl-6 text-amber-700 dark:text-amber-400 font-bold">Problemli / niteliksiz toplam</td>
                      <td className="p-3 text-center font-black text-amber-600 dark:text-amber-500">{stats.problematic_total}</td>
                      <td className="p-3 text-center text-amber-600 dark:text-amber-500 font-bold">{formatPercent(Number(stats.problematic_total), Number(stats.evaluated_total))}</td>
                    </tr>

                    {/* Potential remaining */}
                    <tr 
                      onClick={() => setActiveMetric('potential')}
                      className="bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] transition-colors font-extrabold text-foreground border-t border-border/80 cursor-pointer"
                    >
                      <td className="p-3 pl-6 text-emerald-700 dark:text-emerald-400 font-bold">Geriye kalan potansiyel kayıt</td>
                      <td className="p-3 text-center font-black text-emerald-600 dark:text-emerald-500">{stats.potential_count}</td>
                      <td className="p-3 text-center text-emerald-600 dark:text-emerald-500 font-bold">{formatPercent(Number(stats.potential_count), Number(stats.evaluated_total))}</td>
                    </tr>

                    {/* Pending review */}
                    <tr 
                      onClick={() => setActiveMetric('pending_review')}
                      className="bg-indigo-500/[0.02] hover:bg-indigo-500/[0.04] transition-colors font-extrabold text-foreground border-t border-border/80 cursor-pointer"
                    >
                      <td className="p-3 pl-6 text-indigo-700 dark:text-indigo-400 font-bold">Değerlendirme bekliyor</td>
                      <td className="p-3 text-center font-black text-indigo-600 dark:text-indigo-500">{stats.pending_review_count}</td>
                      <td className="p-3 text-center text-indigo-600 dark:text-indigo-500 font-bold">{formatPercent(Number(stats.pending_review_count), Number(stats.evaluated_total))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Satışa İletim Durumu */}
            <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border bg-emerald-500/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-sm font-bold text-foreground">
                    Satışa Yönlendirme ve İletim Durumu
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2.5 py-1 rounded-md">
                  Potansiyel Kayıt: <strong>{stats.potential_count}</strong>
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider">
                      <th className="p-3">Satışa İletim Durumu</th>
                      <th className="p-3 text-center w-32">Sayı</th>
                      <th className="p-3 text-center w-48">Excel Bazında %</th>
                      <th className="p-3 text-center w-48">Potansiyel Kayıt Bazında %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr 
                      onClick={() => setActiveMetric('forwarded')}
                      className="hover:bg-muted/65 hover:translate-x-0.5 transition-all duration-150 cursor-pointer font-medium"
                    >
                      <td className="p-3 flex items-center gap-2.5 text-foreground font-semibold">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        Toplam satış uzmanına iletilen
                      </td>
                      <td className="p-3 text-center font-bold text-foreground">{stats.forwarded_total}</td>
                      <td className="p-3 text-center font-semibold text-muted-foreground">{formatPercent(Number(stats.forwarded_total), Number(stats.evaluated_total))}</td>
                      <td className="p-3 text-center font-semibold text-muted-foreground">—</td>
                    </tr>

                    <tr 
                      onClick={() => setActiveMetric('not_forwarded')}
                      className="hover:bg-muted/65 hover:translate-x-0.5 transition-all duration-150 cursor-pointer font-medium"
                    >
                      <td className="p-3 flex items-center gap-2.5 text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                        Satış uzmanına iletilmeyen
                      </td>
                      <td className="p-3 text-center font-bold text-foreground">{stats.not_forwarded_total}</td>
                      <td className="p-3 text-center font-semibold text-muted-foreground">{formatPercent(Number(stats.not_forwarded_total), Number(stats.evaluated_total))}</td>
                      <td className="p-3 text-center font-semibold text-muted-foreground">—</td>
                    </tr>

                    {/* Potential forwarded */}
                    <tr 
                      onClick={() => setActiveMetric('net_potential_forwarded')}
                      className="bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06] transition-colors font-extrabold text-foreground border-t border-border/80 cursor-pointer"
                    >
                      <td className="p-3 pl-6 text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Potansiyel olup satış uzmanına iletilen
                      </td>
                      <td className="p-3 text-center font-black text-emerald-600 dark:text-emerald-500">{stats.potential_forwarded_count}</td>
                      <td className="p-3 text-center text-emerald-600 dark:text-emerald-500 font-bold">{formatPercent(Number(stats.potential_forwarded_count), Number(stats.evaluated_total))}</td>
                      <td className="p-3 text-center text-emerald-600 dark:text-emerald-500 font-black">{formatPercent(Number(stats.potential_forwarded_count), Number(stats.potential_count))}</td>
                    </tr>

                    {/* Potential not forwarded */}
                    <tr 
                      onClick={() => setActiveMetric('net_potential_not_forwarded')} // opens potential not forwarded drawer
                      className="bg-slate-500/[0.02] hover:bg-slate-500/[0.05] transition-colors font-extrabold text-foreground border-t border-border/80 cursor-pointer"
                    >
                      <td className="p-3 pl-6 text-slate-700 dark:text-slate-400 font-bold flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Potansiyel olup henüz satış uzmanına iletilmeyen
                      </td>
                      <td className="p-3 text-center font-black text-slate-600 dark:text-slate-500">{stats.potential_not_forwarded_count}</td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-500 font-bold">{formatPercent(Number(stats.potential_not_forwarded_count), Number(stats.evaluated_total))}</td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-500 font-black">{formatPercent(Number(stats.potential_not_forwarded_count), Number(stats.potential_count))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 3: Satış Temsilcisi İletilen Lead İstatistikleri */}
            <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border bg-indigo-500/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-foreground">
                    Satış Temsilcisi İletilen Lead Performansı
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2.5 py-1 rounded-md">
                  Aktif Satış Temsilcisi Sayısı: <strong>{salesRepStats.length}</strong>
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider">
                      <th className="p-3">Satış Temsilcisi</th>
                      <th className="p-3 text-center w-48">İletilen Lead Sayısı (Adet)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {salesRepStats.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="p-6 text-center text-muted-foreground italic">
                          Filtrelenen dönemde iletilen lead kaydı bulunmamaktadır.
                        </td>
                      </tr>
                    ) : (
                      salesRepStats.map(rep => (
                        <tr 
                          key={rep.name}
                          onClick={() => setActiveMetric('sales_by_rep_' + rep.name)}
                          className="hover:bg-muted/65 hover:translate-x-0.5 transition-all duration-150 cursor-pointer font-medium"
                        >
                          <td className="p-3 flex items-center gap-2.5">
                            <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                            {rep.name}
                          </td>
                          <td className="p-3 text-center font-bold text-foreground">{rep.count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 4: Temsilci Görüşme Performansı (Yapılan Aramalar) */}
            <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border bg-indigo-500/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-foreground">
                    Temsilci Görüşme Performansı (Yapılan Aramalar)
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2.5 py-1 rounded-md">
                  Görüşme Yapan Temsilci Sayısı: <strong>{callerStats.length}</strong>
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider">
                      <th className="p-3">Temsilci</th>
                      <th className="p-3 text-center w-48">Görüşme Sayısı (Adet)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {callerStats.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="p-6 text-center text-muted-foreground italic">
                          Filtrelenen dönemde yapılan görüşme kaydı bulunmamaktadır.
                        </td>
                      </tr>
                    ) : (
                      callerStats.map(caller => (
                        <tr 
                          key={caller.name}
                          onClick={() => setActiveMetric('calls_by_user_' + caller.name)}
                          className="hover:bg-muted/65 hover:translate-x-0.5 transition-all duration-150 cursor-pointer font-medium"
                        >
                          <td className="p-3 flex items-center gap-2.5">
                            <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                            {caller.name}
                          </td>
                          <td className="p-3 text-center font-bold text-foreground">{caller.count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Classification Audit Debug Section (Sınıflandırma Denetimi) */}
            <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border bg-slate-500/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-slate-500" />
                  <h3 className="text-sm font-bold text-foreground">
                    Sınıflandırma Denetimi (Alakasız Sınıfına Giren Son Kayıtlar)
                  </h3>
                </div>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  Müşteri kaydındaki gerçek eşleşmelerin denetim günlüğü
                </span>
              </div>
              
              <div className="overflow-x-auto max-h-96">
                {loadingDebug ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">Denetim verileri yükleniyor...</div>
                ) : debugUnrelatedLeads.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground border-t border-dashed">
                    Filtrelere uygun alakasız lead bulunamadı.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-muted text-muted-foreground font-extrabold text-[10px] uppercase tracking-wider">
                        <th className="p-3">Lead ID</th>
                        <th className="p-3">Kategori</th>
                        <th className="p-3">Eşleşen Excel Hücresi / Alanı</th>
                        <th className="p-3">Eşleşen Anahtar Kelime</th>
                        <th className="p-3">Ham Alan Değeri</th>
                        <th className="p-3">Yöntem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {debugUnrelatedLeads.map(lead => (
                        <tr key={lead.lead_id} className="hover:bg-muted/40 font-medium">
                          <td className="p-3 font-mono text-primary font-bold">
                            {lead.legacy_lead_id || `ID: ${lead.lead_number || lead.lead_id.slice(0, 8)}`}
                          </td>
                          <td className="p-3">
                            <span className="bg-red-500/10 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              Alakasız
                            </span>
                          </td>
                          <td className="p-3 font-bold text-foreground">
                            {lead.matched_field || '—'}
                          </td>
                          <td className="p-3 text-red-500 font-mono font-bold">
                            {lead.matched_phrase || '—'}
                          </td>
                          <td className="p-3 max-w-xs truncate text-muted-foreground" title={
                            lead.matched_field === 'İlk Mesaj / Arama Notu' ? lead.first_message_note :
                            lead.matched_field === 'Görüşme Özeti / Sonuç' ? lead.conversation_summary :
                            lead.matched_field === 'Ek Notlar' ? lead.extra_notes :
                            lead.matched_field === 'İstenen Makine / Ürün' ? lead.requested_product :
                            lead.matched_field === 'Sonraki Aksiyon' ? lead.next_action :
                            lead.matched_field === 'Lead Durumu' ? lead.lead_status_text :
                            lead.matched_field === 'Satış Durumu' ? lead.sale_status :
                            ''
                          }>
                            {
                              lead.matched_field === 'İlk Mesaj / Arama Notu' ? (lead.first_message_note || '—') :
                              lead.matched_field === 'Görüşme Özeti / Sonuç' ? (lead.conversation_summary || '—') :
                              lead.matched_field === 'Ek Notlar' ? (lead.extra_notes || '—') :
                              lead.matched_field === 'İstenen Makine / Ürün' ? (lead.requested_product || '—') :
                              lead.matched_field === 'Sonraki Aksiyon' ? (lead.next_action || '—') :
                              lead.matched_field === 'Lead Durumu' ? (lead.lead_status_text || '—') :
                              lead.matched_field === 'Satış Durumu' ? (lead.sale_status || '—') :
                              '—'
                            }
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              lead.lead_quality_manually_overridden ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {lead.lead_quality_manually_overridden ? 'Manuel' : 'Otomatik'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        )
      ) : (
        /* Render WhatsApp Message Statistics Dashboard */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Card Grid (matching the 5 metrics visually) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Card 1: Gelen WP Sohbetleri */}
            <div 
              onClick={() => setActiveMetric('manager_wp_convs')}
              className="bg-card border border-border/80 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-xs hover:border-primary/50 cursor-pointer transition-all hover:shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Gelen WP Sohbetleri</span>
                  <Phone className="h-5 w-5 text-primary opacity-80" />
                </div>
                <h3 className="text-2xl font-black text-foreground">{whatsappMessageStats.totalChats}</h3>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal mt-2">Gelen tüm WhatsApp sohbetleri</p>
            </div>

            {/* Card 2: Sisteme Eklenenler */}
            <div 
              onClick={() => setActiveMetric('manager_added_leads')}
              className="bg-card border border-border/80 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-xs hover:border-primary/50 cursor-pointer transition-all hover:shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Sisteme Eklenenler</span>
                  <Users className="h-5 w-5 text-blue-500 opacity-80" />
                </div>
                <h3 className="text-2xl font-black text-foreground">{whatsappMessageStats.newLeadsCount}</h3>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal mt-2">Sohbetten lead kartına dönüştürülenler</p>
            </div>

            {/* Card 3: Aranan Leadler */}
            <div 
              onClick={() => setActiveMetric('manager_contacted_leads')}
              className="bg-card border border-border/80 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-xs hover:border-primary/50 cursor-pointer transition-all hover:shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Aranan Leadler</span>
                  <UserCheck className="h-5 w-5 text-emerald-500 opacity-80" />
                </div>
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{whatsappMessageStats.contactedLeadsCount}</h3>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal mt-2">Sisteme eklenip araması tamamlananlar</p>
            </div>

            {/* Card 4: Aranmayan / Bekleyen */}
            <div 
              onClick={() => setActiveMetric('manager_uncontacted_leads')}
              className="bg-card border border-border/80 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-xs hover:border-primary/50 cursor-pointer transition-all hover:shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Aranmayan / Bekleyen</span>
                  <Clock className="h-5 w-5 text-amber-500 opacity-80" />
                </div>
                <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">{whatsappMessageStats.uncontactedLeadsCount}</h3>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal mt-2">Lead olarak eklenip henüz aranmayanlar</p>
            </div>

            {/* Card 5: Unutulan / Eklenmeyen */}
            <div 
              onClick={() => setActiveMetric('manager_unconverted_chats')}
              className="bg-card border border-red-500/20 bg-red-500/[0.02] rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-xs hover:border-red-500/50 cursor-pointer transition-all hover:shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Unutulan / Eklenmeyen</span>
                  <AlertTriangle className="h-5 w-5 text-red-500 opacity-85" />
                </div>
                <h3 className="text-2xl font-black text-red-600 dark:text-red-400">{whatsappMessageStats.unconvertedChatsCount}</h3>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal mt-2">Yazan ama henüz lead kartı açılmayanlar</p>
            </div>
          </div>

          {/* Area Chart: Daily Conversion Trend */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Günlük Sohbet & CRM Dönüşüm Grafiği</h3>
              <p className="text-[10px] text-muted-foreground">Günlere göre gelen mesajlar, lead kartına dönüştürülenler ve unutulan sohbetlerin performansı.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={whatsappMessageStats.dailyTrend}>
                  <defs>
                    <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAdded" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorForgotten" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={9} />
                  <YAxis stroke="#94A3B8" fontSize={9} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="incomingChats" stroke="#3B82F6" fillOpacity={1} fill="url(#colorChats)" name="Gelen WP Sohbetleri" />
                  <Area type="monotone" dataKey="addedToCrm" stroke="#10B981" fillOpacity={1} fill="url(#colorAdded)" name="Sisteme Eklenenler" />
                  <Area type="monotone" dataKey="unconvertedChats" stroke="#EF4444" fillOpacity={1} fill="url(#colorForgotten)" name="Unutulan / Eklenmeyen" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Responsive details columns layout */}
          <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch">
            {/* Left: Representative performance */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4 w-full lg:w-[42%] lg:min-w-[420px]">
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Temsilci Dönüşüm Performansı</h3>
                <p className="text-[10px] text-muted-foreground">Temsilcilerin kendilerine atanan sohbetleri lead kartına dönüştürme performansı.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                      <th className="pb-2.5 font-bold">Temsilci</th>
                      <th className="pb-2.5 font-bold text-center">WP Sohbet</th>
                      <th className="pb-2.5 font-bold text-center">Eklenen</th>
                      <th className="pb-2.5 font-bold text-center">Aranan</th>
                      <th className="pb-2.5 font-bold text-right">Başarı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whatsappMessageStats.agentPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-muted-foreground">Kayıt bulunamadı.</td>
                      </tr>
                    ) : (
                      whatsappMessageStats.agentPerformance.map((agent) => (
                        <tr key={agent.name} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 font-semibold text-foreground">{agent.name}</td>
                          <td className="py-2.5 text-center text-muted-foreground font-mono">{agent.totalChats}</td>
                          <td className="py-2.5 text-center text-blue-600 font-mono font-semibold">{agent.addedToCrm}</td>
                          <td className="py-2.5 text-center text-emerald-600 font-mono font-semibold">{agent.calledLeads}</td>
                          <td className="py-2.5 font-bold text-right text-primary">{agent.conversionRate}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Forgotten chats list */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4 w-full lg:flex-1 lg:min-w-[500px]">
              <div>
                <h3 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Unutulan / Eklenmeyen Sohbet Detayları (Top 10)</h3>
                <p className="text-[10px] text-muted-foreground">Müşteriden mesaj gelmiş olmasına rağmen henüz CRM'e kaydedilmemiş anlık sohbetler.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                      <th className="pb-2.5 font-bold">Müşteri / Numara</th>
                      <th className="pb-2.5 font-bold">Son Mesaj Tarihi</th>
                      <th className="pb-2.5 font-bold">Son Mesaj Detayı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whatsappMessageStats.unconvertedChatsList.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-6 text-emerald-600 dark:text-emerald-400 font-semibold">Tebrikler! Unutulan veya sisteme eklenmeyen sohbet bulunmuyor.</td>
                      </tr>
                    ) : (
                      whatsappMessageStats.unconvertedChatsList.map((chat) => (
                        <tr key={chat.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 font-semibold text-foreground">
                            <div className="space-y-0.5">
                              <div>{chat.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono font-normal">{chat.phone}</div>
                            </div>
                          </td>
                          <td className="py-2.5 text-muted-foreground font-mono text-[10px]">
                            {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="py-2.5 text-muted-foreground truncate max-w-xs md:max-w-md xl:max-w-xl" title={chat.preview}>
                            {chat.preview}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          RIGHT SLIDING DRAWER: Detailed Leads Review
          ---------------------------------------------------- */}
      {activeMetric && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300">
          {/* Backdrop click close */}
          <div className="absolute inset-0 cursor-default" onClick={() => { setActiveMetric(null); setDrawerSearch(''); setExpandedLeadId(null) }} />
          
          {/* Drawer container */}
          <div className="relative w-full max-w-2xl h-screen bg-card border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/40">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                  <FileText className="h-5 w-5 text-primary" />
                  {getDrawerTitle()}
                </h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">Toplam <strong>{filteredDrawerLeads.length}</strong> kayıt filtrelendi.</p>
              </div>
              <button 
                onClick={() => { setActiveMetric(null); setDrawerSearch(''); setExpandedLeadId(null) }}
                className="h-8 w-8 hover:bg-muted border border-border/60 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search filter input inside drawer */}
            <div className="px-5 py-3 border-b border-border flex items-center gap-2 bg-muted/10">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="İsim, telefon veya ID numarası ile liste içinde ara..."
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                className="w-full bg-transparent text-xs focus:outline-none border-none py-1.5"
              />
              {drawerSearch && (
                <button onClick={() => setDrawerSearch('')} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Leads List Scroll Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingDrawer ? (
                <div className="h-48 flex flex-col items-center justify-center text-xs text-muted-foreground space-y-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  <span>Kayıtlar veritabanından sorgulanıyor...</span>
                </div>
              ) : filteredDrawerLeads.length === 0 ? (
                <div className="h-48 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground">
                  <Users className="h-8 w-8 mb-2 stroke-[1.5]" />
                  <span className="text-xs">Eşleşen lead kaydı bulunamadı.</span>
                </div>
              ) : (
                filteredDrawerLeads.map(lead => {
                  const isExpanded = expandedLeadId === lead.lead_id
                  
                  return (
                    <div 
                      key={lead.lead_id} 
                      className={`border rounded-xl shadow-xs overflow-hidden transition-all duration-200 ${
                        isExpanded ? 'border-primary/40 bg-muted/15' : 'border-border/80 bg-card hover:bg-muted/10'
                      }`}
                    >
                      {/* Collapsed Card Summary */}
                      <div 
                        onClick={() => handleToggleExpandLead(lead.lead_id)}
                        className="p-4 flex items-center justify-between cursor-pointer"
                      >
                        <div className="space-y-1 w-[85%]">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {lead.legacy_lead_id || `ID: ${lead.lead_number || lead.lead_id.slice(0,8)}`}
                            </span>
                            <span className="text-xs font-bold text-foreground truncate max-w-[200px]" title={lead.full_name}>
                              {lead.full_name}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                            {lead.phone && (
                              <span className="flex items-center gap-1 font-mono whitespace-nowrap">
                                <Phone className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                {lead.phone}
                              </span>
                            )}
                            {lead.province && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                {lead.province}
                              </span>
                            )}
                            <span className="text-muted-foreground/65">
                              {lead.resolved_channel}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            lead.final_quality_category === 'potential' ? 'bg-emerald-500/10 text-emerald-600' :
                            lead.final_quality_category === 'unrelated' ? 'bg-red-500/10 text-red-600' :
                            lead.final_quality_category === 'accidental_click' ? 'bg-amber-500/10 text-amber-600' :
                            lead.final_quality_category === 'unreachable' ? 'bg-blue-500/10 text-blue-600' :
                            lead.final_quality_category === 'not_interested' ? 'bg-pink-500/10 text-pink-600' :
                            lead.final_quality_category === 'callback' ? 'bg-teal-500/10 text-teal-600' :
                            'bg-indigo-500/10 text-indigo-600'
                          }`}>
                            {lead.final_quality_category === 'potential' ? 'Potansiyel' :
                             lead.final_quality_category === 'unrelated' ? 'Alakasız' :
                             lead.final_quality_category === 'accidental_click' ? 'Yanlışlıkla' :
                             lead.final_quality_category === 'unreachable' ? 'Ulaşılamadı' :
                             lead.final_quality_category === 'not_interested' ? 'İlgilenmeyen' :
                             lead.final_quality_category === 'callback' ? 'Callback' :
                             'Değerlendirme Bekliyor'}
                          </span>
                          
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        </div>
                      </div>

                      {/* Expanded Card Details */}
                      {isExpanded && (
                        <div className="border-t border-border/60 bg-muted/[0.03] p-4 space-y-4 text-xs">
                          
                          {/* Grid Information */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 border-b border-border/40 pb-4">
                            <div>
                              <span className="text-muted-foreground font-semibold uppercase text-[9px] block">Talep Edilen Ürün</span>
                              <span className="text-foreground font-medium">{lead.requested_product || 'Belirtilmemiş'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground font-semibold uppercase text-[9px] block">Satış Uzmanı Ataması</span>
                              <span className="text-foreground font-medium">
                                {lead.assigned_sales?.full_name || lead.sales_representative_text || 'Atanmamış'}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground font-semibold uppercase text-[9px] block">İlk Temas Tarihi</span>
                              <span className="text-foreground font-medium">
                                {lead.resolved_date ? new Date(lead.resolved_date).toLocaleDateString('tr-TR') : '—'} 
                                {lead.conversation_time ? ` ${lead.conversation_time}` : ''}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground font-semibold uppercase text-[9px] block">Lead Durumu</span>
                              <span className="text-foreground font-medium">{lead.lead_status_text || 'Belirtilmemiş'}</span>
                            </div>
                          </div>

                          {/* Notes and Summaries */}
                          <div className="space-y-3.5 border-b border-border/40 pb-4">
                            {lead.first_message_note && (
                              <div>
                                <span className="text-muted-foreground font-semibold uppercase text-[9px] block mb-0.5">İlk Mesaj / Arama Notu</span>
                                <p className="text-foreground leading-relaxed bg-card p-2.5 rounded-lg border border-border/50">{lead.first_message_note}</p>
                              </div>
                            )}
                            
                            {lead.conversation_summary && (
                              <div>
                                <span className="text-muted-foreground font-semibold uppercase text-[9px] block mb-0.5">Görüşme Özeti / Sonuç</span>
                                <p className="text-foreground leading-relaxed bg-card p-2.5 rounded-lg border border-border/50">{lead.conversation_summary}</p>
                              </div>
                            )}

                            {lead.extra_notes && (
                              <div>
                                <span className="text-muted-foreground font-semibold uppercase text-[9px] block mb-0.5">Ek Notlar</span>
                                <p className="text-foreground leading-relaxed bg-card p-2.5 rounded-lg border border-border/50">{lead.extra_notes}</p>
                              </div>
                            )}

                            {lead.next_action && (
                              <div>
                                <span className="text-muted-foreground font-semibold uppercase text-[9px] block mb-0.5">Sonraki Aksiyon</span>
                                <p className="text-foreground leading-relaxed bg-card p-2.5 rounded-lg border border-border/50">{lead.next_action}</p>
                              </div>
                            )}
                          </div>

                          {/* Section 7 - Rich Classification Audit Panel */}
                          <div className="bg-muted/40 p-4 rounded-xl border border-border/60 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-primary" />
                                Sınıflandırma Denetim Bilgileri
                              </span>
                              {lead.quality_classification_method === 'ai' && Number(lead.quality_confidence) < 0.70 && (
                                <span className="bg-red-500/10 text-red-600 text-[9px] font-extrabold px-2 py-0.5 rounded border border-red-500/15">
                                  ⚠️ Yönetici Kontrolü Gerekli (Düşük Güven)
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                              <div>
                                <span className="text-muted-foreground">Yöntem:</span>{' '}
                                <strong className="text-foreground">
                                  {lead.quality_classification_method === 'rule' ? 'Kural Tabanlı' :
                                   lead.quality_classification_method === 'ai' ? 'Yapay Zeka (AI)' :
                                   lead.quality_classification_method === 'manual' ? 'Manuel Düzeltme' : 'Belirtilmemiş'}
                                </strong>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Güven Puanı:</span>{' '}
                                <strong className="text-foreground">
                                  {lead.quality_confidence !== undefined && lead.quality_confidence !== null 
                                    ? `%${Math.round(Number(lead.quality_confidence) * 100)}` 
                                    : '—'}
                                </strong>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Analiz Tarihi:</span>{' '}
                                <span className="text-foreground font-medium">
                                  {lead.quality_classified_at 
                                    ? new Date(lead.quality_classified_at).toLocaleString('tr-TR') 
                                    : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Sürüm:</span>{' '}
                                <span className="text-foreground font-mono font-bold">
                                  {lead.quality_classification_version || '—'}
                                </span>
                              </div>
                            </div>

                            <div className="text-[11px] pt-1">
                              <span className="text-muted-foreground block mb-0.5">Sınıflandırma Gerekçesi:</span>
                              <p className="text-foreground font-medium bg-card p-2.5 rounded-lg border border-border/50 italic leading-relaxed">
                                {lead.quality_reason || 'Nedeni belirtilmemiş.'}
                              </p>
                            </div>

                            <div className="text-[10px] text-muted-foreground">
                              <span>Analizde Kullanılan Alanlar:</span>{' '}
                              <span className="text-foreground/80 font-medium">
                                {lead.quality_classification_method === 'rule' 
                                  ? 'Metin Kelime Eşleşmeleri' 
                                  : 'Ürün, Mesaj Notu, Görüşme Özeti, Ek Notlar, Sonraki Aksiyon, Durum, Teklif, Satış Durumu, Satış Temsilcisi'}
                              </span>
                            </div>
                          </div>

                          {/* Manual Override Action Section */}
                          <div className="bg-card p-4 rounded-xl border border-border space-y-3 shadow-xs">
                            <h4 className="font-bold text-foreground text-xs uppercase tracking-wider">
                              Lead Kalite Kategorisini Manuel Değiştir
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Yeni Kategori</label>
                                <select
                                  value={overrideCategory}
                                  onChange={(e) => setOverrideCategory(e.target.value)}
                                  className="w-full h-8 text-xs bg-background border border-border rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                                >
                                  <option value="unrelated">Alakasız / konu dışı lead</option>
                                  <option value="accidental_click">Yanlışlıkla tıklayan / elim çarptı</option>
                                  <option value="unreachable">Ulaşılamayan / cevap vermeyen</option>
                                  <option value="not_interested">İlgilenmeyen / vazgeçen / başka yerden alan</option>
                                  <option value="callback">Geri aranacak / bizi arayacak (Callback)</option>
                                  <option value="potential">Potansiyel kayıt</option>
                                  <option value="pending_review">Değerlendirme bekliyor</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Değişiklik Nedeni</label>
                                <input
                                  type="text"
                                  placeholder="Kategori değiştirilme gerekçesini belirtiniz..."
                                  value={overrideReason}
                                  onChange={(e) => setOverrideReason(e.target.value)}
                                  className="w-full h-8 text-xs bg-background border border-border rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end">
                              <button
                                onClick={() => handleSaveOverride(lead.lead_id)}
                                disabled={savingOverrideId !== null}
                                className="h-8 px-4 bg-primary text-primary-foreground font-semibold text-xs rounded-lg flex items-center justify-center hover:bg-primary/95 cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                              >
                                {savingOverrideId === lead.lead_id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  'Kategoriyi Güncelle'
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Lead Audit Logs */}
                          {auditLogs[lead.lead_id] && auditLogs[lead.lead_id].length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-bold text-muted-foreground uppercase text-[9px] tracking-wider">Değişiklik Geçmişi (Audit Logs)</h4>
                              <div className="space-y-2 max-h-32 overflow-y-auto border border-border/50 rounded-lg p-2.5 bg-muted/10">
                                {auditLogs[lead.lead_id].map(log => {
                                  const getCatName = (c: string) => {
                                    if (c === 'potential') return 'Potansiyel'
                                    if (c === 'unrelated') return 'Alakasız'
                                    if (c === 'accidental_click') return 'Yanlışlıkla'
                                    if (c === 'unreachable') return 'Ulaşılamadı'
                                    if (c === 'not_interested') return 'İlgilenmeyen'
                                    return 'Bekliyor'
                                  }
                                  return (
                                    <div key={log.id} className="text-[10px] border-b border-border/40 last:border-b-0 pb-1.5 last:pb-0 mb-1.5 last:mb-0 text-muted-foreground font-medium">
                                      <div className="flex justify-between font-semibold text-foreground mb-0.5">
                                        <span>
                                          {getCatName(log.old_category)} → {getCatName(log.new_category)}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {new Date(log.changed_at).toLocaleString('tr-TR')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Nedeni: {log.reason || 'Belirtilmedi'}</span>
                                        <span className="italic">Düzenleyen: {log.profiles?.full_name || 'Yönetici'}</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
