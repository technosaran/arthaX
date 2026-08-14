"use client";

import { useState, useMemo } from "react";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  parseISO
} from "date-fns";

type Props = {
  startDate: string;
  endDate: string;
  onSelectDate: (dateStr: string) => void;
  onSelectRange: (startStr: string, endStr: string) => void;
  logDatesSet?: Set<string>;
  onReset?: () => void;
};

export default function MiniCalendar({
  startDate,
  endDate,
  onSelectDate,
  onSelectRange,
  logDatesSet,
  onReset,
}: Props) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (startDate) return parseISO(startDate);
    return new Date();
  });

  const [isOpen, setIsOpen] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDateGrid = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDateGrid = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const daysGrid = useMemo(() => {
    return eachDayOfInterval({ start: startDateGrid, end: endDateGrid });
  }, [startDateGrid, endDateGrid]);

  const selectedStartObj = startDate ? parseISO(startDate) : null;
  const selectedEndObj = endDate ? parseISO(endDate) : null;

  const handleDayClick = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    if (!startDate || (startDate && endDate && startDate !== endDate)) {
      onSelectDate(dayStr);
    } else if (startDate && !endDate) {
      if (dayStr < startDate) {
        onSelectRange(dayStr, startDate);
      } else {
        onSelectRange(startDate, dayStr);
      }
    } else if (startDate === endDate) {
      if (dayStr === startDate) {
        onSelectDate(dayStr);
      } else if (dayStr < startDate) {
        onSelectRange(dayStr, startDate);
      } else {
        onSelectRange(startDate, dayStr);
      }
    }
  };

  const handleSelectEntireMonth = () => {
    const startStr = format(monthStart, "yyyy-MM-dd");
    const endStr = format(monthEnd, "yyyy-MM-dd");
    onSelectRange(startStr, endStr);
  };

  const activeLabel = useMemo(() => {
    if (startDate && endDate) {
      if (startDate === endDate) {
        return format(parseISO(startDate), "MMM d, yyyy");
      }
      return `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(endDate), "MMM d, yyyy")}`;
    }
    if (startDate) {
      return `From ${format(parseISO(startDate), "MMM d, yyyy")}`;
    }
    return "All Time";
  }, [startDate, endDate]);

  return (
    <div className="relative inline-block text-left select-none z-30">
      {/* Calendar Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
          startDate || endDate
            ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
            : "bg-[#1e1e1e] text-gray-300 border-white/10 hover:text-white hover:bg-white/5"
        }`}
      >
        <span className="text-sm">📅</span>
        <span>{activeLabel}</span>
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Calendar Window */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-[280px] bg-[#14161d] border border-white/10 rounded-2xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-xl z-50 animate-scale-in">
            {/* Calendar Month Header */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all text-xs cursor-pointer"
                title="Previous Month"
              >
                ←
              </button>
              <span className="text-xs font-black text-white uppercase tracking-wider">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all text-xs cursor-pointer"
                title="Next Month"
              >
                →
              </button>
            </div>

            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
                <span key={day} className="text-[0.625rem] font-black uppercase text-gray-500">
                  {day}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {daysGrid.map((day) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const isCurrentMonthDay = isSameMonth(day, currentMonth);
                const isTodayDay = isToday(day);
                const hasLogs = logDatesSet?.has(dayStr);

                const isSelectedStart = selectedStartObj && isSameDay(day, selectedStartObj);
                const isSelectedEnd = selectedEndObj && isSameDay(day, selectedEndObj);
                const isSelectedRange =
                  selectedStartObj &&
                  selectedEndObj &&
                  day >= selectedStartObj &&
                  day <= selectedEndObj;

                let dayStyle = "text-gray-400 hover:bg-white/10 hover:text-white";
                if (!isCurrentMonthDay) {
                  dayStyle = "text-gray-700 hover:bg-white/5";
                }

                if (isSelectedStart || isSelectedEnd) {
                  dayStyle = "bg-amber-500 text-black font-black shadow-[0_0_10px_rgba(245,158,11,0.5)]";
                } else if (isSelectedRange) {
                  dayStyle = "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30";
                } else if (isTodayDay) {
                  dayStyle = "bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40";
                }

                return (
                  <button
                    key={dayStr}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={`relative w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${dayStyle}`}
                  >
                    <span>{format(day, "d")}</span>
                    {hasLogs && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Actions Footer */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5 text-[0.6875rem]">
              <button
                type="button"
                onClick={handleSelectEntireMonth}
                className="text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer"
              >
                Select Month
              </button>

              {onReset && (
                <button
                  type="button"
                  onClick={() => {
                    onReset();
                    setIsOpen(false);
                  }}
                  className="text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer"
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
