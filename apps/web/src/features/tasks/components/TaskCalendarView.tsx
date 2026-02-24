// ============================================================
// FILE: apps/web/src/features/tasks/components/TaskCalendarView.tsx
// ============================================================
// Calendar view for tasks with month/week/day views,
// drag-to-reschedule, click-to-create, color-coded by priority.
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Clock,
  CheckCircle2, AlertCircle, ArrowUp, ArrowDown, Minus,
  CheckSquare, Phone, Mail, Calendar as CalendarIcon,
  Monitor, FileText, Users, GripVertical, Loader2,
  MapPin, ExternalLink, X,
} from 'lucide-react';
import type {
  Task, TaskType, TaskPriority, TaskStatus, CreateTaskData, UpdateTaskData,
} from '../../../api/tasks.api';
import { tasksApi } from '../../../api/tasks.api';
import { calendarSyncApi } from '../../../api/calendar-sync.api';
import type { CalendarEvent } from '../../../api/calendar-sync.api';

// ── Icon maps (same as TasksPage) ──
const PRIORITY_ICONS: Record<string, any> = {
  'alert-circle': AlertCircle, 'arrow-up': ArrowUp, minus: Minus, 'arrow-down': ArrowDown,
};
const TYPE_ICONS: Record<string, any> = {
  'check-square': CheckSquare, phone: Phone, mail: Mail, calendar: CalendarIcon,
  'arrow-right': ArrowUp, monitor: Monitor, 'file-text': FileText, users: Users,
};

// ── Date helpers ──
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function startOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}
function endOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(23, 59, 59, 999); return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d: Date): boolean { return isSameDay(d, new Date()); }
function formatDateISO(d: Date): string { return d.toISOString().split('T')[0]; }

function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0=Sun
  const gridStart = addDays(first, -startDay);
  const weeks: Date[][] = [];
  let current = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current));
      current = addDays(current, 1);
    }
    weeks.push(week);
    // Stop if next week is entirely in next month
    if (week[6].getMonth() !== month && w >= 4) break;
  }
  return weeks;
}

