import React, { useState } from 'react';
import { Bell, Send, X, Users, User, AlertCircle, Sparkles } from 'lucide-react';
import { StaffMember } from '../types';

interface SendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  onSend: (data: { recipientEmail: string; title: string; body: string }) => Promise<void>;
}

export default function SendNotificationModal({
  isOpen,
  onClose,
  staffList,
  onSend,
}: SendNotificationModalProps) {
  const [recipientType, setRecipientType] = useState<'all' | 'individual'>('all');
  const [selectedStaffEmail, setSelectedStaffEmail] = useState<string>('');
  const [title, setTitle] = useState('Progress Tracker Notice');
  const [body, setBody] = useState('Please update your progress in the app as you complete your tasks.');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle) {
      setError('Please provide a notification title.');
      return;
    }

    if (!trimmedBody) {
      setError('Please enter a notification message.');
      return;
    }

    let recipientEmail = 'all';
    if (recipientType === 'individual') {
      if (!selectedStaffEmail) {
        setError('Please select a staff member to send this notification to.');
        return;
      }
      recipientEmail = selectedStaffEmail;
    }

    setIsSending(true);
    try {
      await onSend({ recipientEmail, title: trimmedTitle, body: trimmedBody });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send notification.');
    } finally {
      setIsSending(false);
    }
  };

  const selectedStaffObj = staffList.find((s) => s.email.toLowerCase() === selectedStaffEmail.toLowerCase());

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Send Custom Notification</h3>
              <p className="text-xs text-slate-300 mt-0.5">Notify team members in real-time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Recipient Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Recipients
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRecipientType('all')}
                className={`p-3.5 rounded-xl border text-left flex items-center space-x-3 transition-all ${
                  recipientType === 'all'
                    ? 'border-orange-500 bg-orange-50/50 text-orange-950 font-bold ring-2 ring-orange-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium'
                }`}
              >
                <div className={`p-2 rounded-lg ${recipientType === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs">All Users</span>
                  <span className="text-[10px] text-slate-500 font-normal">Broadcast to team</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRecipientType('individual')}
                className={`p-3.5 rounded-xl border text-left flex items-center space-x-3 transition-all ${
                  recipientType === 'individual'
                    ? 'border-orange-500 bg-orange-50/50 text-orange-950 font-bold ring-2 ring-orange-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium'
                }`}
              >
                <div className={`p-2 rounded-lg ${recipientType === 'individual' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <User className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs">Individual User</span>
                  <span className="text-[10px] text-slate-500 font-normal font-sans">Target specific staff</span>
                </div>
              </button>
            </div>
          </div>

          {/* Staff Dropdown if Individual selected */}
          {recipientType === 'individual' && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="block text-xs font-semibold text-slate-700">
                Select Staff Member <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedStaffEmail}
                onChange={(e) => setSelectedStaffEmail(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
              >
                <option value="">-- Choose a staff member --</option>
                {staffList.map((staff) => (
                  <option key={staff.email} value={staff.email}>
                    {staff.name} ({staff.email}) - {staff.department}
                  </option>
                ))}
              </select>
              {selectedStaffObj && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Target User: {selectedStaffObj.name}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">
                    {selectedStaffObj.department}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notification Title */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Notification Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Progress Update Reminder"
              className="w-full p-3 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
            />
          </div>

          {/* Custom Message / Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Notification Message <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setBody('Please update your progress in the app as you complete your tasks.')}
                className="text-[10px] font-semibold text-orange-600 hover:text-orange-700 flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Use Default Reminder</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here..."
              className="w-full p-3 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 flex items-center space-x-2 transition-all disabled:opacity-50"
            >
              {isSending ? (
                <span>Sending...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {recipientType === 'all'
                      ? 'Broadcast to All Users'
                      : selectedStaffObj
                      ? `Send to ${selectedStaffObj.name.split(' ')[0]}`
                      : 'Send Notification'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
