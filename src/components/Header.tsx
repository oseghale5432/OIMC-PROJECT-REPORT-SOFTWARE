/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  LayoutDashboard, 
  User, 
  LogOut, 
  Shield, 
  RefreshCw, 
  ChevronDown,
  Database,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { StaffMember } from '../types';

interface HeaderProps {
  currentUser: any;
  simulatedEmail: string;
  onSimulateEmailChange: (email: string) => void;
  staffList: StaffMember[];
  currentTab: string;
  onTabChange: (tab: string) => void;
  onLogin: () => void;
  onLogout: () => void;
  isSheetsLinked: boolean;
  onLinkSheets: () => void;
  isLinkingSheets: boolean;
  spreadsheetUrl: string | null;
  isAdmin: boolean;
}

export default function Header({
  currentUser,
  simulatedEmail,
  onSimulateEmailChange,
  staffList,
  currentTab,
  onTabChange,
  onLogin,
  onLogout,
  isSheetsLinked,
  onLinkSheets,
  isLinkingSheets,
  spreadsheetUrl,
  isAdmin,
}: HeaderProps) {
  const [showSimMenu, setShowSimMenu] = useState(false);

  const activeStaff = staffList.find((s) => s.email === simulatedEmail);

  return (
    <header id="app-header" className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo / Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md shadow-orange-500/20">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono text-xs tracking-widest text-orange-400 font-bold">ORANGE ISLAND</span>
              </div>
              <h1 className="font-sans font-bold text-lg tracking-tight -mt-1 text-slate-100">
                Progress Tracker
              </h1>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1" aria-label="Tabs">
            <button
              id="tab-ytd"
              onClick={() => onTabChange('ytd')}
              className={`px-4 py-2 rounded-md font-sans text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                currentTab === 'ytd'
                  ? 'bg-slate-800 text-orange-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>2026 YTD TASKS</span>
            </button>

            {/* Overview Only Visible to Admin / Boss */}
            {isAdmin && (
              <button
                id="tab-overview"
                onClick={() => onTabChange('overview')}
                className={`px-4 py-2 rounded-md font-sans text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                  currentTab === 'overview'
                    ? 'bg-slate-800 text-orange-400 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>OVERVIEW</span>
              </button>
            )}

            {/* My Section Tab */}
            <button
              id="tab-personal"
              onClick={() => onTabChange('personal')}
              className={`px-4 py-2 rounded-md font-sans text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                currentTab === 'personal'
                  ? 'bg-slate-800 text-orange-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{isAdmin ? 'STAFF SHEETS' : 'MY PROGRESS REPORT'}</span>
            </button>
          </nav>

          {/* Connection Status & Auth */}
          <div className="flex items-center space-x-4">
            {/* Google Sheets Status */}
            {currentUser?.role === 'admin' && (
              <div className="hidden lg:flex items-center space-x-2">
                {isSheetsLinked ? (
                  <a
                    href={spreadsheetUrl || '#'}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="flex items-center space-x-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-emerald-900/40 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <Database className="w-3.5 h-3.5" />
                    <span>Sheets Database Active</span>
                  </a>
                ) : (
                  <button
                    onClick={onLinkSheets}
                    disabled={isLinkingSheets}
                    className="flex items-center space-x-1.5 bg-orange-950/40 text-orange-400 border border-orange-800/60 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-orange-900/40 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isLinkingSheets ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Database className="w-3.5 h-3.5" />
                    )}
                    <span>Load Server Sheet</span>
                  </button>
                )}
              </div>
            )}

            {/* Simulation Identity Switcher (extremely useful for reviews) */}
            {isAdmin && (
              <div className="relative">
                <button
                  id="btn-simulation"
                  onClick={() => setShowSimMenu(!showSimMenu)}
                  className="flex items-center space-x-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  <Shield className="w-3.5 h-3.5 text-orange-400" />
                  <span className="max-w-[120px] truncate">
                    Identity: {activeStaff ? activeStaff.name : 'Super Admin'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showSimMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 max-h-96 overflow-y-auto">
                    <div className="px-3 py-2 border-b border-slate-700 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      Switch Active Persona
                    </div>
                    
                    {/* Super Admin */}
                    <button
                      onClick={() => {
                        onSimulateEmailChange('oseghale5432@gmail.com');
                        setShowSimMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 transition-colors ${
                        simulatedEmail === 'oseghale5432@gmail.com' ? 'bg-slate-750 text-orange-400 font-medium' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Shield className="w-3.5 h-3.5 text-orange-400" />
                        <span>Super Admin (All Views)</span>
                      </div>
                      {simulatedEmail === 'oseghale5432@gmail.com' && (
                        <CheckCircle className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <div className="border-t border-slate-700/50 my-1"></div>

                    {/* Staff List */}
                    {staffList.map((staff) => (
                      <button
                        key={staff.email}
                        onClick={() => {
                          onSimulateEmailChange(staff.email);
                          setShowSimMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-700 transition-colors ${
                          simulatedEmail === staff.email ? 'bg-slate-750 text-orange-400 font-medium' : 'text-slate-300'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{staff.name}</span>
                          <span className="text-[10px] text-slate-500">{staff.department}</span>
                        </div>
                        {simulatedEmail === staff.email && (
                          <CheckCircle className="w-3.5 h-3.5 text-orange-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Google Authentication */}
            {currentUser ? (
              <div className="flex items-center space-x-2">
                <img
                  src={currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&h=80'}
                  alt={currentUser.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-slate-700"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="gsi-material-button text-xs py-1 px-3 cursor-pointer"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#1f2937',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: '500',
                  gap: '8px',
                }}
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '16px', height: '16px' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>Google Drive Link</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
