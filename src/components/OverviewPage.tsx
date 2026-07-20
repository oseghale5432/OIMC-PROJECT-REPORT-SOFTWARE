/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Calendar,
  Layers,
  FileText,
  Clock,
  Plus,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Search,
  UserPlus,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { StaffMember, MonthProgress } from '../types';
import { MONTHS } from '../data/mockData';

interface OverviewPageProps {
  staffList: StaffMember[];
  progressReports: MonthProgress[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onNavigateToStaff: (email: string) => void;
  onAddStaff: (newStaff: StaffMember) => void;
  onUpdateStaff: (updatedStaff: StaffMember) => void;
  onDeleteStaff: (email: string) => void;
  currentUser: any;
  departments: string[];
  statuses: string[];
  contractorHeads: string[];
  accountingCodes: string[];
  onUpdateDepartments: (depts: string[]) => void;
  onUpdateStatuses: (stats: string[]) => void;
  onUpdateContractorHeads: (contractorHeads: string[]) => void;
  onUpdateAccountingCodes: (accountingCodes: string[]) => void;
}

export default function OverviewPage({
  staffList,
  progressReports,
  selectedMonth,
  onMonthChange,
  onNavigateToStaff,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  currentUser,
  departments,
  statuses,
  contractorHeads,
  accountingCodes,
  onUpdateDepartments,
  onUpdateStatuses,
  onUpdateContractorHeads,
  onUpdateAccountingCodes,
}: OverviewPageProps) {
  // Sub-tabs within overview page
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'staff' | 'dropdowns'>('analytics');

  // Staff search state
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // New staff form fields
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('PROJECTS');
  const [newActivity, setNewActivity] = useState('PROJECTS');
  const [newRole, setNewRole] = useState<'staff' | 'admin'>('staff');
  const [newPassword, setNewPassword] = useState('password123');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const isSuperAdmin = currentUser?.email?.toLowerCase() === 'oseghale5432@gmail.com';
  const loggedInStaffProfile = staffList.find((s) => s.email.toLowerCase() === currentUser?.email?.toLowerCase());
  const isAdmin = !currentUser || isSuperAdmin || loggedInStaffProfile?.role === 'admin';

  const handleDeptChange = (dept: string) => {
    setNewDept(dept);
    const mapping: Record<string, string> = {
      'PROJECTS': 'PROJECTS',
      'FACILITIES': 'FACILITIES',
      'DEVELOPMENT': 'DEVELOP',
      'ELECTRICAL': 'ELECTRICAL',
      'HSE / PROCUREMENT': 'HSE / PROC',
      'SECURITY': 'SECURITY',
      'GARDENING': 'GARDENING',
      'ADMIN': 'ADMIN',
      'MANAGEMENT': 'SUPER ADMIN',
      'ICT': 'ICT'
    };
    setNewActivity(mapping[dept] || dept);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) return;

    if (staffList.some(s => s.email.toLowerCase() === newEmail.toLowerCase())) {
      alert('This email address is already registered in the roster database!');
      return;
    }

    const newStaff: StaffMember = {
      email: newEmail.trim().toLowerCase(),
      name: newName.trim(),
      department: newDept,
      activity: newActivity.trim(),
      label: `${newName.trim()} (${newDept})`,
      isNew: true,
      role: newRole,
      password: newPassword.trim() || 'password123',
      isFirstLogin: true,
    };

    onAddStaff(newStaff);
    alert(`Successfully registered ${newName} as ${newRole.toUpperCase()}!`);
    
    // Reset form
    setNewEmail('');
    setNewName('');
    setNewPassword('password123');
    setShowAddForm(false);
  };

  const handleToggleRole = (staff: StaffMember) => {
    const nextRole = staff.role === 'admin' ? 'staff' : 'admin';
    const confirmed = window.confirm(`Change system role of ${staff.name} to ${nextRole.toUpperCase()}?`);
    if (confirmed) {
      onUpdateStaff({
        ...staff,
        role: nextRole
      });
      alert(`Role updated successfully to ${nextRole.toUpperCase()}`);
    }
  };

  const handleDeleteClick = (email: string, name: string) => {
    const confirmed = window.confirm(`Are you absolutely sure you want to remove ${name} (${email}) from the tracker database?\n\nThis will also delete all of their monthly progress report sheets! This action cannot be undone.`);
    if (confirmed) {
      onDeleteStaff(email);
      alert('Staff member removed successfully.');
    }
  };

