/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  FileSpreadsheet,
  Printer,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  AlertCircle,
  RefreshCw,
  Eye,
  Info
} from 'lucide-react';
import { YTDTask, TaskDailyUpdate } from '../types';
import {
  getCurrentLagosDate,
  formatLagosDateForDisplay,
  formatLagosTime,
  getDailyUpdatesForDate,
  downloadDailyReportCSV,
  openDailyReportPrintPDF,
  loadDailyUpdateLogs
} from '../utils/dailyReportUtils';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: YTDTask[];
  currentUserName?: string;
}

export default function DailyReportModal({
  isOpen,
  onClose,
  tasks,
  currentUserName = 'Admin',
}: DailyReportModalProps) {
  const todayDate = useMemo(() => getCurrentLagosDate(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [reportMode, setReportMode] = useState<'UPDATES_ONLY' | 'ALL_ACTIVE_SNAPSHOT'>('UPDATES_ONLY');

  // Compute yesterday's date
  const yesterdayDate = useMemo(() => {
    try {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lagos',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch {
      return '';
    }
  }, []);

  // Compute updates for the selected date
  const updates = useMemo(() => {
    return getDailyUpdatesForDate(selectedDate, tasks);
  }, [selectedDate, tasks]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = updates.length;
    const completed = updates.filter(
      (u) =>
        u.action === 'COMPLETED' ||
        (u.newStatus && (u.newStatus.toLowerCase().includes('complete') || u.newStatus.toLowerCase() === 'done'))
    ).length;
    const inProgress = updates.filter(
      (u) =>
        u.action === 'STATUS_CHANGE' &&
        u.newStatus &&
        !u.newStatus.toLowerCase().includes('complete') &&
        !u.newStatus.toLowerCase().includes('not started')
    ).length;
    const created = updates.filter((u) => u.action === 'CREATED').length;
    return { total, completed, inProgress, created };
  }, [updates]);

  if (!isOpen) return null;

  const handleDownloadCSV = () => {
    downloadDailyReportCSV(selectedDate, updates, tasks);
  };

  const handleDownloadPDF = () => {
    openDailyReportPrintPDF(selectedDate, updates, tasks, currentUserName, reportMode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-5xl my-6 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-report-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between border-b border-slate-700/60 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-orange-500/20 text-orange-400 rounded-lg ring-1 ring-orange-500/30">
                <FileText className="w-5 h-5" />
              </span>
              <h2 id="daily-report-title" className="text-xl font-bold tracking-tight text-white">
                2026 YTD Task — Daily Update Report
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl pl-1">
              Download clean executive reports of updates made on any day to share directly with your boss and management.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Controls Bar: Date Selector & Quick Filters */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="daily-report-date-picker" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
                <Calendar className="w-4 h-4 text-orange-500" />
                <span>Select Report Date:</span>
              </label>
              <input
                id="daily-report-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(todayDate)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  selectedDate === todayDate
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Today
              </button>
              {yesterdayDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(yesterdayDate)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    selectedDate === yesterdayDate
                      ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Yesterday
                </button>
              )}
            </div>

            {/* Download Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="download-daily-pdf-btn"
                onClick={handleDownloadPDF}
                className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-orange-500/20 transition-all hover:-translate-y-0.5"
                title="Open executive printable PDF formatted report"
              >
                <Printer className="w-4 h-4" />
                <span>Download PDF Report</span>
              </button>

              <button
                id="download-daily-csv-btn"
                onClick={handleDownloadCSV}
                className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all hover:-translate-y-0.5"
                title="Download formatted Excel/CSV spreadsheet"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Download Excel / CSV</span>
              </button>
            </div>
          </div>

          {/* Active Date Indicator & Mode Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 gap-2 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Report For: </span>
              <span className="text-sm font-bold text-slate-900">{formatLagosDateForDisplay(selectedDate)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs text-slate-600 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportMode === 'ALL_ACTIVE_SNAPSHOT'}
                  onChange={(e) => setReportMode(e.target.checked ? 'ALL_ACTIVE_SNAPSHOT' : 'UPDATES_ONLY')}
                  className="rounded text-orange-500 focus:ring-orange-500 h-3.5 w-3.5"
                />
                <span>Include full snapshot of all active tasks in PDF</span>
              </label>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-orange-50 border border-orange-200/80 p-3.5 rounded-xl">
              <div className="text-2xl font-black text-orange-600">{metrics.total}</div>
              <div className="text-xs font-bold text-orange-800 uppercase tracking-wide mt-0.5">
                Updates Logged
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200/80 p-3.5 rounded-xl">
              <div className="text-2xl font-black text-emerald-600">{metrics.completed}</div>
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide mt-0.5">
                Completed
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200/80 p-3.5 rounded-xl">
              <div className="text-2xl font-black text-blue-600">{metrics.inProgress}</div>
              <div className="text-xs font-bold text-blue-800 uppercase tracking-wide mt-0.5">
                Progress / Commenced
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <div className="text-2xl font-black text-slate-700">{metrics.created}</div>
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mt-0.5">
                New Tasks Created
              </div>
            </div>
          </div>

          {/* Table / Preview Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>Updates Preview ({updates.length} items)</span>
              </h3>
            </div>

            {updates.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-3">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto">
                  <h4 className="text-sm font-bold text-slate-800">No updates logged for this date</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    No task additions or status updates were recorded on {formatLagosDateForDisplay(selectedDate)}.
                    You can still download the report as an executive snapshot of all active tasks.
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReportMode('ALL_ACTIVE_SNAPSHOT');
                      handleDownloadPDF();
                    }}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold bg-white text-slate-800 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-100"
                  >
                    <Printer className="w-3.5 h-3.5 text-orange-500" />
                    <span>Download Active Tasks Snapshot (PDF)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Dept</th>
                        <th className="py-2.5 px-3">Task Description</th>
                        <th className="py-2.5 px-3">Lead / Co-Worker</th>
                        <th className="py-2.5 px-3">Action & Status</th>
                        <th className="py-2.5 px-3">Remarks / Notes</th>
                        <th className="py-2.5 px-3">Updated By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {updates.map((update) => {
                        const isCompleted =
                          update.action === 'COMPLETED' ||
                          (update.newStatus && update.newStatus.toLowerCase().includes('complete'));

                        return (
                          <tr key={update.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {formatLagosTime(update.timestamp)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px]">
                                {update.department}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 max-w-xs">
                              {update.taskDescription}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-semibold">{update.lead}</div>
                              {update.coWorker && (
                                <div className="text-[10px] text-slate-500">+ {update.coWorker}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase w-fit ${
                                    isCompleted
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : update.action === 'CREATED'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {update.action.replace('_', ' ')}
                                </span>
                                {update.previousStatus && update.previousStatus !== update.newStatus ? (
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <span>{update.previousStatus}</span>
                                    <ArrowRight className="w-2.5 h-2.5 text-orange-500" />
                                    <span className="font-bold text-slate-800">{update.newStatus}</span>
                                  </div>
                                ) : (
                                  <div className="text-[11px] font-medium text-slate-700">
                                    {update.newStatus || 'Updated'}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 italic max-w-xs truncate" title={update.newRemark}>
                              {update.newRemark || <span className="text-slate-400 not-italic">-</span>}
                            </td>
                            <td className="py-2.5 px-3 text-[10px] text-slate-500 whitespace-nowrap">
                              {update.updatedBy}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Tip: The PDF opens in a print preview with high-res formatting and lets you save directly as PDF to attach in an email.
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
