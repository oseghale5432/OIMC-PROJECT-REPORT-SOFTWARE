/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Save, 
  User, 
  Lock,
  CheckCircle,
  Clock,
  Link2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  Plus,
  Compass,
  ArrowRight
} from 'lucide-react';
import { StaffMember, MonthProgress, TaskItem, YTDTask } from '../types';
import { MONTHS } from '../data/mockData';

interface StaffProgressPageProps {
  staffList: StaffMember[];
  progressReports: MonthProgress[];
  simulatedEmail: string;
  onSimulateEmailChange: (email: string) => void;
  onSaveProgress: (email: string, updatedReports: MonthProgress[], updatedYTDTasks?: YTDTask[]) => void;
  isAdmin: boolean;
  tasks: YTDTask[];
  statuses: string[];
}

export default function StaffProgressPage({
  staffList,
  progressReports,
  simulatedEmail,
  onSimulateEmailChange,
  onSaveProgress,
  isAdmin,
  tasks,
  statuses,
}: StaffProgressPageProps) {
  // Find currently selected staff (excluding Admin Boss from selection unless they are simulating someone)
  const trackingStaffList = staffList.filter((s) => s.role !== 'admin');
  const currentStaff = trackingStaffList.find((s) => s.email === simulatedEmail) || trackingStaffList[0] || staffList[0];
  
  // Local state for selected month to edit
  const [activeMonth, setActiveMonth] = useState<string>('May');

  // Filter progress reports for this specific staff member
  const staffReports = progressReports.filter((r) => r.staffEmail === currentStaff.email);

  // Local state of the reports and YTD tasks being edited
  const [editedReports, setEditedReports] = useState<MonthProgress[]>([]);
  const [editedYTDTasks, setEditedYTDTasks] = useState<YTDTask[]>([]);
  const [lastEmail, setLastEmail] = useState<string>('');
  const [lastTasks, setLastTasks] = useState<YTDTask[]>([]);

  // Sync state if simulated user changes
  if (currentStaff.email !== lastEmail) {
    setEditedReports(JSON.parse(JSON.stringify(staffReports)));
    setLastEmail(currentStaff.email);
  }

  // Sync YTD tasks list if parent tasks prop changes
  if (tasks !== lastTasks) {
    setEditedYTDTasks(JSON.parse(JSON.stringify(tasks)));
    setLastTasks(tasks);
  }

  // Handle linking a task to a YTD task
  const handleLinkYTDTask = (month: string, taskIdx: number, ytdTaskId: string) => {
    setEditedReports((prev) => 
      prev.map((r) => {
        if (r.month === month) {
          const updatedTasks = [...r.tasks];
          const oldTask = updatedTasks[taskIdx] || { description: '', completed: null };
          
          if (ytdTaskId === '') {
            // Unlink task
            updatedTasks[taskIdx] = {
              description: '',
              completed: null,
              ytdTaskId: undefined,
            };
          } else {
            // Find linked YTD task description
            const ytdTask = editedYTDTasks.find((t) => t.id === ytdTaskId);
            updatedTasks[taskIdx] = {
              description: ytdTask ? ytdTask.description : '',
              completed: oldTask.completed !== null ? oldTask.completed : false,
              ytdTaskId: ytdTaskId,
            };
          }
          return { ...r, tasks: updatedTasks };
        }
        return r;
      })
    );
  };

  // Handle task description text change (only for custom/unlinked tasks)
  const handleDescriptionChange = (month: string, taskIdx: number, text: string) => {
    setEditedReports((prev) => 
      prev.map((r) => {
        if (r.month === month) {
          const updatedTasks = [...r.tasks];
          const oldTask = updatedTasks[taskIdx] || { description: '', completed: null };
          
          let comp = oldTask.completed;
          if (text === '') {
            comp = null;
          } else if (oldTask.description === '' && text !== '') {
            comp = false;
          }

          updatedTasks[taskIdx] = {
            ...oldTask,
            description: text,
            completed: comp,
          };
          return { ...r, tasks: updatedTasks };
        }
        return r;
      })
    );
  };

  // Toggle completed status (completed: true, incomplete: false, no task: null)
  const handleStatusToggle = (month: string, taskIdx: number) => {
    setEditedReports((prev) => 
      prev.map((r) => {
        if (r.month === month) {
          const updatedTasks = [...r.tasks];
          const task = updatedTasks[taskIdx];
          
          if (task && (task.description || task.ytdTaskId)) {
            let nextCompleted = false;
            if (task.completed === false) {
              nextCompleted = true; // Complete
            } else if (task.completed === true) {
              nextCompleted = false; // Incomplete
            }

            updatedTasks[taskIdx] = {
              ...task,
              completed: nextCompleted,
            };
          }
          return { ...r, tasks: updatedTasks };
        }
        return r;
      })
    );
  };

  // Update Status of linked YTD Task
  const handleUpdateLinkedStatus = (ytdTaskId: string, newStatus: string) => {
    setEditedYTDTasks((prev) =>
      prev.map((t) => (t.id === ytdTaskId ? { ...t, status: newStatus } : t))
    );
  };

  // Update Remark of linked YTD Task
  const handleUpdateLinkedRemark = (ytdTaskId: string, newRemark: string) => {
    setEditedYTDTasks((prev) =>
      prev.map((t) => (t.id === ytdTaskId ? { ...t, remark: newRemark } : t))
    );
  };

  const handleSave = () => {
    const confirmed = window.confirm(`Save changes to ${currentStaff.name}'s progress tracker workbook sheets?`);
    if (confirmed) {
      onSaveProgress(currentStaff.email, editedReports, editedYTDTasks);
      alert('Progress reports and linked YTD tasks updated successfully!');
    }
  };

  // Get active report
  const activeReport = editedReports.find((r) => r.month === activeMonth);

  return (
    <div className="space-y-6">
      {/* Top Header Controls bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-150 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSave}
            className="bg-red-700 hover:bg-red-800 text-white font-sans font-extrabold text-xs tracking-wider px-6 py-2.5 rounded shadow-md border-b-4 border-red-900 transition-all active:transform active:translate-y-0.5"
          >
            SAVE & CLOSE WORKBOOK
          </button>

          <div className="hidden sm:flex items-center space-x-1 border-l pl-3 border-slate-200">
            <span className="font-sans font-bold text-slate-800 text-xs tracking-tight uppercase">
              ORANGE ISLAND WORKBOOK
            </span>
          </div>
        </div>

        {/* Employee Switcher */}
        <div className="flex items-center space-x-2">
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Employee Workspace:</span>
          {isAdmin ? (
            <select
              value={currentStaff.email}
              onChange={(e) => onSimulateEmailChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {trackingStaffList.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="bg-slate-100 border border-slate-200 text-slate-800 rounded-lg py-1 px-3 text-xs font-extrabold flex items-center space-x-1">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>{currentStaff.label} (LOCKED)</span>
            </div>
          )}
        </div>
      </div>

      {/* Ribbon Instructions */}
      <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <span className="font-bold text-orange-400 uppercase tracking-wider block">Interactive Progress Logger</span>
          <p className="text-slate-300">
            Select a month below to view your progress workbook. For each task slot, you can create a custom task, or <span className="text-orange-300 font-bold">Link to 2026 YTD tasks</span>. When linked, entering the status and remarks updates the master project sheets dynamically!
          </p>
        </div>
        <div className="bg-slate-800 px-3.5 py-2 rounded-lg font-mono text-[10px] text-slate-300 border border-slate-700 min-w-[200px]">
          <div>Employee: <span className="font-bold text-orange-400">{currentStaff.name}</span></div>
          <div>Department: <span className="font-bold text-white">{currentStaff.department}</span></div>
          <div>Month: <span className="font-bold text-emerald-400">{activeMonth.toUpperCase()} 2026</span></div>
        </div>
      </div>

      {/* Month Selection Ribbon */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-2 overflow-x-auto scrollbar-hide">
        <div className="flex items-center space-x-1 px-2 text-slate-400 border-r border-slate-100 mr-1 shrink-0">
          <Calendar className="w-4 h-4 text-orange-500" />
          <span className="font-sans font-bold text-[10px] uppercase tracking-wider">Sheets</span>
        </div>
        <div className="flex space-x-1 shrink-0">
          {MONTHS.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMonth(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
                activeMonth === m
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/10'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {m.substring(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Active Monthly Worksheet */}
      {activeReport ? (
        <div className="space-y-6">
          {/* Section Header */}
          <div className="bg-black text-white p-3.5 rounded-t-xl font-sans font-extrabold text-sm tracking-widest flex items-center justify-between uppercase">
            <span>{activeMonth.toUpperCase()} 2026 PROGRESS SHEET</span>
            <span className="font-mono text-[9px] text-slate-400">Total: 15 Task Slots</span>
          </div>

          {/* Cards List for 15 Slots */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 15 }, (_, i) => {
              const task = activeReport.tasks[i] || { description: '', completed: null, ytdTaskId: undefined };
              const isLinked = !!task.ytdTaskId;
              
              // Get the current linked YTD task information
              const linkedYTDTask = isLinked ? editedYTDTasks.find((t) => t.id === task.ytdTaskId) : null;

              return (
                <div 
                  key={i} 
                  id={`task-card-${i}`}
                  className={`bg-white rounded-xl p-5 border shadow-sm transition-all duration-200 flex flex-col justify-between space-y-4 ${
                    task.completed === true 
                      ? 'border-emerald-200 hover:shadow-emerald-50 bg-emerald-50/5' 
                      : task.completed === false
                      ? 'border-rose-200 hover:shadow-rose-50 bg-rose-50/5'
                      : 'border-slate-150 hover:shadow-slate-50'
                  }`}
                >
                  {/* Card Header Info */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600 font-mono">
                        {i + 1}
                      </span>
                      <h4 className="font-sans font-bold text-slate-700 text-xs uppercase tracking-wide">
                        Task Slot #{i + 1}
                      </h4>
                    </div>

                    {/* Task Source Type Selector */}
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Source:</span>
                      <select
                        value={isLinked ? 'ytd' : 'custom'}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            handleLinkYTDTask(activeMonth, i, '');
                          } else {
                            // Automatically link to first matching task or empty string
                            handleLinkYTDTask(activeMonth, i, 'CHOOSE');
                          }
                        }}
                        className="bg-slate-50 border border-slate-200 rounded py-0.5 px-2 text-[10px] font-semibold text-slate-600 focus:outline-none"
                      >
                        <option value="custom">Custom Task</option>
                        <option value="ytd">Link YTD Task</option>
                      </select>
                    </div>
                  </div>

                  {/* Card Main Body */}
                  <div className="space-y-3 flex-1">
                    {isLinked ? (
                      /* LINKED YTD TASK INTERFACE */
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-orange-500 uppercase tracking-wider flex items-center space-x-1">
                            <Link2 className="w-3 h-3" />
                            <span>Linked 2026 YTD Project Task</span>
                          </label>
                          
                          {/* YTD Selector */}
                          <select
                            value={task.ytdTaskId || ''}
                            onChange={(e) => handleLinkYTDTask(activeMonth, i, e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="">-- Choose YTD Task to Link --</option>
                            <option value="CHOOSE" disabled hidden>-- Choose YTD Task to Link --</option>
                            {editedYTDTasks.map((t) => (
                              <option key={t.id} value={t.id}>
                                [{t.department}] {t.description.substring(0, 50)}... ({t.lead})
                              </option>
                            ))}
                          </select>
                        </div>

                        {linkedYTDTask ? (
                          /* DISPLAY LINKED TASK DETAILED INFORMATION & DIRECT STATUS/REMARK INPUT */
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 space-y-3">
                            <p className="text-xs font-medium text-slate-700 italic leading-relaxed">
                              "{linkedYTDTask.description}"
                            </p>
                            
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                              {/* Status Link Column */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">YTD Status Column</label>
                                <select
                                  value={linkedYTDTask.status || ''}
                                  onChange={(e) => handleUpdateLinkedStatus(linkedYTDTask.id, e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-semibold text-slate-700 focus:outline-none"
                                >
                                  <option value="">Not set</option>
                                  {statuses.map((stat) => (
                                    <option key={stat} value={stat}>{stat}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Remark Link Column */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">YTD Remark Column</label>
                                <input
                                  type="text"
                                  value={linkedYTDTask.remark || ''}
                                  onChange={(e) => handleUpdateLinkedRemark(linkedYTDTask.id, e.target.value)}
                                  placeholder="e.g. Completed phase 1"
                                  className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-semibold text-slate-700 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          task.ytdTaskId !== 'CHOOSE' && (
                            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg flex items-center space-x-2 text-amber-800 text-[11px]">
                              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>This task link seems to refer to a deleted or missing YTD Task!</span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      /* CUSTOM UNLINKED TASK INTERFACE */
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Task Description</label>
                        <textarea
                          value={task.description}
                          onChange={(e) => handleDescriptionChange(activeMonth, i, e.target.value)}
                          placeholder={`Type task details completed during ${activeMonth}...`}
                          rows={2}
                          className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:ring-1 focus:ring-orange-500 rounded-lg p-2 text-xs font-medium text-slate-700 focus:outline-none transition-all resize-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Card Footer Completion Status Toggle */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Workbook State</span>
                    
                    {(task.description !== '' || isLinked) ? (
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(activeMonth, i)}
                        className={`px-3 py-1.5 rounded-lg font-sans font-bold text-[10px] tracking-wider uppercase transition-all duration-150 border flex items-center space-x-1.5 ${
                          task.completed === true
                            ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-sm shadow-emerald-500/15'
                            : 'bg-slate-100 text-slate-500 border-slate-250 hover:bg-slate-200'
                        }`}
                      >
                        {task.completed === true ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>COMPLETED</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>PENDING</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-slate-350 italic text-[10px]">Empty Slot</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-150 p-12 rounded-xl text-center text-slate-400 space-y-2 flex flex-col items-center justify-center">
          <AlertCircle className="w-10 h-10 text-slate-300 animate-pulse" />
          <h3 className="font-sans font-bold text-slate-700 text-sm">Month Sheet Not Found</h3>
          <p className="text-xs">No progress report is allocated for this employee on this month.</p>
        </div>
      )}

      {/* Floating Save button for mobile/large scroll views */}
      <div className="fixed bottom-6 right-6 z-50 shadow-2xl rounded-full">
        <button
          onClick={handleSave}
          className="bg-red-700 hover:bg-red-800 text-white font-sans font-bold text-xs tracking-wider py-3.5 px-6 rounded-full flex items-center space-x-2 border-b-4 border-red-900 shadow-xl transition-all active:transform active:translate-y-0.5"
        >
          <Save className="w-4 h-4" />
          <span>SAVE WORKBOOK DATA</span>
        </button>
      </div>
    </div>
  );
}