  // Compute metrics for the selected month
  const reportsForMonth = progressReports.filter((r) => r.month === selectedMonth);

  // Filter out administrator profiles from progress reports tracking
  const trackingStaffList = staffList.filter((s) => s.role !== 'admin');

  // Compute calculated values for each staff member for the grid
  const gridData = trackingStaffList.map((staff) => {
    const report = reportsForMonth.find((r) => r.staffEmail === staff.email);
    
    let totalActiveTasks = 0;
    let completedTasks = 0;
    let incompleteTasks = 0;
    
    const taskStates = Array.from({ length: 15 }, (_, i) => {
      const task = report?.tasks[i];
      if (task && task.completed !== null) {
        totalActiveTasks++;
        if (task.completed) {
          completedTasks++;
          return 1;
        } else {
          incompleteTasks++;
          return 0;
        }
      }
      return -1; // No task
    });

    const donePercentage = totalActiveTasks > 0 ? Math.round((completedTasks / totalActiveTasks) * 100) : 0;
    const todoPercentage = totalActiveTasks > 0 ? Math.round((incompleteTasks / totalActiveTasks) * 100) : 0;

    return {
      staff,
      report,
      taskStates,
      totalActiveTasks,
      completedTasks,
      incompleteTasks,
      donePercentage,
      todoPercentage,
    };
  });

  // Aggregate metrics
  const totalEmployees = trackingStaffList.length;
  
  const staffWithTasks = gridData.filter((g) => g.totalActiveTasks > 0);
  const avgCompletion = staffWithTasks.length > 0 
    ? Math.round(staffWithTasks.reduce((sum, g) => sum + g.donePercentage, 0) / staffWithTasks.length)
    : 0;

  const avgTodo = staffWithTasks.length > 0
    ? Math.round(staffWithTasks.reduce((sum, g) => sum + g.todoPercentage, 0) / staffWithTasks.length)
    : 0;

  // Compute department-specific metrics for the chart
  const deptStats: Record<string, { totalDone: number; totalTodo: number; count: number }> = {};
  gridData.forEach((item) => {
    if (item.totalActiveTasks > 0) {
      const dept = item.staff.department;
      if (!deptStats[dept]) {
        deptStats[dept] = { totalDone: 0, totalTodo: 0, count: 0 };
      }
      deptStats[dept].totalDone += item.donePercentage;
      deptStats[dept].totalTodo += item.todoPercentage;
      deptStats[dept].count += 1;
    }
  });

  const chartData = Object.keys(deptStats).map((dept) => ({
    name: dept,
    'Completion Rate (%)': Math.round(deptStats[dept].totalDone / deptStats[dept].count),
    'Pending Rate (%)': Math.round(deptStats[dept].totalTodo / deptStats[dept].count),
  }));

