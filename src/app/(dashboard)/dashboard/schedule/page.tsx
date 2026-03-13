'use client';
import { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, type Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ja } from 'date-fns/locale/ja';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { ja };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  lessonId: string;
}

interface CalEvent extends Event {
  resource: Slot;
}

export default function SchedulePage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const from = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      .toISOString().slice(0, 10);
    const to = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      .toISOString().slice(0, 10);

    fetch(`/api/lesson-slots?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((slots: Slot[]) => {
        if (!Array.isArray(slots)) return;
        setEvents(
          slots.map((slot) => ({
            title: slot.status === 'cancelled' ? '（キャンセル）' : 'レッスン',
            start: new Date(`${slot.date}T${slot.startTime}`),
            end: new Date(`${slot.date}T${slot.endTime}`),
            resource: slot,
          }))
        );
      })
      .catch(() => {});
  }, [currentDate]);

  function handleNavigate(date: Date) {
    setCurrentDate(date);
  }

  const eventStyleGetter = (event: CalEvent) => {
    const cancelled = event.resource.status === 'cancelled';
    return {
      style: {
        backgroundColor: cancelled ? '#e5e7eb' : '#10b981',
        color: cancelled ? '#6b7280' : '#fff',
        borderRadius: '4px',
        border: 'none',
        fontSize: '12px',
      },
    };
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">スケジュール</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          defaultView="month"
          onNavigate={handleNavigate}
          eventPropGetter={eventStyleGetter}
          messages={{
            next: '›',
            previous: '‹',
            today: '今日',
            month: '月',
            week: '週',
            day: '日',
            agenda: 'アジェンダ',
          }}
        />
      </div>
    </div>
  );
}
