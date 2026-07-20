import React, { useMemo, useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Info, 
  Megaphone, 
  Search, 
  Inbox
} from 'lucide-react';
import type { AppNotification } from '../types';

interface NotificationsPageProps {
  notifications: AppNotification[];
  onMarkRead: (id?: string) => Promise<void>;
  isSaving: boolean;
}

export default function NotificationsPage({
  notifications,
  onMarkRead,
  isSaving,
}: NotificationsPageProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'payment' | 'broadcast'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // Apply type/read status filter
      if (filter === 'unread' && item.isRead) return false;
      if (filter === 'payment' && item.type !== 'payment') return false;
      if (filter === 'broadcast' && item.type !== 'broadcast') return false;

      // Apply search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesBody = item.body.toLowerCase().includes(query);
        return matchesTitle || matchesBody;
      }

      return true;
    });
  }, [notifications, filter, searchQuery]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const getTypeIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'payment':
        return (
          <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-500 border border-amber-500/20 shadow-sm">
            <DollarSign className="h-5 w-5" />
          </div>
        );
      case 'broadcast':
        return (
          <div className="rounded-xl bg-orange-500/10 p-2.5 text-orange-500 border border-orange-500/20 shadow-sm">
            <Megaphone className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-500 border border-blue-500/20 shadow-sm">
            <Info className="h-5 w-5" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-500 p-3 shadow-md shadow-orange-500/20">
              <Bell className="h-6 w-6 text-white animate-swing" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Recent Notifications</h2>
              <p className="mt-1 text-sm text-slate-300">
                Stay updated with recent payment requests, status updates, and announcements.
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              disabled={isSaving}
              onClick={() => onMarkRead()}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-orange-500/10 hover:bg-orange-600 focus:outline-none transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Control panel (Filter + Search) */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-250 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {(['all', 'unread', 'payment', 'broadcast'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`rounded-lg px-4 py-2 text-xs font-bold capitalize transition-all focus:outline-none ${
                filter === type
                  ? 'bg-slate-800 text-orange-400 shadow-sm border border-slate-700'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              {type} {type === 'unread' && unreadCount > 0 ? `(${unreadCount})` : ''}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-16 text-center shadow-inner">
            <div className="rounded-full bg-slate-100 p-4 mb-4 text-slate-400 border border-slate-200">
              <Inbox className="h-8 w-8" />
            </div>
            <h4 className="font-extrabold text-slate-800 text-base">No notifications found</h4>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
              {searchQuery
                ? "We couldn't find any notifications matching your search query. Try typing something else."
                : "You're all caught up! There are no recent notifications in this category."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => !item.isRead && onMarkRead(item.id)}
                className={`relative flex items-start gap-4 rounded-xl border p-4.5 transition-all shadow-sm ${
                  item.isRead
                    ? 'border-slate-200 bg-white/70 opacity-90'
                    : 'border-orange-100 bg-orange-50/20 hover:bg-orange-50/30 cursor-pointer hover:border-orange-200'
                }`}
              >
                {/* Unread indicator dot */}
                {!item.isRead && (
                  <span className="absolute top-4 right-4 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                )}

                {/* Left icon wrapper */}
                <div className="shrink-0">{getTypeIcon(item.type)}</div>

                {/* Content body */}
                <div className="space-y-1 pr-6">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <h4 className={`text-sm leading-snug ${item.isRead ? 'font-bold text-slate-800' : 'font-extrabold text-slate-900'}`}>
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">{item.body}</p>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mt-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