function getWeekDays(date: Date): Date[] {
  const dayOfWeek = date.getDay();
  const start = addDays(date, -dayOfWeek);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// ── Types ──
export type CalendarViewMode = 'month' | 'week' | 'day';

interface TaskCalendarViewProps {
  types: TaskType[];
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  onTaskClick: (id: string) => void;
  onQuickCreate: (date: string) => void;
  onTaskUpdate: (id: string, dto: UpdateTaskData) => Promise<void>;
  colorBy?: 'priority' | 'status';
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════

export function TaskCalendarView({
  types, statuses, priorities,
  onTaskClick, onQuickCreate, onTaskUpdate,
  colorBy = 'priority',
}: TaskCalendarViewProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Drag state
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // ── Compute date range for current view ──
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const first = new Date(year, month, 1);
      const startDay = first.getDay();
      const gridStart = addDays(first, -startDay);
      // 6 weeks max
      const gridEnd = addDays(gridStart, 42);
      return { rangeStart: startOfDay(gridStart), rangeEnd: endOfDay(gridEnd) };
    } else if (viewMode === 'week') {
      const days = getWeekDays(currentDate);
      return { rangeStart: startOfDay(days[0]), rangeEnd: endOfDay(days[6]) };
    } else {
      return { rangeStart: startOfDay(currentDate), rangeEnd: endOfDay(currentDate) };
    }
  }, [viewMode, currentDate]);

  // ── Fetch tasks + Google events for range ──
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const [taskResult, gEvents] = await Promise.all([
        tasksApi.list({
          dueDateFrom: rangeStart.toISOString(),
          dueDateTo: rangeEnd.toISOString(),
          isCompleted: 'false',
          view: 'list',
          limit: 500,
          sortBy: 'due_date',
          sortOrder: 'ASC',
        }),
        calendarSyncApi.getEvents(rangeStart.toISOString(), rangeEnd.toISOString()).catch(() => []),
      ]);
      const listResult = taskResult as { data: Task[]; meta: any };
      setTasks(listResult.data || []);
      setGoogleEvents(gEvents);
    } catch (err) {
      console.error('Failed to fetch calendar tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Group tasks by date key ──
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = formatDateISO(new Date(task.dueDate));
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return map;
  }, [tasks]);

  // ── Group Google events by date key ──
  const googleEventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const evt of googleEvents) {
      if (!evt.startTime) continue;
      const key = formatDateISO(new Date(evt.startTime));
      if (!map[key]) map[key] = [];
      map[key].push(evt);
    }
    return map;
  }, [googleEvents]);

  // ── Navigation ──
  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
    else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  // ── Drill down to day view (used by "+X more" overflow) ──
  const drillDownToDay = (dateKey: string) => {
    setCurrentDate(new Date(dateKey + 'T12:00:00'));
    setViewMode('day');
  };

  // ── Drag handlers ──
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggingTask(task);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateKey);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = async (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // If same day, do nothing
    if (task.dueDate && formatDateISO(new Date(task.dueDate)) === dateKey) {
      setDraggingTask(null);
      return;
    }

    // Preserve time if task had one, else set to noon
    let newDueDate: string;
    if (task.dueDate) {
      const oldDate = new Date(task.dueDate);
      const [year, month, day] = dateKey.split('-').map(Number);
      oldDate.setFullYear(year, month - 1, day);
      newDueDate = oldDate.toISOString();
    } else {
      newDueDate = new Date(`${dateKey}T12:00:00`).toISOString();
    }

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, dueDate: newDueDate } : t));
    setDraggingTask(null);

    try {
      await onTaskUpdate(taskId, { dueDate: newDueDate });
    } catch {
      // Revert on failure
      fetchTasks();
    }
  };

  // ── Color helper ──
  const getTaskColor = (task: Task): string => {
    if (colorBy === 'status' && task.status) return task.status.color;
    if (task.priority) return task.priority.color;
    return '#6B7280';
  };

  const getTaskBg = (task: Task): string => {
    const color = getTaskColor(task);
    return `${color}18`; // 18 = ~10% opacity hex
  };

  // ── Title bar ──
  const titleText = useMemo(() => {
    if (viewMode === 'month') {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewMode === 'week') {
      const days = getWeekDays(currentDate);
      const s = days[0];
      const e = days[6];
      if (s.getMonth() === e.getMonth()) {
        return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
      }
      return `${MONTHS[s.getMonth()].slice(0, 3)} ${s.getDate()} – ${MONTHS[e.getMonth()].slice(0, 3)} ${e.getDate()}, ${e.getFullYear()}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  }, [viewMode, currentDate]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* ── Calendar Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white min-w-[220px] text-center">
            {titleText}
          </h2>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={goToday}
            className="ml-2 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {(['month', 'week', 'day'] as CalendarViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {loading && <Loader2 size={16} className="animate-spin text-gray-400 ml-2" />}
        </div>
      </div>

      {/* ── Calendar Body ── */}
      {viewMode === 'month' && (
        <MonthView
          currentDate={currentDate}
          tasksByDate={tasksByDate}
          googleEventsByDate={googleEventsByDate}
          dragOverDate={dragOverDate}
          draggingTask={draggingTask}
          onTaskClick={onTaskClick}
          onQuickCreate={onQuickCreate}
          onDrillDown={drillDownToDay}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          getTaskColor={getTaskColor}
          getTaskBg={getTaskBg}
        />
      )}
      {viewMode === 'week' && (
        <WeekView
          currentDate={currentDate}
          tasksByDate={tasksByDate}
          googleEventsByDate={googleEventsByDate}
          dragOverDate={dragOverDate}
          draggingTask={draggingTask}
          onTaskClick={onTaskClick}
          onQuickCreate={onQuickCreate}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          getTaskColor={getTaskColor}
          getTaskBg={getTaskBg}
        />
      )}
      {viewMode === 'day' && (
        <DayView
          currentDate={currentDate}
          tasksByDate={tasksByDate}
          googleEventsByDate={googleEventsByDate}
          onTaskClick={onTaskClick}
          onQuickCreate={onQuickCreate}
          onDragStart={handleDragStart}
          getTaskColor={getTaskColor}
          getTaskBg={getTaskBg}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MONTH VIEW
// ════════════════════════════════════════════════════════════

interface ViewProps {
  currentDate: Date;
  tasksByDate: Record<string, Task[]>;
  googleEventsByDate?: Record<string, CalendarEvent[]>;
  dragOverDate?: string | null;
  draggingTask?: Task | null;
  onTaskClick: (id: string) => void;
  onQuickCreate: (date: string) => void;
  onDrillDown?: (dateKey: string) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragOver?: (e: React.DragEvent, dateKey: string) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, dateKey: string) => void;
  getTaskColor: (task: Task) => string;
  getTaskBg: (task: Task) => string;
}

function MonthView({
  currentDate, tasksByDate, googleEventsByDate = {}, dragOverDate,
  onTaskClick, onQuickCreate, onDrillDown,
  onDragStart, onDragOver, onDragLeave, onDrop,
  getTaskColor, getTaskBg,
}: ViewProps) {
  const weeks = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());
  const month = currentDate.getMonth();
  const MAX_VISIBLE = 3;

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {DAYS_SHORT.map(d => (
          <div key={d} className="px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 text-center uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
          {week.map((day, di) => {
            const dateKey = formatDateISO(day);
            const dayTasks = tasksByDate[dateKey] || [];
            const dayGoogleEvents = googleEventsByDate[dateKey] || [];
            const totalItems = dayTasks.length + dayGoogleEvents.length;
            const isCurrentMonth = day.getMonth() === month;
            const isDragOver = dragOverDate === dateKey;
            const today = isToday(day);

            // Distribute slots: tasks first, then Google events
            const taskSlots = Math.min(dayTasks.length, MAX_VISIBLE);
            const googleSlots = Math.min(dayGoogleEvents.length, MAX_VISIBLE - taskSlots);

            return (
              <div
                key={di}
                onClick={() => onQuickCreate(dateKey)}
                onDragOver={(e) => onDragOver?.(e, dateKey)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop?.(e, dateKey)}
                className={`min-h-[110px] border-r border-gray-100 dark:border-gray-800 last:border-r-0 transition-colors cursor-pointer ${
                  isDragOver
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-400/40'
                    : isCurrentMonth
                      ? 'bg-white dark:bg-slate-900 hover:bg-gray-50/50 dark:hover:bg-slate-800/30'
                      : 'bg-gray-50/50 dark:bg-slate-950/50 hover:bg-gray-100/50 dark:hover:bg-slate-900/50'
                }`}
              >
                {/* Day number + add button */}
                <div className="flex items-center justify-between px-2 pt-1.5 group">
                  <span className={`text-xs font-medium leading-6 w-6 h-6 flex items-center justify-center rounded-full ${
                    today
                      ? 'bg-blue-600 text-white'
                      : isCurrentMonth
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-400 dark:text-gray-600'
                  }`}>
                    {day.getDate()}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onQuickCreate(dateKey); }}
                    className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Add task"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Task + Google event chips */}
                <div className="px-1 pb-1 space-y-0.5 mt-0.5">
                  {dayTasks.slice(0, taskSlots).map(task => (
                    <TaskChip
                      key={task.id}
                      task={task}
                      size="sm"
                      onClick={() => onTaskClick(task.id)}
                      onDragStart={onDragStart}
                      color={getTaskColor(task)}
                      bg={getTaskBg(task)}
                    />
                  ))}
                  {dayGoogleEvents.slice(0, googleSlots).map(evt => (
                    <GoogleEventChip key={evt.id} event={evt} size="sm" />
                  ))}
                  {totalItems > MAX_VISIBLE && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDrillDown?.(dateKey); }}
                      className="w-full text-[10px] text-gray-400 hover:text-blue-500 text-left px-1.5 py-0.5"
                    >
                      +{totalItems - MAX_VISIBLE} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// WEEK VIEW
// ════════════════════════════════════════════════════════════

function WeekView({
  currentDate, tasksByDate, googleEventsByDate = {}, dragOverDate,
  onTaskClick, onQuickCreate,
  onDragStart, onDragOver, onDragLeave, onDrop,
  getTaskColor, getTaskBg,
}: ViewProps) {
  const days = getWeekDays(currentDate);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to ~8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * 60; // 8 hours * 60px/hour
    }
  }, []);

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 dark:border-gray-700">
        <div className="border-r border-gray-200 dark:border-gray-700" /> {/* gutter */}
        {days.map((day, i) => {
          const today = isToday(day);
          return (
            <div key={i} className="px-2 py-2 text-center border-r border-gray-100 dark:border-gray-800 last:border-r-0">
              <div className="text-[10px] font-medium text-gray-400 uppercase">{DAYS_SHORT[i]}</div>
              <div className={`text-sm font-semibold mt-0.5 w-7 h-7 mx-auto flex items-center justify-center rounded-full ${
                today ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'
              }`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day / undated tasks row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 dark:border-gray-700">
        <div className="px-1 py-2 text-[10px] text-gray-400 text-right pr-2 border-r border-gray-200 dark:border-gray-700">
          all day
        </div>
        {days.map((day, i) => {
          const dateKey = formatDateISO(day);
          const dayTasks = tasksByDate[dateKey] || [];
          const dayGoogleEvents = googleEventsByDate[dateKey] || [];
          const isDragOver = dragOverDate === dateKey;
          return (
            <div
              key={i}
              onClick={() => onQuickCreate(dateKey)}
              onDragOver={(e) => onDragOver?.(e, dateKey)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop?.(e, dateKey)}
              className={`min-h-[60px] px-1 py-1 border-r border-gray-100 dark:border-gray-800 last:border-r-0 space-y-0.5 transition-colors group cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-800/30 ${
                isDragOver ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-400/40' : ''
              }`}
            >
              {dayTasks.map(task => (
                <TaskChip
                  key={task.id}
                  task={task}
                  size="sm"
                  onClick={() => onTaskClick(task.id)}
                  onDragStart={onDragStart}
                  color={getTaskColor(task)}
                  bg={getTaskBg(task)}
                />
              ))}
              {dayGoogleEvents.map(evt => (
                <GoogleEventChip key={evt.id} event={evt} size="sm" />
              ))}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="overflow-y-auto max-h-[calc(100vh-360px)]">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {/* Hour rows */}
          {HOURS.map(hour => (
            <div key={hour} className="contents">
              {/* Time label */}
              <div className="h-[60px] text-[10px] text-gray-400 text-right pr-2 pt-0 border-r border-gray-200 dark:border-gray-700 -translate-y-[7px]">
                {hour === 0 ? '' : `${hour % 12 || 12}${hour < 12 ? 'a' : 'p'}`}
              </div>
              {/* Day columns */}
              {days.map((day, di) => {
                const dateKey = formatDateISO(day);
                return (
                  <div
                    key={di}
                    onClick={() => {
                      const d = new Date(day);
                      d.setHours(hour, 0, 0, 0);
                      onQuickCreate(d.toISOString());
                    }}
                    onDragOver={(e) => onDragOver?.(e, dateKey)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop?.(e, dateKey)}
                    className="h-[60px] border-r border-b border-gray-100 dark:border-gray-800 last:border-r-0 cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors"
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// DAY VIEW
// ════════════════════════════════════════════════════════════

function DayView({
  currentDate, tasksByDate, googleEventsByDate = {},
  onTaskClick, onQuickCreate,
  onDragStart, getTaskColor, getTaskBg,
}: ViewProps) {
  const dateKey = formatDateISO(currentDate);
  const dayTasks = tasksByDate[dateKey] || [];
  const dayGoogleEvents = googleEventsByDate[dateKey] || [];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * 80;
    }
  }, []);

  // Group tasks by hour (or "all day" if no time)
  const tasksByHour = useMemo(() => {
    const map: Record<number, Task[]> = {};
    const allDay: Task[] = [];
    for (const task of dayTasks) {
      if (!task.dueDate) { allDay.push(task); continue; }
      const d = new Date(task.dueDate);
      const hour = d.getHours();
      if (!map[hour]) map[hour] = [];
      map[hour].push(task);
    }
    return { map, allDay };
  }, [dayTasks]);

  // Group Google events by hour
  const googleByHour = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    const allDay: CalendarEvent[] = [];
    for (const evt of dayGoogleEvents) {
      if (evt.allDay) { allDay.push(evt); continue; }
      if (!evt.startTime) { allDay.push(evt); continue; }
      const d = new Date(evt.startTime);
      const hour = d.getHours();
      if (!map[hour]) map[hour] = [];
      map[hour].push(evt);
    }
    return { map, allDay };
  }, [dayGoogleEvents]);

  return (
    <div>
      {/* All-day section */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <div className="w-[60px] px-2 py-2 text-[10px] text-gray-400 text-right border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
          all day
        </div>
        <div onClick={() => onQuickCreate(dateKey)} className="flex-1 p-2 space-y-1 min-h-[48px] group cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors">
          {tasksByHour.allDay.map(task => (
            <TaskChip
              key={task.id}
              task={task}
              size="md"
              onClick={() => onTaskClick(task.id)}
              onDragStart={onDragStart}
              color={getTaskColor(task)}
              bg={getTaskBg(task)}
              showTime={false}
            />
          ))}
          {googleByHour.allDay.map(evt => (
            <GoogleEventChip key={evt.id} event={evt} size="md" showTime={false} />
          ))}
        </div>
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="overflow-y-auto max-h-[calc(100vh-320px)]">
        {HOURS.map(hour => {
          const hourTasks = tasksByHour.map[hour] || [];
          const hourGoogleEvents = googleByHour.map[hour] || [];
          return (
            <div key={hour} className="flex border-b border-gray-100 dark:border-gray-800 group">
              <div className="w-[60px] text-[10px] text-gray-400 text-right pr-2 pt-1 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 h-[80px]">
                {hour === 0 ? '12 AM' : `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`}
              </div>
              <div
                onClick={() => {
                  const d = new Date(currentDate);
                  d.setHours(hour, 0, 0, 0);
                  onQuickCreate(d.toISOString());
                }}
                className="flex-1 p-1 space-y-0.5 min-h-[80px] cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors"
              >
                {hourTasks.map(task => (
                  <TaskChip
                    key={task.id}
                    task={task}
                    size="md"
                    onClick={() => onTaskClick(task.id)}
                    onDragStart={onDragStart}
                    color={getTaskColor(task)}
                    bg={getTaskBg(task)}
                    showTime
                  />
                ))}
                {hourGoogleEvents.map(evt => (
                  <GoogleEventChip key={evt.id} event={evt} size="md" showTime />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TASK CHIP (reusable across views)
// ════════════════════════════════════════════════════════════

interface TaskChipProps {
  task: Task;
  size: 'sm' | 'md';
  onClick: () => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  color: string;
  bg: string;
  showTime?: boolean;
}

function TaskChip({ task, size, onClick, onDragStart, color, bg, showTime }: TaskChipProps) {
  const isOverdue = task.dueDate && !task.completedAt && new Date(task.dueDate) < new Date();

  const PIcon = task.priority ? PRIORITY_ICONS[task.priority.icon || 'minus'] || Minus : null;

  const timeStr = useMemo(() => {
    if (!showTime || !task.dueDate) return null;
    const d = new Date(task.dueDate);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [showTime, task.dueDate]);

  if (size === 'sm') {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, task)}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="flex items-center gap-1 px-1.5 py-[3px] rounded text-[11px] font-medium truncate cursor-pointer hover:shadow-sm transition-shadow group/chip"
        style={{ backgroundColor: bg, color, borderLeft: `3px solid ${color}` }}
        title={task.title}
      >
        {task.completedAt && <CheckCircle2 size={10} className="flex-shrink-0 opacity-60" />}
        <span className="truncate">{task.title}</span>
        <GripVertical size={10} className="flex-shrink-0 opacity-0 group-hover/chip:opacity-40 ml-auto cursor-grab" />
      </div>
    );
  }

  // md size
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:shadow-md transition-shadow group/chip"
      style={{ backgroundColor: bg, borderLeft: `3px solid ${color}` }}
    >
      <GripVertical size={12} className="flex-shrink-0 text-gray-300 opacity-0 group-hover/chip:opacity-60 cursor-grab" />
      {PIcon && <PIcon size={12} style={{ color }} className="flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${task.completedAt ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
          {task.title}
        </p>
        {timeStr && (
          <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
            <Clock size={9} /> {timeStr}
          </p>
        )}
      </div>
      {isOverdue && (
        <span className="text-[9px] font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
          overdue
        </span>
      )}
      {task.assignee && (
        <div
          className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-medium text-gray-500 flex-shrink-0"
          title={`${task.assignee.firstName} ${task.assignee.lastName}`}
        >
          {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// GOOGLE EVENT CHIP (distinct from task chips)
// ════════════════════════════════════════════════════════════

const GOOGLE_COLOR = '#4285F4';
const GOOGLE_BG = '#4285F418';

interface GoogleEventChipProps {
  event: CalendarEvent;
  size: 'sm' | 'md';
  showTime?: boolean;
}

function GoogleEventChip({ event, size, showTime }: GoogleEventChipProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const timeStr = useMemo(() => {
    if (!showTime || !event.startTime || event.allDay) return null;
    const d = new Date(event.startTime);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [showTime, event.startTime, event.allDay]);

  // Strip [CRM] prefix from events pushed from CRM
  const title = event.title.replace(/^\[CRM\]\s*/, '');

  // Format full date/time for popover
  const fullTimeRange = useMemo(() => {
    if (!event.startTime) return 'No time set';
    const start = new Date(event.startTime);
    if (event.allDay) {
      return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    const startStr = start.toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
    if (event.endTime) {
      const end = new Date(event.endTime);
      const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${startStr} – ${endStr}`;
    }
    return startStr;
  }, [event.startTime, event.endTime, event.allDay]);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        chipRef.current && !chipRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popoverOpen]);

  // Close on Escape
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopoverOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [popoverOpen]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPopoverOpen(!popoverOpen);
  };

  return (
    <div className="relative" ref={chipRef}>
      {/* ── Chip ── */}
      {size === 'sm' ? (
        <div
          onClick={handleClick}
          className="flex items-center gap-1 px-1.5 py-[3px] rounded text-[11px] font-medium truncate cursor-pointer hover:shadow-sm transition-shadow"
          style={{ backgroundColor: GOOGLE_BG, color: GOOGLE_COLOR, borderLeft: `3px solid ${GOOGLE_COLOR}` }}
        >
          <CalendarIcon size={9} className="flex-shrink-0 opacity-70" />
          <span className="truncate">{title}</span>
        </div>
      ) : (
        <div
          onClick={handleClick}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:shadow-md transition-shadow"
          style={{ backgroundColor: GOOGLE_BG, borderLeft: `3px solid ${GOOGLE_COLOR}` }}
        >
          <CalendarIcon size={12} style={{ color: GOOGLE_COLOR }} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate text-gray-800 dark:text-gray-200">{title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {timeStr && (
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <Clock size={9} /> {timeStr}
                </span>
              )}
              {event.location && (
                <span className="text-[10px] text-gray-400 truncate">{event.location}</span>
              )}
            </div>
          </div>
          <span className="text-[8px] font-medium text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
            Google
          </span>
        </div>
      )}

      {/* ── Detail Popover ── */}
      {popoverOpen && (
        <div
          ref={popoverRef}
          className="absolute z-50 top-full mt-1 left-0 w-[300px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl"
          style={{ maxHeight: '400px' }}
        >
          {/* Header */}
          <div className="flex items-start gap-3 p-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: GOOGLE_BG }}>
              <CalendarIcon size={16} style={{ color: GOOGLE_COLOR }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{title}</h3>
              <span className="text-[10px] font-medium text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                Google Calendar
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setPopoverOpen(false); }}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {/* Details */}
          <div className="p-4 space-y-3">
            {/* Time */}
            <div className="flex items-start gap-2.5">
              <Clock size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{fullTimeRange}</p>
                {event.allDay && (
                  <p className="text-[10px] text-gray-400 mt-0.5">All day</p>
                )}
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-2.5">
                <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-700 dark:text-gray-300">{event.location}</p>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="flex items-start gap-2.5">
                <FileText size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap line-clamp-6">
                  {event.description}
                </p>
              </div>
            )}

            {/* Open in Google Calendar link */}
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline mt-2"
              >
                <ExternalLink size={12} />
                Open in Google Calendar
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}