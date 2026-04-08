import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Transaction, CurrencyCode } from '../types';
import { CURRENCIES } from '../constants';

interface CalendarViewProps {
  transactions: Transaction[];
  currency: CurrencyCode;
  exchangeRates: Record<CurrencyCode, number>;
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
  language: 'zh' | 'en';
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  transactions,
  currency,
  exchangeRates,
  onSelectDate,
  selectedDate,
  language
}) => {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const days = [];
  const totalDays = daysInMonth(year, month);
  const offset = firstDayOfMonth(year, month);

  const convert = (amount: number, from: CurrencyCode, to: CurrencyCode) => {
    if (from === to) return amount;
    const amountInBase = amount / exchangeRates[from];
    return amountInBase * exchangeRates[to];
  };

  // Daily totals for the current month
  const dailyTotals: Record<number, number> = {};
  transactions.forEach(tx => {
    const d = new Date(tx.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      const convertedAmount = convert(tx.amount, tx.currency, currency);
      dailyTotals[day] = (dailyTotals[day] || 0) + convertedAmount; 
    }
  });

  const weekDays = language === 'zh' 
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthNames = language === 'zh'
    ? ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-[32px] p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          {monthNames[month]} {year}
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {language === 'zh' ? '今天' : 'Today'}
          </button>
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <ChevronLeft size={18} className="text-gray-400" />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const total = dailyTotals[day] || 0;
          const isSelected = selectedDate && 
                            selectedDate.getDate() === day && 
                            selectedDate.getMonth() === month && 
                            selectedDate.getFullYear() === year;
          const isToday = new Date().getDate() === day && 
                          new Date().getMonth() === month && 
                          new Date().getFullYear() === year;

          const maxTotal = Math.max(...Object.values(dailyTotals), 1);
          const intensity = total > 0 ? Math.min(1, total / maxTotal) : 0;

          return (
            <button
              key={day}
              onClick={() => onSelectDate(new Date(year, month, day))}
              className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all group ${
                isSelected 
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg scale-105 z-10' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              style={!isSelected && total > 0 ? { backgroundColor: `rgba(249, 115, 22, ${intensity * 0.2})` } : {}}
            >
              <span className={`text-xs font-bold ${isToday && !isSelected ? 'text-blue-500 underline decoration-2 underline-offset-4' : ''}`}>
                {day}
              </span>
              {total > 0 && (
                <span className={`text-[8px] mt-0.5 font-medium truncate w-full px-1 text-center ${
                  isSelected ? 'text-white/70 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {total > 999 ? `${(total/1000).toFixed(1)}k` : total.toFixed(0)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
