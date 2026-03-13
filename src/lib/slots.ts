import { generateId } from './id';

interface SlotTemplate {
  id: string;
  recurringDayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface GeneratedSlot {
  id: string;
  lessonId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'open';
}

/** 繰り返しレッスンの指定日付範囲内スロットを生成する */
export function generateRecurringSlots(
  lesson: SlotTemplate,
  fromStr: string,
  toStr: string
): GeneratedSlot[] {
  // UTC固定で処理（タイムゾーンによるズレを防ぐ）
  const from = new Date(fromStr + 'T00:00:00.000Z');
  const to = new Date(toStr + 'T00:00:00.000Z');
  const slots: GeneratedSlot[] = [];

  const current = new Date(from);
  // 最初の対象曜日まで進める（UTC基準）
  let guard = 0;
  while (current.getUTCDay() !== lesson.recurringDayOfWeek) {
    current.setUTCDate(current.getUTCDate() + 1);
    if (++guard > 7) return [];
  }

  while (current <= to) {
    slots.push({
      id: generateId(),
      lessonId: lesson.id,
      date: current.toISOString().slice(0, 10), // UTC日付
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      status: 'open',
    });
    current.setUTCDate(current.getUTCDate() + 7);
  }

  return slots;
}
