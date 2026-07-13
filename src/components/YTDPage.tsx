/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit2, 
  Save, 
  X,
  AlertCircle,
  Calendar,
  User,
  Activity,
  CheckCircle,
  Clock
} from 'lucide-react';
import { StaffMember, YTDTask } from '../types';

interface YTDPageProps {
  tasks: YTDTask[];
  onAddTask: (task: Omit<YTDTask, 'id' | 'daysRemaining'>) => void;
  onUpdateTask: (task: YTDTask) => void;
  onDeleteTask: (id: string) => void;
  isAdmin: boolean;
  departments: string[];
  statuses: string[];
  staffList: StaffMember[];
  contractorHeads: string[];
}

export default function YTDPage({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  isAdmin,
  departments,
  statuses,
  staffList,
  contractorHeads,
}: YTDPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isAdding, setIsAdding] = useState(false);
  
  // New Task form state
  const [newTask, setNewTask] = useState({
    department: 'ADMIN',
    lead: '',
    coWorker: '',
    contractorHead: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Not Started',
    remark: '',
  });

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<YTDTask | null>(null);
  const staffOptions = [...staffList].sort((a, b) => a.name.localeCompare(b.name));
  const normalizedContractorHeads = contractorHeads
    .map((item) => item.trim())
    .filter(Boolean);
  const uniqueContractorHeads = Array.from(new Set(normalizedContractorHeads));

  // Filtered tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = 
      task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.lead.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.coWorker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.contractorHead.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = deptFilter === 'ALL' || task.department === deptFilter;
    
    let matchesStatus = true;
    if (statusFilter === 'COMPLETED') {
      matchesStatus = task.status.toLowerCase().includes('complete') || task.status.toLowerCase().includes('done');
    } else if (statusFilter === 'IN_PROGRESS') {
      matchesStatus = task.status !== '' && !task.status.toLowerCase().includes('complete') && !task.status.toLowerCase().includes('done');
    } else if (statusFilter === 'NOT_STARTED') {
      matchesStatus = task.status === '';
    }

    return matchesSearch && matchesDept && matchesStatus;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.description || !newTask.lead) {
      alert('Task description and Managed/Lead are required.');
      return;
    }
    onAddTask(newTask);
    setNewTask({
      department: 'ADMIN',
      lead: '',
      coWorker: '',
      contractorHead: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Not Started',
      remark: '',
    });
    setIsAdding(false);
  };

  const startEdit = (task: YTDTask) => {
    setEditingId(task.id);
    setEditingTask({ ...task });
  };

  const handleSaveEdit = () => {
    if (editingTask) {
      // Calculate Days Remaining as difference between due date and today
      const due = new Date(editingTask.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      onUpdateTask({
        ...editingTask,
        daysRemaining: diffDays > 0 ? diffDays : 0,
      });
      setEditingId(null);
      setEditingTask(null);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this YTD Task?')) {
      onDeleteTask(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search active tasks, leads, co-workers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Department Filter */}
          <div className="relative min-w-[160px]">
            <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="pl-9 pr-8 py-2 w-full border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 appearance-none"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative min-w-[150px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 w-full border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 appearance-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        {/* Add Task Trigger (Only available to Admins/Leads or during demo) */}
        {isAdmin && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm shadow-orange-500/10 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create YTD Task</span>
          </button>
        )}
      </div>

      {/* Adding Panel */}
      {isAdding && (
        <form onSubmit={handleCreate} className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 flex justify-between items-center border-b border-slate-200 pb-2">
            <h3 className="font-sans font-bold text-slate-800 text-sm flex items-center space-x-2">
              <Activity className="w-4 h-4 text-orange-500" />
              <span>Add New Active YTD Task</span>
            </h3>
            <button type="button" onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
            <select
              value={newTask.department}
              onChange={(e) => setNewTask({ ...newTask, department: e.target.value })}
              className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:ring-orange-500"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Managed / Lead</label>
            <select
              value={newTask.lead}
              onChange={(e) => setNewTask({ ...newTask, lead: e.target.value })}
              required
              className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:ring-orange-500"
            >
              <option value="">Select staff lead</option>
              {staffOptions.map((staff) => (
                <option key={staff.email} value={staff.name}>
                  {staff.label || staff.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Co-Worker</label>
            <input
              type="text"
              value={newTask.coWorker}
              onChange={(e) => setNewTask({ ...newTask, coWorker: e.target.value })}
              placeholder="e.g. Paul (PROCURE)"
              className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Contractor / Dept Head</label>
            <select
              value={newTask.contractorHead}
              onChange={(e) => setNewTask({ ...newTask, contractorHead: e.target.value })}
              className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:ring-orange-500"
            >
              <option value="">Select contractor / head</option>
              {uniqueContractorHeads.map((contractorHead) => (
                <option key={contractorHead} value={contractorHead}>
                  {contractorHead}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
            <input
              type="date"
              value={newTask.startDate}
              onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
              className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
            <input
              type="date"
              value={newTask.dueDate}
              onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
              className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:ring-orange-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Task Description</label>
            <textarea
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Enter active task description..."
              rows={2}
              className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select
              value={newTask.status}
              onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
              className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:ring-orange-500"
            >
              <option value="">No Status</option>
              {statuses.map((stat) => (
                <option key={stat} value={stat}>
                  {stat}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Remark</label>
            <input
              type="text"
              value={newTask.remark}
              onChange={(e) => setNewTask({ ...newTask, remark: e.target.value })}
              placeholder="e.g., all good"
              className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:ring-orange-500"
            />
          </div>

          <div className="md:col-span-3 flex justify-end space-x-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 shadow-sm transition-colors"
            >
              Add Project Task
            </button>
          </div>
        </form>
      )}

      {/* Spreadsheet Grid Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 bg-orange-500 rounded-full"></div>
            <h2 className="font-sans font-bold text-slate-800 text-sm">
              2026 ACTIVE WORK PROJECTS ({filteredTasks.length})
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">Year-To-Date Monitoring Tab</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-600 min-w-[1000px]">
            <thead>
              <tr className="bg-emerald-900 text-emerald-50 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4 border-r border-emerald-800">Department</th>
                <th className="py-3 px-4 border-r border-emerald-800">Managed / Lead</th>
                <th className="py-3 px-4 border-r border-emerald-800">Co-Worker</th>
                <th className="py-3 px-4 border-r border-emerald-800">Contractor / Dept Head</th>
                <th className="py-3 px-4 border-r border-emerald-800 w-1/3">Task Description</th>
                <th className="py-3 px-4 border-r border-emerald-800 text-center">Start Date</th>
                <th className="py-3 px-4 border-r border-emerald-800 text-center">Due Date</th>
                <th className="py-3 px-4 border-r border-emerald-800 text-center">Days Remaining</th>
                <th className="py-3 px-4 border-r border-emerald-800">Status</th>
                <th className="py-3 px-4 border-r border-emerald-800">Remark</th>
                {isAdmin && <th className="py-3 px-4 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans text-xs">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <span>No active projects found matching the criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task, index) => {
                  const isEditing = editingId === task.id;

                  // Dynamic color striping based on department to match spreadsheet visual grouping
                  const deptColors: Record<string, string> = {
                    ACCOUNTS: 'bg-emerald-50/20 text-emerald-800 border-l-4 border-emerald-600',
                    ADMIN: 'bg-teal-50/20 text-teal-800 border-l-4 border-teal-600',
                    DEVELOPMENT: 'bg-cyan-50/20 text-cyan-800 border-l-4 border-cyan-600',
                    ELECTRICAL: 'bg-sky-50/20 text-sky-800 border-l-4 border-sky-600',
                    FACILITIES: 'bg-amber-50/20 text-amber-800 border-l-4 border-amber-600',
                    SECURITY: 'bg-rose-50/20 text-rose-800 border-l-4 border-rose-600',
                    GARDENING: 'bg-lime-50/20 text-lime-800 border-l-4 border-lime-600',
                    ICT: 'bg-indigo-50/20 text-indigo-800 border-l-4 border-indigo-600',
                  };

                  const deptClass = deptColors[task.department] || 'border-l-4 border-slate-300';

                  return (
                    <tr 
                      key={task.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isEditing ? 'bg-orange-50/40' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}
                    >
                      {/* Department */}
                      <td className={`p-3 border-r border-slate-100 font-bold ${deptClass}`}>
                        {isEditing ? (
                          <select
                            value={editingTask?.department}
                            onChange={(e) => setEditingTask({ ...editingTask!, department: e.target.value })}
                            className="w-full p-1 border rounded bg-white"
                          >
                            {departments.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                        ) : (
                          task.department
                        )}
                      </td>

                      {/* Lead */}
                      <td className="p-3 border-r border-slate-100 font-medium text-slate-800">
                        {isEditing ? (
                          <select
                            value={editingTask?.lead}
                            onChange={(e) => setEditingTask({ ...editingTask!, lead: e.target.value })}
                            className="w-full p-1 border rounded bg-white"
                          >
                            <option value="">Select staff lead</option>
                            {editingTask?.lead && !staffOptions.some((staff) => staff.name === editingTask.lead) && (
                              <option value={editingTask.lead}>{editingTask.lead}</option>
                            )}
                            {staffOptions.map((staff) => (
                              <option key={staff.email} value={staff.name}>
                                {staff.label || staff.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          task.lead
                        )}
                      </td>

                      {/* Co-Worker */}
                      <td className="p-3 border-r border-slate-100 text-slate-500">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingTask?.coWorker}
                            onChange={(e) => setEditingTask({ ...editingTask!, coWorker: e.target.value })}
                            className="w-full p-1 border rounded bg-white"
                          />
                        ) : (
                          task.coWorker || <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Contractor Head */}
                      <td className="p-3 border-r border-slate-100 font-medium">
                        {isEditing ? (
                          <select
                            value={editingTask?.contractorHead}
                            onChange={(e) => setEditingTask({ ...editingTask!, contractorHead: e.target.value })}
                            className="w-full p-1 border rounded bg-white"
                          >
                            <option value="">Select contractor / head</option>
                            {editingTask?.contractorHead && !uniqueContractorHeads.includes(editingTask.contractorHead) && (
                              <option value={editingTask.contractorHead}>{editingTask.contractorHead}</option>
                            )}
                            {uniqueContractorHeads.map((contractorHead) => (
                              <option key={contractorHead} value={contractorHead}>
                                {contractorHead}
                              </option>
                            ))}
                          </select>
                        ) : (
                          task.contractorHead || <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Task Description */}
                      <td className="p-3 border-r border-slate-100 font-sans text-slate-700 font-medium">
                        {isEditing ? (
                          <textarea
                            value={editingTask?.description}
                            onChange={(e) => setEditingTask({ ...editingTask!, description: e.target.value })}
                            rows={2}
                            className="w-full p-1 border rounded bg-white"
                          />
                        ) : (
                          task.description
                        )}
                      </td>

                      {/* Start Date */}
                      <td className="p-3 border-r border-slate-100 text-center text-slate-500 font-mono">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editingTask?.startDate}
                            onChange={(e) => setEditingTask({ ...editingTask!, startDate: e.target.value })}
                            className="p-1 border rounded bg-white text-xs"
                          />
                        ) : (
                          task.startDate ? new Date(task.startDate).toLocaleDateString() : '-'
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="p-3 border-r border-slate-100 text-center text-slate-500 font-mono">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editingTask?.dueDate}
                            onChange={(e) => setEditingTask({ ...editingTask!, dueDate: e.target.value })}
                            className="p-1 border rounded bg-white text-xs"
                          />
                        ) : (
                          task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'
                        )}
                      </td>

                      {/* Days Remaining */}
                      <td className="p-3 border-r border-slate-100 text-center font-bold font-mono">
                        {isEditing ? (
                          <span className="text-slate-400 font-normal">Calculated</span>
                        ) : (
                          <span className={task.daysRemaining <= 5 ? 'text-red-500' : task.daysRemaining <= 15 ? 'text-orange-500' : 'text-emerald-600'}>
                            {task.daysRemaining}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3 border-r border-slate-100">
                        {isEditing ? (
                          <select
                            value={editingTask?.status}
                            onChange={(e) => setEditingTask({ ...editingTask!, status: e.target.value })}
                            className="w-full p-1 border rounded bg-white text-xs"
                          >
                            <option value="">No Status</option>
                            {statuses.map((stat) => (
                              <option key={stat} value={stat}>
                                {stat}
                              </option>
                            ))}
                          </select>
                        ) : (
                          task.status ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              task.status.toLowerCase().includes('commenced') || task.status.toLowerCase().includes('progress')
                                ? 'bg-sky-50 text-sky-700 border border-sky-150'
                                : task.status.toLowerCase().includes('waiting') || task.status.toLowerCase().includes('hold')
                                ? 'bg-amber-50 text-amber-700 border border-amber-150'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                            }`}>
                              {task.status}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Not set</span>
                          )
                        )}
                      </td>

                      {/* Remark */}
                      <td className="p-3 border-r border-slate-100 text-slate-500">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingTask?.remark}
                            onChange={(e) => setEditingTask({ ...editingTask!, remark: e.target.value })}
                            className="w-full p-1 border rounded bg-white"
                          />
                        ) : (
                          task.remark || <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      {isAdmin && (
                        <td className="p-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={handleSaveEdit}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Save changes"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingTask(null);
                                }}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                title="Cancel editing"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() => startEdit(task)}
                                className="p-1 text-slate-400 hover:text-orange-500 hover:bg-slate-50 rounded"
                                title="Edit Task"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(task.id)}
                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded"
                                title="Delete Task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