  // Filter roster list based on search
  const filteredStaff = staffList.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sub-tab Selection Bar */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`pb-3 px-6 font-sans text-sm font-bold tracking-wide border-b-2 transition-all ${
            activeSubTab === 'analytics'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4" />
            <span>REAL-TIME PERFORMANCE ANALYTICS</span>
          </div>
        </button>
        {isAdmin && (
          <>
            <button
              onClick={() => setActiveSubTab('staff')}
              className={`pb-3 px-6 font-sans text-sm font-bold tracking-wide border-b-2 transition-all ${
                activeSubTab === 'staff'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>STAFF & ADMINS ROSTER</span>
              </div>
            </button>
            <button
              onClick={() => setActiveSubTab('dropdowns')}
              className={`pb-3 px-6 font-sans text-sm font-bold tracking-wide border-b-2 transition-all ${
                activeSubTab === 'dropdowns'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4" />
                <span>SYSTEM DROPDOWNS CONFIG</span>
              </div>
            </button>
          </>
        )}
      </div>

      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          {/* Months Ribbon */}
          <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-sm overflow-x-auto scrollbar-hide flex items-center space-x-2">
            <div className="flex items-center space-x-2 border-r border-slate-800 pr-3 mr-1 text-orange-400">
              <Calendar className="w-4 h-4" />
              <span className="font-sans font-bold text-xs uppercase tracking-wider">Months</span>
            </div>
            <div className="flex space-x-1.5 min-w-[900px] md:min-w-0">
              {MONTHS.map((month) => (
                <button
                  key={month}
                  onClick={() => onMonthChange(month)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    selectedMonth === month
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {month.toUpperCase()} 2026
                </button>
              ))}
            </div>
          </div>

          {/* Analytics Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Staff */}
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Staff</span>
                <div className="font-sans font-extrabold text-3xl text-slate-800">{totalEmployees}</div>
                <p className="text-[10px] text-slate-400 font-medium">Active progress logs</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center text-orange-500">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Avg Completion */}
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Done %</span>
                <div className="font-sans font-extrabold text-3xl text-emerald-600">{avgCompletion}%</div>
                <p className="text-[10px] text-emerald-600 font-medium">Tasks marked completed</p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* Pending Workload */}
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average To Do %</span>
                <div className="font-sans font-extrabold text-3xl text-sky-600">{avgTodo}%</div>
                <p className="text-[10px] text-sky-600 font-medium">Tasks currently pending</p>
              </div>
              <div className="w-12 h-12 bg-sky-50 rounded-lg flex items-center justify-center text-sky-500">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* Active Capacity */}
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Report Month</span>
                <div className="font-sans font-extrabold text-2xl text-slate-800 uppercase tracking-tight">{selectedMonth} 2026</div>
                <p className="text-[10px] text-slate-400 font-medium">Real-time dynamic monitoring</p>
              </div>
              <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
                <Layers className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Analytics Charts */}
          {chartData.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
              <h3 className="font-sans font-bold text-slate-800 text-sm mb-4 uppercase tracking-wider flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <span>Project Health Metrics by Department ({selectedMonth})</span>
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="Completion Rate (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pending Rate (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* STAFF TASK MONITORING - GRID VIEW */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse"></div>
                <h2 className="font-sans font-bold text-slate-800 text-sm uppercase">
                  STAFF TASK MONITORING SHEET - {selectedMonth.toUpperCase()} 2026
                </h2>
              </div>
              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-1.5 text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Completed</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-500">
                  <XCircle className="w-3.5 h-3.5 text-red-600" />
                  <span>Not Done</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-500">
                  <span className="w-2.5 h-2.5 bg-slate-200 rounded"></span>
                  <span>No Task</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-slate-600 min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs font-bold uppercase">
                    <th className="py-3 px-4 border-r border-slate-800">Staff Name</th>
                    <th className="py-3 px-3 border-r border-slate-800 text-center bg-red-950/20 text-red-500 w-16">To Do %</th>
                    <th className="py-3 px-3 border-r border-slate-800 text-center bg-blue-950/20 text-blue-500 w-16">Done %</th>
                    <th className="py-3 px-4 border-r border-slate-800">Activity</th>
                    {Array.from({ length: 15 }, (_, i) => (
                      <th key={i} className="py-3 px-1 border-r border-slate-850 text-center font-mono text-[10px] w-12">
                        T{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans text-xs">
                  {gridData.map(({ staff, report, taskStates, totalActiveTasks, completedTasks, donePercentage, todoPercentage }) => {
                    return (
                      <tr 
                        key={staff.email} 
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Staff Name with click action to jump to their sheet */}
                        <td className="p-3 border-r border-slate-100 font-semibold text-slate-800 flex items-center justify-between">
                          <button
                            onClick={() => onNavigateToStaff(staff.email)}
                            className="hover:text-orange-500 flex items-center space-x-1 text-left"
                          >
                            <span>{staff.name}</span>
                            {staff.isNew && (
                              <span className="ml-1 px-1 py-0.2 bg-orange-100 text-orange-700 text-[8px] font-bold rounded uppercase">
                                NEW
                              </span>
                            )}
                          </button>
                          <span className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            View Sheet
                          </span>
                        </td>

                        {/* To Do % */}
                        <td className="p-3 border-r border-slate-100 text-center font-bold bg-red-50/30 text-red-600 font-mono text-[11px]">
                          {totalActiveTasks > 0 ? `${todoPercentage}%` : <span className="text-slate-300">-</span>}
                        </td>

                        {/* Done % */}
                        <td className="p-3 border-r border-slate-100 text-center font-bold bg-sky-50/30 text-sky-600 font-mono text-[11px]">
                          {totalActiveTasks > 0 ? `${donePercentage}%` : <span className="text-slate-300">-</span>}
                        </td>

                        {/* Activity Category */}
                        <td className="p-3 border-r border-slate-100 font-medium text-slate-500 uppercase tracking-tight text-[10px]">
                          {staff.activity}
                        </td>

                        {/* Task grid columns (Task 1 to Task 15) */}
                        {taskStates.map((state, i) => {
                          const taskItem = report?.tasks[i];
                          const tooltipText = taskItem?.description 
                            ? `Task ${i + 1}: "${taskItem.description}" - ${taskItem.completed ? 'COMPLETED' : 'PENDING'}` 
                            : `Task ${i + 1}: No task assigned`;

                          let bgClass = 'bg-slate-100/60 text-slate-300';
                          let content: React.ReactNode = '';

                          if (state === 1) {
                            bgClass = 'bg-emerald-50 text-emerald-600 rounded border border-emerald-200';
                            content = <CheckCircle2 className="w-4 h-4" />;
                          } else if (state === 0) {
                            bgClass = 'bg-red-50 text-red-600 rounded border border-red-200';
                            content = <XCircle className="w-4 h-4" />;
                          }

                          return (
                            <td 
                              key={i} 
                              className="p-1 border-r border-slate-100 text-center font-mono align-middle"
                              title={tooltipText}
                            >
                              <div className={`w-7 h-7 mx-auto flex items-center justify-center text-[10px] transition-transform duration-100 ${bgClass}`}>
                                {content}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid Key Info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-500 text-xs flex flex-col sm:flex-row gap-4 justify-between items-start">
            <div>
              <span className="font-bold text-slate-700">Grid Guide:</span> Hover over any task grid number (e.g., T1, T2) to see the specific task description assigned to that employee for {selectedMonth}! Click on any employee's name to immediately open their monthly logs workspace.
            </div>
            <div className="font-mono text-[10px] bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
              <div className="font-bold mb-1 border-b pb-1 text-slate-700">KEY DEFINITION:</div>
              <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> = TASK COMPLETED</div>
              <div className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-600" /> = TASK NOT COMPLETED / PENDING</div>
              <div>Empty/Gray = NO ASSIGNED TASK FOR THIS PERIOD</div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'staff' && isAdmin && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search roster by name, email, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800"
              />
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-sans font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-1.5 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>{showAddForm ? 'Close Roster Form' : 'Add Staff or Admin'}</span>
            </button>
          </div>

          {/* Add Staff Form */}
          {showAddForm && (
            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-orange-500" />
                <span>Register New Employee / Admin</span>
              </h3>
              <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. uwa@orangeisland.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Uwa"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Department</label>
                  <select
                    value={newDept}
                    onChange={(e) => handleDeptChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800"
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Activity ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PROJECTS"
                    value={newActivity}
                    onChange={(e) => setNewActivity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Default Password</label>
                  <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="e.g. password123"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-3 pr-10 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800"
                  />
                  <button type="button" onClick={() => setShowNewPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-orange-500"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}>
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Initial Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'staff' | 'admin')}
                    disabled={!isSuperAdmin}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800 disabled:opacity-50"
                  >
                    <option value="staff">Staff (Lock to own sheet)</option>
                    <option value="admin">Admin (Full access)</option>
                  </select>
                </div>

                <div className="lg:col-span-6 flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-xs px-5 py-2 rounded-lg shadow-md transition-colors"
                  >
                    Register and Initialize Reports
                  </button>
                </div>
              </form>
              {!isSuperAdmin && (
                <p className="text-[10px] text-slate-400 flex items-center space-x-1 mt-1">
                  <ShieldAlert className="w-3 h-3 text-amber-500" />
                  <span>Only the Super Admin (oseghale5432@gmail.com) can designate new Admins.</span>
                </p>
              )}
            </div>
          )}

          {/* Roster List Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">
                Current Registered System Users ({filteredStaff.length})
              </h3>
              <span className="font-mono text-[10px] bg-white border border-slate-200 px-2.5 py-1 rounded text-slate-500">
                Super Admin: oseghale5432@gmail.com
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-slate-600 min-w-[800px]">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Email Account</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Activity Category</th>
                    <th className="py-3 px-4 text-center">System Role</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredStaff.map((staff) => {
                    const isStaffSuperAdmin = staff.email.toLowerCase() === 'oseghale5432@gmail.com';
                    return (
                      <tr key={staff.email} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 px-4 font-semibold text-slate-800">
                          {staff.name}
                        </td>
                        <td className="p-3.5 px-4 font-mono text-slate-600">
                          {staff.email}
                        </td>
                        <td className="p-3.5 px-4 uppercase font-medium text-slate-500">
                          {staff.department}
                        </td>
                        <td className="p-3.5 px-4 uppercase font-mono text-[10px] text-slate-400">
                          {staff.activity}
                        </td>
                        <td className="p-3.5 px-4 text-center">
                          {staff.role === 'admin' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 font-extrabold text-[9px] uppercase border border-orange-200">
                              <ShieldCheck className="w-3 h-3 text-orange-600" />
                              <span>ADMIN</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-[9px] uppercase border border-slate-200">
                              <span>STAFF</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 px-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            {/* Toggle Admin role: Only Super Admin can do this */}
                            {isSuperAdmin && !isStaffSuperAdmin && (
                              <button
                                onClick={() => handleToggleRole(staff)}
                                className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-colors ${
                                  staff.role === 'admin'
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                    : 'bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-200'
                                }`}
                              >
                                {staff.role === 'admin' ? 'Demote to Staff' : 'Promote to Admin'}
                              </button>
                            )}

                            {/* Delete Roster Entry: Cannot delete the super admin */}
                            {!isStaffSuperAdmin && (
                              <button
                                onClick={() => handleDeleteClick(staff.email, staff.name)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove from system"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'dropdowns' && isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Departments Manager */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Layers className="w-5 h-5 text-orange-500" />
              <div>
                <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wide">
                  Departments List Manager
                </h3>
                <p className="text-[10px] text-slate-400">Add or remove corporate departments</p>
              </div>
            </div>

            <DropdownItemManager
              items={departments}
              placeholder="e.g. MARKETING"
              onUpdate={(updatedList) => {
                onUpdateDepartments(updatedList);
              }}
              caseTransform="uppercase"
            />
          </div>

          {/* Status Options Manager */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <div>
                <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wide">
                  Task Status Options Manager
                </h3>
                <p className="text-[10px] text-slate-400">Add or remove status stages in tracker</p>
              </div>
            </div>

            <DropdownItemManager
              items={statuses}
              placeholder="e.g. On Hold"
              onUpdate={(updatedList) => {
                onUpdateStatuses(updatedList);
              }}
              caseTransform="none"
            />
          </div>

          {/* Contractor / Dept Head Options Manager */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <FileText className="w-5 h-5 text-sky-500" />
              <div>
                <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wide">
                  Contractor / Dept Head Manager
                </h3>
                <p className="text-[10px] text-slate-400">Add or remove external parties and heads</p>
              </div>
            </div>

            <DropdownItemManager
              items={contractorHeads}
              placeholder="e.g. POWERFLOW"
              onUpdate={(updatedList) => {
                onUpdateContractorHeads(updatedList);
              }}
              caseTransform="uppercase"
            />
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <FileText className="w-5 h-5 text-violet-500" />
              <div>
                <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wide">
                  Accounting Codes Manager
                </h3>
                <p className="text-[10px] text-slate-400">Format: code — associated payment</p>
              </div>
            </div>
            <DropdownItemManager
              items={accountingCodes}
              placeholder="e.g. 400002 — Electricity"
              onUpdate={onUpdateAccountingCodes}
              caseTransform="none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DropdownItemManager({
  items,
  placeholder,
  onUpdate,
  caseTransform = 'none',
}: {
  items: string[];
  placeholder: string;
  onUpdate: (updated: string[]) => void;
  caseTransform: 'uppercase' | 'none';
}) {
  const [newValue, setNewValue] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    let val = newValue.trim();
    if (!val) return;
    if (caseTransform === 'uppercase') {
      val = val.toUpperCase();
    }
    
    if (items.includes(val)) {
      alert('This option already exists in the list!');
      return;
    }

    onUpdate([...items, val]);
    setNewValue('');
  };

  const handleDelete = (itemToDelete: string) => {
    if (items.length <= 1) {
      alert('You must keep at least one option in the dropdown list.');
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to delete "${itemToDelete}"?\nThis might affect existing records that use this option.`);
    if (confirmed) {
      onUpdate(items.filter((item) => item !== itemToDelete));
    }
  };

  return (
    <div className="space-y-4">
      {/* Form */}
      <form onSubmit={handleAdd} className="flex space-x-2">
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={placeholder}
          required
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800"
        />
        <button
          type="submit"
          className="bg-orange-500 hover:bg-orange-600 text-white font-sans font-bold text-xs px-4 py-2 rounded-lg shadow transition-colors"
        >
          Add Option
        </button>
      </form>

      {/* List */}
      <div className="border border-slate-100 rounded-lg divide-y divide-slate-50 max-h-60 overflow-y-auto">
        {items.map((item) => (
          <div key={item} className="flex justify-between items-center p-2.5 px-3 hover:bg-slate-50/50 transition-colors">
            <span className="text-xs font-semibold text-slate-700">{item}</span>
            <button
              type="button"
              onClick={() => handleDelete(item)}
              className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
