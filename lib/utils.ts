import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatLeadId(id: string | null | undefined): string {
  if (!id) return '-'
  const regex = /^LD-(\d{4})-(\d+)$/
  const match = id.match(regex)
  if (match) {
    const sequence = parseInt(match[2], 10)
    const padded = sequence.toString().padStart(4, '0')
    return `L-${padded}`
  }
  return id
}

export function getNumericPart(idStr: any): number {
  if (!idStr) return 0;
  const str = String(idStr);
  if (!str.startsWith('L-')) return 0;
  const cleaned = str.replace(/\D/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

export interface ProgressiveScheduleResult {
  nextContactAt: string | null;
  callbackStatus: string;
  attemptInfo: string;
}

export function calculateNextWorkingTime(baseDate: Date, offsetMs: number): Date {
  let target = new Date(baseDate.getTime() + offsetMs);
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const isOutsideWorkingHours = (d: Date) => {
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const startMinutes = 8 * 60 + 30; // 08:30
    const endMinutes = 17 * 60 + 30;   // 17:30
    return totalMinutes < startMinutes || totalMinutes > endMinutes;
  };

  let iterations = 0;
  while ((isWeekend(target) || isOutsideWorkingHours(target)) && iterations < 100) {
    iterations++;
    if (isWeekend(target)) {
      target.setDate(target.getDate() + 1);
      target.setHours(8, 30, 0, 0);
    } else if (target.getHours() >= 17 || (target.getHours() === 17 && target.getMinutes() > 30)) {
      target.setDate(target.getDate() + 1);
      target.setHours(8, 30, 0, 0);
    } else if (target.getHours() < 8 || (target.getHours() === 8 && target.getMinutes() < 30)) {
      target.setHours(8, 30, 0, 0);
    }
  }
  return target;
}

export function getProgressiveCallSchedule(completedCallsCount: number, baseDate: Date = new Date()): ProgressiveScheduleResult {
  let nextContactAt: string | null = null;
  let callbackStatus = 'none';
  let attemptInfo = '';

  if (completedCallsCount === 0) {
    const targetDate = calculateNextWorkingTime(baseDate, 2 * 60 * 60 * 1000);
    nextContactAt = targetDate.toISOString();
    callbackStatus = 'pending';
    attemptInfo = ` (1. Arama Cevap Vermedi - 2. Arama: ${targetDate.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} için Planlandı)`;
  } else if (completedCallsCount === 1) {
    const targetDate = calculateNextWorkingTime(baseDate, 24 * 60 * 60 * 1000);
    nextContactAt = targetDate.toISOString();
    callbackStatus = 'pending';
    attemptInfo = ` (2. Arama Cevap Vermedi - 3. Arama: ${targetDate.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} için Planlandı)`;
  } else if (completedCallsCount === 2) {
    const targetDate = calculateNextWorkingTime(baseDate, 48 * 60 * 60 * 1000);
    nextContactAt = targetDate.toISOString();
    callbackStatus = 'pending';
    attemptInfo = ` (3. Arama Cevap Vermedi - 4. Arama: ${targetDate.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} için Planlandı)`;
  } else {
    nextContactAt = null;
    callbackStatus = 'none';
    attemptInfo = ' (4. Arama Cevap Vermedi - Maksimum Arama Limitine Ulaşıldı. Otomatik Planlama Sonlandırıldı.)';
  }

  return { nextContactAt, callbackStatus, attemptInfo };
}
