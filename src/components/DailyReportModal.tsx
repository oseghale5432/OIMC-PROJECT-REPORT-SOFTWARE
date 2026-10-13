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
  Info,
  Filter,
  Layers,
  Award
} from 'lucide-react';
import { YTDTask, TaskDailyUpdate } from '../types';
import {
  getCurrentLagosDate,
  formatLagosDateForDisplay,
  formatLagosDateShort,
  formatLagosTime,
  getUpdatesForDateRange,
  downloadDailyReportCSV,
  openDailyReportPrintPDF,
  ReportFilterType,
  ReportPeriod,
  ALL_MONTH_NAMES
} from '../utils/dailyReportUtils';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: YTDTask[];
  currentUserName?: string;
}

type DateMode = 'SINGLE' | 'RANGE' | 'MONTH';

export default function DailyReportModal({
  isOpen,
  onClose,
  tasks,
  currentUserName = 'Admin',
}: DailyReportModalProps) {
  const todayDate = useMemo(() => getCurrentLagosDate(), []);

  // Compute first day of current month (e.g., 2026-10-01)
  const currentMonthStart = useMemo(() => {
    try {
      const parts = todayDate.split('-');
      return `${parts[0]}-${parts[1]}-01`;
    } catch {
      return todayDate;
    }
  }, [todayDate]);

  // Mode States
  const [dateMode, setDateMode] = useState<DateMode>('RANGE');
  const [singleDate, setSingleDate] = useState<string>(todayDate);
  const [startDate, setStartDate] = useState<string>(currentMonthStart);
  const [endDate, setEndDate] = useState<string>(todayDate);
  const [selectedMonth, setSelectedMonth] = useState<string>('October');
  const [filterType, setFilterType] = useState<ReportFilterType>('ALL');
  const [includeActiveSnapshot, setIncludeActiveSnapshot] = useState(false);

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

  // Compute 7 days ago
  const sevenDaysAgoDate = useMemo(() => {
    try {
      const d = new Date();
      d.setDate(d.getDate() - 7);
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

  // Compute 30 days ago
  const thirtyDaysAgoDate = useMemo(() => {
    try {
      const d = new Date();
      d.setDate(d.getDate() - 30);
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

  // Active Computed Period
  const activePeriod: ReportPeriod = useMemo(() => {
    if (dateMode === 'SINGLE') {
      return {
        startDate: singleDate,
        endDate: singleDate,
        isRange: false,
      };
    } else if (dateMode === 'MONTH') {
      const year = todayDate.split('-')[0] || '2026';
      if (selectedMonth === 'ALL_2026') {
        return {
          startDate: `${year}-01-01`,
          endDate: todayDate,
          isRange: true,
          label: 'Full Year 2026 YTD',
        };
      }
      const monthIdx = ALL_MONTH_NAMES.indexOf(selectedMonth);
      if (monthIdx !== -1) {
        const mStr = String(monthIdx + 1).padStart(2, '0');
        // determine last day of that month
        const lastDay = new Date(Number(year), monthIdx + 1, 0).getDate();
        return {
          startDate: `${year}-${mStr}-01`,
          endDate: `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`,
          isRange: true,
          label: `${selectedMonth} ${year}`,
        };
      }
    }

    // Default RANGE
    return {
      startDate: startDate || todayDate,
      endDate: endDate || todayDate,
      isRange: startDate !== endDate,
    };
  }, [dateMode, singleDate, startDate, endDate, selectedMonth, todayDate]);

  // Query updates/tasks for current period & filter
  const items = useMemo(() => {
    return getUpdatesForDateRange(activePeriod.startDate, activePeriod.endDate, tasks, filterType);
  }, [activePeriod.startDate, activePeriod.endDate, tasks, filterType]);

  // Compute Summary KPI Metrics
  const metrics = useMemo(() => {
    const total = items.length;
    const completed = items.filter(
      (u) =>
        u.action === 'COMPLETED' ||
        (u.newStatus && (u.newStatus.toLowerCase().includes('complete') || u.newStatus.toLowerCase() === 'done'))
    ).length;
    const inProgress = items.filter(
      (u) =>
        u.action === 'STATUS_CHANGE' &&
        u.newStatus &&
        !u.newStatus.toLowerCase().includes('complete') &&
        !u.newStatus.toLowerCase().includes('not started')
    ).length;
    const created = items.filter((u) => u.action === 'CREATED').length;
    return { total, completed, inProgress, created };
  }, [items]);

  if (!isOpen) return null;

  const handleDownloadCSV = () => {
    downloadDailyReportCSV(activePeriod, items, tasks, filterType);
  };

  const handleDownloadPDF = () => {
    const mode = includeActiveSnapshot ? 'ALL_ACTIVE_SNAPSHOT' : 'UPDATES_ONLY';
    openDailyReportPrintPDF(activePeriod, items, tasks, currentUserName, mode, filterType);
  };

  // Preset button handlers
  const setRangeToday = () => {
    setDateMode('RANGE');
    setStartDate(todayDate);
    setEndDate(todayDate);
  };

  const setRangeLast7Days = () => {
    setDateMode('RANGE');
    setStartDate(sevenDaysAgoDate);
    setEndDate(todayDate);
  };

  const setRangeMonthToDate = () => {
    setDateMode('RANGE');
    setStartDate(currentMonthStart);
    setEndDate(todayDate);
  };

  const setRangeLast30Days = () => {
    setDateMode('RANGE');
    setStartDate(thirtyDaysAgoDate);
    setEndDate(todayDate);
  };

  const setRangeYearToDate = () => {
    setDateMode('RANGE');
    const year = todayDate.split('-')[0] || '2026';
    setStartDate(`${year}-01-01`);
    setEndDate(todayDate);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-5xl my-6 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-5 sm:p-6 flex items-start justify-between border-b border-slate-800 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-orange-500/20 text-orange-400 rounded-lg ring-1 ring-orange-500/30">
                <FileText className="w-5 h-5" />
              </span>
              <h2 id="report-modal-title" className="text-xl font-bold tracking-tight text-white">
                2026 YTD Task — Progress & Updates Report
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl pl-1">
              Generate and download executive reports for a single day, custom date range, or specific months to share with your boss and executive management.
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
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Top Control Panel */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200/90 space-y-4">
            {/* Row 1: Mode Switcher + Scope Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              {/* Date Mode Segmented Control */}
              <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setDateMode('RANGE')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    dateMode === 'RANGE'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📅 Date Range
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode('SINGLE')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    dateMode === 'SINGLE'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📆 Single Date
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode('MONTH')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    dateMode === 'MONTH'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🗓️ Month View
                </button>
              </div>

              {/* Scope / Filter Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-orange-500" />
                  <span>Report Scope:</span>
                </span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as ReportFilterType)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="ALL">All Updates & Activity</option>
                  <option value="COMPLETED_ONLY">🏆 Completed Projects Only</option>
                  <option value="IN_PROGRESS">⏳ Ongoing & In Progress</option>
                </select>
              </div>
            </div>

            {/* Row 2: Date Inputs & Quick Presets based on Active Mode */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* SINGLE DATE CONTROLS */}
              {dateMode === 'SINGLE' && (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="single-date-input" className="text-xs font-bold text-slate-700">
                    Select Date:
                  </label>
                  <input
                    id="single-date-input"
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-800 shadow-sm focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setSingleDate(todayDate)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                      singleDate === todayDate
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Today
                  </button>
                  {yesterdayDate && (
                    <button
                      type="button"
                      onClick={() => setSingleDate(yesterdayDate)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                        singleDate === yesterdayDate
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Yesterday
                    </button>
                  )}
                </div>
              )}

              {/* DATE RANGE CONTROLS */}
              {dateMode === 'RANGE' && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="range-from-date" className="text-xs font-bold text-slate-700">
                      From:
                    </label>
                    <input
                      id="range-from-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-800 shadow-sm focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="range-to-date" className="text-xs font-bold text-slate-700">
                      To:
                    </label>
                    <input
                      id="range-to-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-800 shadow-sm focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {/* Range Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1 pl-1">
                    <button
                      type="button"
                      onClick={setRangeToday}
                      className="px-2 py-1 text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 rounded hover:bg-slate-100"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={setRangeLast7Days}
                      className="px-2 py-1 text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 rounded hover:bg-slate-100"
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={setRangeMonthToDate}
                      className="px-2 py-1 text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 rounded hover:bg-slate-100"
                    >
                      Month-to-Date
                    </button>
                    <button
                      type="button"
                      onClick={setRangeLast30Days}
                      className="px-2 py-1 text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 rounded hover:bg-slate-100"
                    >
                      Last 30 Days
                    </button>
                    <button
                      type="button"
                      onClick={setRangeYearToDate}
                      className="px-2 py-1 text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200 rounded hover:bg-orange-100"
                    >
                      2026 YTD
                    </button>
                  </div>
                </div>
              )}

              {/* MONTH SELECT CONTROLS */}
              {dateMode === 'MONTH' && (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="month-select-dropdown" className="text-xs font-bold text-slate-700">
                    Select Month:
                  </label>
                  <select
                    id="month-select-dropdown"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white text-slate-800 shadow-sm focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="ALL_2026">Full Year 2026 (All Months YTD)</option>
                    {ALL_MONTH_NAMES.map((m) => (
                      <option key={m} value={m}>
                        {m} 2026
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Download Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="download-pdf-report-btn"
                  onClick={handleDownloadPDF}
                  className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-bold shadow-md shadow-orange-500/20 transition-all hover:-translate-y-0.5"
                  title="Open print-ready executive PDF formatted report"
                >
                  <Printer className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>

                <button
                  id="download-csv-report-btn"
                  onClick={handleDownloadCSV}
                  className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-bold shadow-md transition-all hover:-translate-y-0.5"
                  title="Download formatted Excel/CSV spreadsheet"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Download Excel/CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Period Indicator & Options */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 gap-2 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Report Period: </span>
              <span className="text-sm font-bold text-slate-900">
                {activePeriod.isRange
                  ? `${formatLagosDateShort(activePeriod.startDate)} to ${formatLagosDateShort(activePeriod.endDate)}`
                  : formatLagosDateForDisplay(activePeriod.startDate)}
              </span>
              {filterType === 'COMPLETED_ONLY' && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  🏆 Completed Projects
                </span>
              )}
            </div>

            <label className="text-xs text-slate-600 flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeActiveSnapshot}
                onChange={(e) => setIncludeActiveSnapshot(e.target.checked)}
                className="rounded text-orange-500 focus:ring-orange-500 h-3.5 w-3.5"
              />
              <span>Append current active tasks snapshot in PDF</span>
            </label>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-orange-50 border border-orange-200/80 p-3.5 rounded-xl">
              <div className="text-2xl font-black text-orange-600">{metrics.total}</div>
              <div className="text-xs font-bold text-orange-800 uppercase tracking-wide mt-0.5">
                Total in Period
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
                In Progress
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <div className="text-2xl font-black text-slate-700">{metrics.created}</div>
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mt-0.5">
                Newly Added
              </div>
            </div>
          </div>

          {/* Table / Preview Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Report Preview ({items.length} {filterType === 'COMPLETED_ONLY' ? 'Completed Tasks' : 'Items'})
                </span>
              </h3>
            </div>

            {items.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-3">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto">
                  <h4 className="text-sm font-bold text-slate-800">No items match this period and filter</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    No task updates or completed projects were recorded between {formatLagosDateShort(activePeriod.startDate)} and {formatLagosDateShort(activePeriod.endDate)}.
                    Try widening the date range, selecting "Full Year 2026", or switching the scope filter to "All Updates".
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={setRangeYearToDate}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>View All 2026 Completed Projects</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeActiveSnapshot(true);
                      handleDownloadPDF();
                    }}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold bg-white text-slate-800 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-100"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
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
                        <th className="py-2.5 px-3">{activePeriod.isRange ? 'Date' : 'Time'}</th>
                        <th className="py-2.5 px-3">Dept</th>
                        <th className="py-2.5 px-3">Task Description</th>
                        <th className="py-2.5 px-3">Lead / Co-Worker</th>
                        <th className="py-2.5 px-3">Contractor Head</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Remarks / Accomplishments</th>
                        <th className="py-2.5 px-3">Logged By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {items.map((item) => {
                        const isCompleted =
                          item.action === 'COMPLETED' ||
                          (item.newStatus && item.newStatus.toLowerCase().includes('complete'));

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {activePeriod.isRange ? item.date : formatLagosTime(item.timestamp)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px]">
                                {item.department}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 max-w-xs">
                              {item.taskDescription}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-semibold">{item.lead}</div>
                              {item.coWorker && (
                                <div className="text-[10px] text-slate-500">+ {item.coWorker}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              {item.contractorHead || '-'}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase w-fit ${
                                    isCompleted
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : item.action === 'CREATED'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {isCompleted ? 'Completed' : item.action.replace('_', ' ')}
                                </span>
                                {item.previousStatus && item.previousStatus !== item.newStatus ? (
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <span>{item.previousStatus}</span>
                                    <ArrowRight className="w-2.5 h-2.5 text-orange-500" />
                                    <span className="font-bold text-slate-800">{item.newStatus}</span>
                                  </div>
                                ) : (
                                  <div className="text-[11px] font-medium text-slate-700">
                                    {item.newStatus || 'Updated'}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={item.newRemark}>
                              {item.newRemark || <span className="text-slate-400 italic">No notes</span>}
                            </td>
                            <td className="py-2.5 px-3 text-[10px] text-slate-500 whitespace-nowrap">
                              {item.updatedBy}
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
              You can download this as an executive printable PDF or an Excel spreadsheet to send directly to your boss.
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
