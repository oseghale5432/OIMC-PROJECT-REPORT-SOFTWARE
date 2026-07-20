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
  HelpCircle,
  Menu,
  X,
  Bell
} from 'lucide-react';
import { Banknote } from 'lucide-react';
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
  onBroadcastReminder: () => void;
  unreadCount: number;
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
  onBroadcastReminder,
  unreadCount,
}: HeaderProps) {
  const [showSimMenu, setShowSimMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const activeStaff = staffList.find((s) => s.email === simulatedEmail);
  const handleTabClick = (tab: string) => {
    onTabChange(tab);
    setShowMobileMenu(false);
  };

  return (
    <header id="app-header" className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo / Title */}
          <div className="flex items-center gap-3 shrink-0">
            <img
              src={new URL('../../assets/orange-island-logo-white.png', import.meta.url).href}
              alt="Orange Island Lagos"
              className="h-11 w-auto max-w-[112px] object-contain"
            />
            <div className="hidden xl:block border-l border-slate-700 pl-3">
              <h1 className="font-sans font-bold text-sm leading-tight text-slate-100">
                Progress<br />Tracker
              </h1>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1" aria-label="Tabs">
            <button
              id="tab-ytd"
              onClick={() => handleTabClick('ytd')}
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
              <>
                <button
                  id="tab-overview"
                  onClick={() => handleTabClick('overview')}
                  className={`px-4 py-2 rounded-md font-sans text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                    currentTab === 'overview'
                      ? 'bg-slate-800 text-orange-400 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>OVERVIEW</span>
                </button>
                <button
                  type="button"
                  onClick={onBroadcastReminder}
                  className="px-4 py-2 rounded-md font-sans text-sm font-medium transition-all duration-200 flex items-center space-x-2 text-amber-100 bg-amber-600/10 border border-amber-600/25 hover:bg-amber-600/15"
                >
                  <Shield className="w-4 h-4" />
                  <span>Send Reminder</span>
                </button>
              </>
            )}

            {/* My Section Tab */}
            <button
              id="tab-payment"
              onClick={() => handleTabClick('payment')}
              className={`px-4 py-2 rounded-md font-sans text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                currentTab === 'payment' ? 'bg-slate-800 text-orange-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Banknote className="w-4 h-4" /><span>PAYMENT</span>
            </button>

            <button
              id="tab-notifications"
              onClick={() => handleTabClick('notifications')}
              className={`px-4 py-2 rounded-md font-sans text-sm font-medium transition-all duration-200 flex items-center space-x-2 relative ${
                currentTab === 'notifications'
                  ? 'bg-slate-800 text-orange-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>NOTIFICATIONS</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white border border-slate-850 shadow-sm animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              id="tab-personal"
              onClick={() => handleTabClick('personal')}
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
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              type="button"
              onClick={() => setShowMobileMenu((value) => !value)}
              className="md:hidden p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors"
              aria-label="Open navigation menu"
              aria-expanded={showMobileMenu}
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Load Server Sheet (if not linked) */}
            {currentUser?.role === 'admin' && !isSheetsLinked && (
              <div className="hidden lg:flex items-center space-x-2">
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
              <div className="flex items-center">
                <button
                  onClick={onLogout}
                  className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
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

        {showMobileMenu && (
          <div className="md:hidden border-t border-slate-800 py-3 space-y-3">
            <nav className="grid grid-cols-1 gap-2" aria-label="Mobile tabs">
              <button
                type="button"
                onClick={() => handleTabClick('payment')}
                className={`w-full px-3 py-3 rounded-lg font-sans text-sm font-semibold transition-all flex items-center justify-between ${
                  currentTab === 'payment' ? 'bg-slate-800 text-orange-400 border border-slate-700' : 'text-slate-300 bg-slate-850/60 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center space-x-2"><Banknote className="w-4 h-4" /><span>Payment</span></span>
                {currentTab === 'payment' && <CheckCircle className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => handleTabClick('notifications')}
                className={`w-full px-3 py-3 rounded-lg font-sans text-sm font-semibold transition-all flex items-center justify-between ${
                  currentTab === 'notifications'
                    ? 'bg-slate-800 text-orange-400 border border-slate-700'
                    : 'text-slate-300 bg-slate-850/60 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center space-x-2 relative">
                  <Bell className="w-4 h-4" />
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="ml-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </span>
                {currentTab === 'notifications' && <CheckCircle className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => handleTabClick('ytd')}
                className={`w-full px-3 py-3 rounded-lg font-sans text-sm font-semibold transition-all flex items-center justify-between ${
                  currentTab === 'ytd'
                    ? 'bg-slate-800 text-orange-400 border border-slate-700'
                    : 'text-slate-300 bg-slate-850/60 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>2026 YTD Tasks</span>
                </span>
                {currentTab === 'ytd' && <CheckCircle className="w-4 h-4" />}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleTabClick('overview')}
                  className={`w-full px-3 py-3 rounded-lg font-sans text-sm font-semibold transition-all flex items-center justify-between ${
                    currentTab === 'overview'
                      ? 'bg-slate-800 text-orange-400 border border-slate-700'
                      : 'text-slate-300 bg-slate-850/60 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Overview</span>
                  </span>
                  {currentTab === 'overview' && <CheckCircle className="w-4 h-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={() => handleTabClick('personal')}
                className={`w-full px-3 py-3 rounded-lg font-sans text-sm font-semibold transition-all flex items-center justify-between ${
                  currentTab === 'personal'
                    ? 'bg-slate-800 text-orange-400 border border-slate-700'
                    : 'text-slate-300 bg-slate-850/60 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{isAdmin ? 'Staff Sheets' : 'My Progress Report'}</span>
                </span>
                {currentTab === 'personal' && <CheckCircle className="w-4 h-4" />}
              </button>
            </nav>

            {currentUser?.role === 'admin' && !isSheetsLinked && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <button
                  type="button"
                  onClick={() => {
                    onLinkSheets();
                    setShowMobileMenu(false);
                  }}
                  disabled={isLinkingSheets}
                  className="w-full flex items-center justify-center space-x-2 text-orange-400 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isLinkingSheets ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  <span>Load Server Sheet</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
