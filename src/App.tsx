/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ExternalLink, 
  HelpCircle, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Info,
  Lock,
  Mail,
  Key,
  User
} from 'lucide-react';
import { YTDTask, StaffMember, MonthProgress, SpreadsheetConfig } from './types';
import { 
  DEFAULT_STAFF, 
  DEFAULT_YTD_TASKS, 
  generateDefaultProgressReports,
  MONTHS
} from './data/mockData';
import { GoogleSheetsService } from './googleSheetsService';
import Header from './components/Header';
import YTDPage from './components/YTDPage';
import OverviewPage from './components/OverviewPage';
import StaffProgressPage from './components/StaffProgressPage';
import { googleSignIn } from './firebase';

export default function App() {
  // Authentication & Session States
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('oi_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(null);
  const [simulatedEmail, setSimulatedEmail] = useState<string>(() => {
    return localStorage.getItem('oi_simulated_email') || 'oseghale5432@gmail.com';
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);
  
  // Custom login forms and credentials states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetName, setResetName] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  
  // First-Time Password Setup States
  const [isFirstLoginMode, setIsFirstLoginMode] = useState(false);
  const [firstLoginStaff, setFirstLoginStaff] = useState<StaffMember | null>(null);
  const [newFirstPassword, setNewFirstPassword] = useState('');
  const [confirmFirstPassword, setConfirmFirstPassword] = useState('');

  const [showTroubleshooter, setShowTroubleshooter] = useState(false);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // App Data States - Load from localStorage if present, else fallback to empty/defaults
  const [tasks, setTasks] = useState<YTDTask[]>(() => {
    const saved = localStorage.getItem('oi_tasks');
    return saved ? JSON.parse(saved) : DEFAULT_YTD_TASKS;
  });
  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    const saved = localStorage.getItem('oi_staff_list');
    let list: StaffMember[] = saved ? JSON.parse(saved) : DEFAULT_STAFF;
    // Guarantee super admin exists and has a default initial password
    const superAdminIndex = list.findIndex(s => s.email?.toLowerCase() === 'oseghale5432@gmail.com');
    if (superAdminIndex === -1) {
      list.push({
        email: 'oseghale5432@gmail.com',
        name: 'Admin Boss',
        department: 'MANAGEMENT',
        activity: 'SUPER ADMIN',
        label: 'Admin Boss (Super Admin)',
        isNew: false,
        role: 'admin',
        password: 'admin123',
        isFirstLogin: true
      });
    } else {
      const admin = list[superAdminIndex];
      if (!admin.password) {
        admin.password = 'admin123';
        admin.isFirstLogin = true;
      }
    }
    return list;
  });

  // Keep currentUser synced to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('oi_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('oi_current_user');
    }
  }, [currentUser]);
  const [progressReports, setProgressReports] = useState<MonthProgress[]>(() => {
    const saved = localStorage.getItem('oi_progress_reports');
    return saved ? JSON.parse(saved) : generateDefaultProgressReports();
  });

  // Automatically save state updates to localStorage for offline robustness
  useEffect(() => {
    localStorage.setItem('oi_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('oi_staff_list', JSON.stringify(staffList));
  }, [staffList]);

  useEffect(() => {
    localStorage.setItem('oi_progress_reports', JSON.stringify(progressReports));
  }, [progressReports]);

  // Admin Configurable Dropdowns
  const [departments, setDepartments] = useState<string[]>(() => {
    const saved = localStorage.getItem('oi_departments');
    return saved ? JSON.parse(saved) : [
      'PROJECTS', 'FACILITIES', 'DEVELOPMENT', 'ELECTRICAL', 
      'HSE / PROCUREMENT', 'SECURITY', 'GARDENING', 'ADMIN', 
      'MANAGEMENT', 'ICT'
    ];
  });

  const [statuses, setStatuses] = useState<string[]>(() => {
    const saved = localStorage.getItem('oi_statuses');
    return saved ? JSON.parse(saved) : [
      'Not Started', 'Work commenced', 'Waiting Approval OIDC SC', 
      'Waiting Approval by GM', 'Completed', 'Pending'
    ];
  });

  const handleUpdateDepartments = (newDepts: string[]) => {
    setDepartments(newDepts);
    localStorage.setItem('oi_departments', JSON.stringify(newDepts));
  };

  const handleUpdateStatuses = (newStatuses: string[]) => {
    setStatuses(newStatuses);
    localStorage.setItem('oi_statuses', JSON.stringify(newStatuses));
  };

  // Navigation & View States
  const [currentTab, setCurrentTab] = useState<string>(() => {
    return localStorage.getItem('oi_current_tab') || 'ytd';
  });
  const [selectedMonth, setSelectedMonth] = useState<string>('May');

  const handleSimulateEmailChange = (email: string) => {
    setSimulatedEmail(email);
    localStorage.setItem('oi_simulated_email', email);
  };

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    localStorage.setItem('oi_current_tab', tab);
  };

  // Sheets Sync Config States
  const [isLinkingSheets, setIsLinkingSheets] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sheetsConfig, setSheetsConfig] = useState<SpreadsheetConfig>({
    spreadsheetId: null,
    spreadsheetUrl: null,
    isSynced: false,
    lastSyncedAt: null,
  });

  // Session restorer on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('oi_current_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        // Ensure simulation matches logged in user if none stored
        const storedSimEmail = localStorage.getItem('oi_simulated_email');
        if (!storedSimEmail) {
          handleSimulateEmailChange(user.email || 'oseghale5432@gmail.com');
        }
      } catch (e) {
        console.error('Failed to restore login session:', e);
      }
    }
  }, []);

  // Check authorization status
  const loggedInEmail = currentUser?.email?.toLowerCase();
  const isSuperAdmin = loggedInEmail === 'oseghale5432@gmail.com';
  const isRegisteredStaff = staffList.some(s => s.email?.toLowerCase() === loggedInEmail);
  const isAuthorized = !currentUser || isSuperAdmin || isRegisteredStaff;

  // Determine if actual logged-in user is an admin, or if there is no logged-in user (allows local development testing/simulation)
  const loggedInStaffProfile = staffList.find(s => s.email?.toLowerCase() === loggedInEmail);
  const isActualAdmin = !currentUser || isSuperAdmin || loggedInStaffProfile?.role === 'admin';

  // Determine if active persona is an admin
  const activePersona = staffList.find(s => s.email?.toLowerCase() === simulatedEmail?.toLowerCase());
  const isAdmin = simulatedEmail?.toLowerCase() === 'oseghale5432@gmail.com' || activePersona?.role === 'admin';

  // Lock simulated email if they are normal staff
  useEffect(() => {
    if (currentUser && isAuthorized) {
      const email = currentUser.email?.toLowerCase() || '';
      const userProfile = staffList.find(s => s.email?.toLowerCase() === email);
      const isUserAdmin = email === 'oseghale5432@gmail.com' || userProfile?.role === 'admin';
      
      if (!isUserAdmin && isRegisteredStaff) {
        handleSimulateEmailChange(currentUser.email || '');
      }
    }
  }, [currentUser, staffList, isRegisteredStaff, isAuthorized]);

  // Enforce Row-Level Tab Visibility (Employees cannot access overview page)
  useEffect(() => {
    if (!isActualAdmin && currentTab === 'overview') {
      handleTabChange('ytd');
    }
  }, [simulatedEmail, currentTab, isActualAdmin]);

  // Attempt to auto-find and load spreadsheet
  const autoFindAndLinkSheets = async (accessToken: string) => {
    setIsLinkingSheets(true);
    try {
      const foundSheet = await GoogleSheetsService.findExistingSheet(accessToken);
      if (foundSheet) {
        const url = `https://docs.google.com/spreadsheets/d/${foundSheet.id}/edit`;
        setSheetsConfig({
          spreadsheetId: foundSheet.id,
          spreadsheetUrl: url,
          isSynced: true,
          lastSyncedAt: new Date().toLocaleTimeString(),
        });
        
        // Load data from found sheet
        await loadDataFromGoogleSheet(accessToken, foundSheet.id);
      }
    } catch (err) {
      console.error('Error auto-linking sheet:', err);
    } finally {
      setIsLinkingSheets(false);
    }
  };

  // Connect Google account while already logged in (Admin Boss)
  const handleConnectGoogle = async () => {
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        localStorage.setItem('google_access_token', result.accessToken);
        
        // Attempt to search for and link sheets automatically
        await autoFindAndLinkSheets(result.accessToken);
        alert('Google Drive & Sheets sync has been successfully connected!');
      }
    } catch (err: any) {
      console.error('Google authorization failed:', err);
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes('popup-blocked') || 
        errMsg.includes('cancelled-popup-request') || 
        errMsg.includes('popup-closed-by-user') ||
        errMsg.includes('Pending promise') ||
        window.self !== window.top
      ) {
        alert(
          'Google Connection popup was blocked or closed. Please allow popups or open the application in a new tab to authorize.'
        );
      } else {
        alert(`Google connection failed: ${errMsg}`);
      }
    }
  };

  // Sign in with Google (Admin Boss)
  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        // Build logged in user
        const loggedUser = {
          email: result.user.email,
          displayName: result.user.displayName || result.user.email?.split('@')[0] || 'Admin Boss',
          role: 'admin',
          uid: result.user.uid
        };

        // Standard checks
        if (result.user.email?.toLowerCase() === 'oseghale5432@gmail.com') {
          loggedUser.role = 'admin';
        } else {
          const staff = staffList.find(s => s.email?.toLowerCase() === result.user.email?.toLowerCase());
          if (staff) {
            loggedUser.role = staff.role || 'staff';
          } else {
            loggedUser.role = 'admin'; // default fallback for admin login bypass
          }
        }

        setCurrentUser(loggedUser);
        setToken(result.accessToken);
        localStorage.setItem('google_access_token', result.accessToken);
        handleSimulateEmailChange(result.user.email || 'oseghale5432@gmail.com');
        
        // Auto search and link
        await autoFindAndLinkSheets(result.accessToken);
      }
    } catch (err: any) {
      console.error('Google sign-in flow failed:', err);
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes('popup-blocked') || 
        errMsg.includes('cancelled-popup-request') || 
        errMsg.includes('popup-closed-by-user') ||
        errMsg.includes('Pending promise') ||
        window.self !== window.top
      ) {
        setAuthError(
          'Google Sign-In popup was closed or blocked. Please allow popups, open this app in a new tab, or use the standard email & password fields.'
        );
      } else {
        setAuthError(`Sign-in error: ${errMsg}`);
      }
    }
  };

  // Custom Login Flow Handler
  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();

    if (!email || !password) {
      setAuthError('Please enter both your email address and password.');
      return;
    }

    // Find staff member by email in the registered roster
    const staff = staffList.find(s => s.email?.toLowerCase() === email);
    if (!staff) {
      setAuthError('Access Denied: This email address is not registered in our database. Please contact your system administrator to register your account.');
      return;
    }

    // Check password
    const expectedPassword = staff.password || 'password123'; // fallback default
    if (password !== expectedPassword) {
      setAuthError('Access Denied: The password you entered is incorrect. If you forgot your password, please use the Reset option below.');
      return;
    }

    // If matches, check if it's the first login
    if (staff.isFirstLogin || !staff.password) {
      setFirstLoginStaff(staff);
      setIsFirstLoginMode(true);
      return;
    }

    // Successful login!
    const loggedUser = {
      email: staff.email,
      displayName: staff.name,
      role: staff.role || 'staff',
      uid: `local-${staff.email}`
    };

    setCurrentUser(loggedUser);
    handleSimulateEmailChange(staff.email);
    setAuthError(null);
    
    // Clear form
    setLoginEmail('');
    setLoginPassword('');
  };

  // First-Time Login Password Activation Handler
  const handleFirstTimePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!firstLoginStaff) return;

    const pass = newFirstPassword.trim();
    const confirm = confirmFirstPassword.trim();

    if (pass.length < 6) {
      setAuthError('Your new secure password must be at least 6 characters long.');
      return;
    }

    if (pass !== confirm) {
      setAuthError('The passwords you entered do not match. Please verify and try again.');
      return;
    }

    // Update password in staff list
    const updatedStaff = staffList.map(s => {
      if (s.email?.toLowerCase() === firstLoginStaff.email?.toLowerCase()) {
        return {
          ...s,
          password: pass,
          isFirstLogin: false
        };
      }
      return s;
    });

    setStaffList(updatedStaff);
    localStorage.setItem('oi_staff_list', JSON.stringify(updatedStaff));

    // Sync to Google Sheets if linked
    if (sheetsConfig.spreadsheetId && token) {
      GoogleSheetsService.saveStaffProfilesToSheet(token, sheetsConfig.spreadsheetId, updatedStaff);
    }

    // Sign them in
    const loggedUser = {
      email: firstLoginStaff.email,
      displayName: firstLoginStaff.name,
      role: firstLoginStaff.role || 'staff',
      uid: `local-${firstLoginStaff.email}`
    };

    setCurrentUser(loggedUser);
    handleSimulateEmailChange(firstLoginStaff.email);

    // Reset flow states
    setIsFirstLoginMode(false);
    setFirstLoginStaff(null);
    setNewFirstPassword('');
    setConfirmFirstPassword('');
    setLoginEmail('');
    setLoginPassword('');
    alert('Your secure custom password has been registered successfully! Welcome to the Progress Tracker portal.');
  };

  // Self-Serve Forgot Password Reset Handler (Verifies name and resets password)
  const handleForgotPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const email = loginEmail.trim().toLowerCase();
    const name = resetName.trim().toLowerCase();
    const newPass = resetNewPassword.trim();

    if (!email || !name || !newPass) {
      setAuthError('Please fill in all verification fields to reset your password.');
      return;
    }

    if (newPass.length < 6) {
      setAuthError('Your new password must be at least 6 characters long.');
      return;
    }

    // Find staff member
    const staff = staffList.find(s => s.email?.toLowerCase() === email);
    if (!staff) {
      setAuthError('Verification Failed: Email address is not registered in the database.');
      return;
    }

    // Verify name match
    if (staff.name.trim().toLowerCase() !== name) {
      setAuthError('Verification Failed: The registered employee name does not match the email in our database. Please verify spelling or contact the administrator.');
      return;
    }

    // Update password
    const updatedStaff = staffList.map(s => {
      if (s.email?.toLowerCase() === email) {
        return {
          ...s,
          password: newPass,
          isFirstLogin: false
        };
      }
      return s;
    });

    setStaffList(updatedStaff);
    localStorage.setItem('oi_staff_list', JSON.stringify(updatedStaff));

    // Sync to Google Sheets if linked
    if (sheetsConfig.spreadsheetId && token) {
      GoogleSheetsService.saveStaffProfilesToSheet(token, sheetsConfig.spreadsheetId, updatedStaff);
    }

    // Automatically log them in as well
    const loggedUser = {
      email: staff.email,
      displayName: staff.name,
      role: staff.role || 'staff',
      uid: `local-${staff.email}`
    };

    setCurrentUser(loggedUser);
    handleSimulateEmailChange(staff.email);

    // Reset fields
    setIsResetMode(false);
    setResetName('');
    setResetNewPassword('');
    setLoginEmail('');
    setLoginPassword('');
    alert('Your password has been reset successfully! You have been logged into your secure session.');
  };

  // Logout Trigger
  const handleLogout = async () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('oi_current_user');
    handleSimulateEmailChange('oseghale5432@gmail.com');
    setSheetsConfig({
      spreadsheetId: null,
      spreadsheetUrl: null,
      isSynced: false,
      lastSyncedAt: null,
    });
  };

  // Handle linking / creating google sheets database
  const handleLinkSheets = async () => {
    let activeToken = token;
    if (!activeToken) {
      const confirmConnect = confirm('To link a Google Sheet, you must first connect your Google Drive account. Would you like to connect now?');
      if (!confirmConnect) return;
      
      try {
        const result = await googleSignIn();
        if (result) {
          activeToken = result.accessToken;
          setToken(result.accessToken);
          localStorage.setItem('google_access_token', result.accessToken);
        } else {
          return;
        }
      } catch (err: any) {
        console.error('Google authorization failed during sheets link:', err);
        alert(`Google connection failed: ${err?.message || String(err)}`);
        return;
      }
    }

    if (!activeToken) return;
    
    setIsLinkingSheets(true);
    try {
      // Create new sheet
      const newSheet = await GoogleSheetsService.createNewSpreadsheet(
        activeToken,
        tasks,
        staffList,
        progressReports
      );

      setSheetsConfig({
        spreadsheetId: newSheet.spreadsheetId,
        spreadsheetUrl: newSheet.spreadsheetUrl,
        isSynced: true,
        lastSyncedAt: new Date().toLocaleTimeString(),
      });

      alert('Spreadsheet Database created successfully in your Google Drive!');
    } catch (err: any) {
      console.error('Failed to create sheet:', err);
      alert(`Failed to create spreadsheet: ${err.message || err}`);
    } finally {
      setIsLinkingSheets(false);
    }
  };

  // Load database from linked sheet
  const loadDataFromGoogleSheet = async (accessToken: string, spreadsheetId: string) => {
    try {
      setIsSyncing(true);
      const data = await GoogleSheetsService.fetchAllDataFromSheet(accessToken, spreadsheetId);
      
      if (data.ytdTasks && data.ytdTasks.length > 0) setTasks(data.ytdTasks);
      if (data.staff && data.staff.length > 0) setStaffList(data.staff);
      if (data.progressReports && data.progressReports.length > 0) setProgressReports(data.progressReports);

      setSheetsConfig((prev) => ({
        ...prev,
        isSynced: true,
        lastSyncedAt: new Date().toLocaleTimeString(),
      }));
    } catch (err) {
      console.error('Error fetching sheet contents:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Push updates to Google Sheet
  const syncUpdatesToGoogleSheet = async (
    updatedTasks?: YTDTask[],
    updatedReports?: MonthProgress[]
  ) => {
    if (!token || !sheetsConfig.spreadsheetId) return;

    setIsSyncing(true);
    try {
      if (updatedTasks) {
        await GoogleSheetsService.saveYTDTasksToSheet(token, sheetsConfig.spreadsheetId, updatedTasks);
      }
      if (updatedReports) {
        await GoogleSheetsService.saveProgressReportsToSheet(token, sheetsConfig.spreadsheetId, updatedReports);
      }
      
      setSheetsConfig((prev) => ({
        ...prev,
        isSynced: true,
        lastSyncedAt: new Date().toLocaleTimeString(),
      }));
    } catch (err) {
      console.error('Error syncing updates to sheet:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Add YTD Task
  const handleAddTask = (newTask: Omit<YTDTask, 'id' | 'daysRemaining'>) => {
    const due = new Date(newTask.dueDate);
    const start = new Date(newTask.startDate);
    const diffTime = due.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const task: YTDTask = {
      ...newTask,
      id: `ytd_${Math.random().toString(36).substr(2, 9)}`,
      daysRemaining: diffDays > 0 ? diffDays : 0,
    };

    const updatedTasks = [...tasks, task];
    setTasks(updatedTasks);

    // Sync to sheet if active
    if (sheetsConfig.spreadsheetId) {
      syncUpdatesToGoogleSheet(updatedTasks, undefined);
    }
  };

  // Update YTD Task
  const handleUpdateTask = (updatedTask: YTDTask) => {
    const updatedTasks = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    setTasks(updatedTasks);

    // Sync to sheet if active
    if (sheetsConfig.spreadsheetId) {
      syncUpdatesToGoogleSheet(updatedTasks, undefined);
    }
  };

  // Delete YTD Task
  const handleDeleteTask = (id: string) => {
    const updatedTasks = tasks.filter((t) => t.id !== id);
    setTasks(updatedTasks);

    // Sync to sheet if active
    if (sheetsConfig.spreadsheetId) {
      syncUpdatesToGoogleSheet(updatedTasks, undefined);
    }
  };

  // Save Progress reports and linked YTD Tasks for an employee
  const handleSaveProgress = (email: string, updatedReports: MonthProgress[], updatedYTDTasks?: YTDTask[]) => {
    const updatedAllReports = progressReports.map((report) => {
      const match = updatedReports.find((r) => r.id === report.id);
      return match ? match : report;
    });

    setProgressReports(updatedAllReports);

    let finalTasks = tasks;
    if (updatedYTDTasks) {
      setTasks(updatedYTDTasks);
      finalTasks = updatedYTDTasks;
    }

    // Sync to sheet if active
    if (sheetsConfig.spreadsheetId) {
      syncUpdatesToGoogleSheet(updatedYTDTasks ? updatedYTDTasks : undefined, updatedAllReports);
    }
  };

  // Quick navigation to user profile from Overview
  const handleNavigateToStaff = (email: string) => {
    handleSimulateEmailChange(email);
    handleTabChange('personal');
  };

  // Add new staff member and initialize progress reports
  const handleAddStaff = (newStaff: StaffMember) => {
    // Generate 12 months reports for this staff member
    const newReports: MonthProgress[] = MONTHS.map(month => ({
      id: `${newStaff.email}_${month}`,
      staffEmail: newStaff.email,
      month,
      activity: newStaff.activity,
      tasks: Array.from({ length: 15 }, () => ({ description: '', completed: null }))
    }));

    const updatedStaffList = [...staffList, newStaff];
    const updatedReports = [...progressReports, ...newReports];

    setStaffList(updatedStaffList);
    setProgressReports(updatedReports);

    // Sync to Google Sheets if linked
    if (sheetsConfig.spreadsheetId && token) {
      GoogleSheetsService.saveStaffProfilesToSheet(token, sheetsConfig.spreadsheetId, updatedStaffList);
      GoogleSheetsService.saveProgressReportsToSheet(token, sheetsConfig.spreadsheetId, updatedReports);
    }
  };

  // Update existing staff member (e.g., toggling role)
  const handleUpdateStaff = (updatedStaff: StaffMember) => {
    const updatedStaffList = staffList.map(s => s.email === updatedStaff.email ? updatedStaff : s);
    setStaffList(updatedStaffList);

    // Sync to Google Sheets if linked
    if (sheetsConfig.spreadsheetId && token) {
      GoogleSheetsService.saveStaffProfilesToSheet(token, sheetsConfig.spreadsheetId, updatedStaffList);
    }
  };

  // Delete staff member and their progress reports
  const handleDeleteStaff = (email: string) => {
    const updatedStaffList = staffList.filter(s => s.email !== email);
    const updatedReports = progressReports.filter(r => r.staffEmail !== email);

    setStaffList(updatedStaffList);
    setProgressReports(updatedReports);

    // Sync to Google Sheets if linked
    if (sheetsConfig.spreadsheetId && token) {
      GoogleSheetsService.saveStaffProfilesToSheet(token, sheetsConfig.spreadsheetId, updatedStaffList);
      GoogleSheetsService.saveProgressReportsToSheet(token, sheetsConfig.spreadsheetId, updatedReports);
    }
  };

  // If not logged in, render a gorgeous Landing & Login Page
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-white font-sans relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.15),transparent_50%)] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,rgba(30,41,59,0.5),transparent_50%)] pointer-events-none" />
        
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 space-y-6 animate-fade-in">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 mx-auto transform hover:rotate-3 transition-transform duration-300">
              <FileSpreadsheet className="w-9 h-9 text-white" />
            </div>
            <div className="space-y-1">
              <span className="font-mono text-xs tracking-widest text-orange-400 font-bold uppercase">Orange Island Resorts</span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">Progress Tracker</h1>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Welcome to the Staff Performance & YTD Progress Portal.
            </p>
          </div>

          {authError && (
            <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-xs text-rose-300 space-y-1 text-left">
              <p className="font-bold">Access Notification</p>
              <p className="leading-relaxed">{authError}</p>
            </div>
          )}

          {/* First-Time Password Change Mode */}
          {isFirstLoginMode && firstLoginStaff ? (
            <form onSubmit={handleFirstTimePasswordSubmit} className="space-y-4">
              <div className="bg-orange-950/20 border border-orange-900/30 p-4 rounded-xl space-y-1 text-left">
                <p className="text-xs font-bold text-orange-400 flex items-center space-x-1.5 font-mono">
                  <Key className="w-4 h-4" />
                  <span>First-Time Password Activation</span>
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Welcome, <strong className="text-white">{firstLoginStaff.name}</strong>! Since this is your first time signing in, you must set a personalized password to activate your account.
                </p>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-mono font-bold text-slate-400 block flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>New Custom Password</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newFirstPassword}
                  onChange={(e) => setNewFirstPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors font-mono"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-mono font-bold text-slate-400 block flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Confirm Custom Password</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repeat your password"
                  value={confirmFirstPassword}
                  onChange={(e) => setConfirmFirstPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-sans font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer"
              >
                <span>Activate Account & Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFirstLoginMode(false);
                  setFirstLoginStaff(null);
                  setAuthError(null);
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-400 hover:underline py-1.5 transition-colors font-mono"
              >
                Cancel and Go Back
              </button>
            </form>
          ) : isResetMode ? (
            /* Forgot Password / Password Reset Mode */
            <form onSubmit={handleForgotPasswordReset} className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-1 text-left">
                <p className="text-xs font-bold text-slate-300 flex items-center space-x-1.5 font-mono">
                  <HelpCircle className="w-4 h-4 text-orange-400" />
                  <span>Self-Serve Password Reset</span>
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Enter your registered email and your exact full name as listed on the staff roster to establish a new password.
                </p>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-mono font-bold text-slate-400 block flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>Registered Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. uwa@orangeisland.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors font-mono"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-mono font-bold text-slate-400 block flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Registered Full Name</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Uwa"
                  value={resetName}
                  onChange={(e) => setResetName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors font-mono"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-mono font-bold text-slate-400 block flex items-center space-x-1">
                  <Key className="w-3.5 h-3.5 text-slate-500" />
                  <span>New Secure Password</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-sans font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer"
              >
                <span>Reset Password & Log In</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setAuthError(null);
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-300 hover:underline py-1.5 transition-colors font-mono"
              >
                Return to Login Page
              </button>
            </form>
          ) : (
            /* Standard Email / Password Sign In Form */
            <form onSubmit={handleCustomLogin} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-mono font-bold text-slate-400 block flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. uwa@orangeisland.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors font-mono"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-mono font-bold text-slate-400 block flex items-center space-x-1">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Password</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      setAuthError(null);
                    }}
                    className="text-[11px] text-orange-400 hover:text-orange-300 hover:underline transition-colors font-mono font-bold"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-sans font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer"
              >
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-slate-500 font-mono text-[10px] tracking-wider uppercase">Or Admin Drive Sync</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-slate-850 hover:bg-slate-800 active:bg-slate-900 text-slate-100 border border-slate-800 hover:border-slate-700 font-sans font-medium py-3 px-4 rounded-xl shadow hover:shadow-lg transition-all flex items-center justify-center space-x-3 text-sm cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current text-orange-400 animate-pulse" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Sign In with Google (Admin Boss)</span>
              </button>
            </form>
          )}

          {/* Tips and Credentials Information Panel */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
            <button
              type="button"
              onClick={() => setShowTroubleshooter(!showTroubleshooter)}
              className="w-full px-4 py-3 flex items-center justify-between text-slate-400 hover:text-slate-200 transition-colors text-xs font-mono font-semibold cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-orange-400" />
                <span>Roster Access Guidelines</span>
              </div>
              {showTroubleshooter ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>
            {showTroubleshooter && (
              <div className="p-4 border-t border-slate-850 bg-slate-950/80 text-xs text-slate-400 space-y-3 font-mono leading-relaxed text-left">
                <div className="space-y-1">
                  <p className="font-bold text-orange-400 text-[10px] uppercase tracking-wider">🔑 System Administrator Access</p>
                  <p className="text-slate-300">
                    Email: <span className="text-white select-all">oseghale5432@gmail.com</span>
                  </p>
                  <p className="text-slate-300">
                    Initial Password: <span className="text-white select-all">admin123</span>
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Note: The admin user will be prompted to customize their secure password upon first sign-in.
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-900">
                  <p className="font-bold text-orange-400 text-[10px] uppercase tracking-wider">👥 Employee Access</p>
                  <p className="text-slate-300">
                    Employees can log in once registered by an administrator.
                  </p>
                  <p className="text-slate-300">
                    Default Initial Password: Set by the administrator during registration (e.g. <span className="text-white">password123</span>).
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 font-mono tracking-wider">
              SECURE AUTHORIZED STAFF PORTAL
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header section with branding and switch simulation */}
      <Header
        currentUser={currentUser}
        simulatedEmail={simulatedEmail}
        onSimulateEmailChange={handleSimulateEmailChange}
        staffList={staffList}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onLogin={() => {}}
        onLogout={handleLogout}
        isSheetsLinked={sheetsConfig.spreadsheetId !== null}
        onLinkSheets={handleLinkSheets}
        isLinkingSheets={isLinkingSheets}
        spreadsheetUrl={sheetsConfig.spreadsheetUrl}
        isAdmin={isActualAdmin}
        hasToken={!!token}
        onConnectGoogle={handleConnectGoogle}
      />

      {/* Main workspace container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Iframe & Auth Error Notice */}
        {(!currentUser && isInIframe) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-sans font-bold text-amber-800 text-sm uppercase tracking-wide">
                  Browser Iframe Environment Detected
                </h3>
                <p className="text-xs text-amber-700 leading-relaxed">
                  You are viewing this progress tracker within an embedded AI Studio preview frame. Standard browser security policies block Google Authentication popups and storage access inside cross-origin frames.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-amber-200/50">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                Recommended Solution
              </span>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white font-sans font-bold text-xs px-4 py-2 rounded-lg shadow-md transition-all shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Tab to Sign In</span>
              </a>
            </div>
          </div>
        )}

        {authError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-sans font-bold text-rose-800 text-sm uppercase tracking-wide">
                  Sign-In Action Blocked
                </h3>
                <p className="text-xs text-rose-700 leading-relaxed">
                  {authError}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-rose-200/50">
              <button
                onClick={() => setAuthError(null)}
                className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors"
              >
                Dismiss Notice
              </button>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white font-sans font-bold text-xs px-4 py-2 rounded-lg shadow-md transition-all shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open App in New Tab</span>
              </a>
            </div>
          </div>
        )}
        
        {/* Drive & Sheet Sync Status banner */}
        {currentUser && !sheetsConfig.spreadsheetId && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
            <div className="space-y-1">
              <h3 className="font-sans font-extrabold text-base flex items-center space-x-2">
                <Database className="w-5 h-5 animate-bounce" />
                <span>Google Drive Integration Ready</span>
              </h3>
              <p className="text-sm text-orange-50">
                Create a linked workbook to save employee logs directly to a live Google Sheet spreadsheet in your Drive.
              </p>
            </div>
            <button
              onClick={handleLinkSheets}
              disabled={isLinkingSheets}
              className="bg-white text-orange-600 hover:bg-orange-50 font-bold text-sm px-5 py-2.5 rounded-lg shadow-md transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              {isLinkingSheets ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Initialize Sheets Database</span>
            </button>
          </div>
        )}

        {/* Sync Indicator */}
        {isSyncing && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 text-white border border-slate-700 px-4 py-2 rounded-full text-xs font-semibold shadow-2xl flex items-center space-x-2 z-50">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
            <span>Syncing database with Google Sheets...</span>
          </div>
        )}

        {/* Active Tab Workspace rendering */}
        <div className="transition-all duration-300">
          {currentTab === 'ytd' && (
            <YTDPage
              tasks={tasks}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              isAdmin={isAdmin}
              departments={departments}
              statuses={statuses}
            />
          )}

          {currentTab === 'overview' && isActualAdmin && (
            <OverviewPage
              staffList={staffList}
              progressReports={progressReports}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              onNavigateToStaff={handleNavigateToStaff}
              onAddStaff={handleAddStaff}
              onUpdateStaff={handleUpdateStaff}
              onDeleteStaff={handleDeleteStaff}
              currentUser={currentUser}
              departments={departments}
              statuses={statuses}
              onUpdateDepartments={handleUpdateDepartments}
              onUpdateStatuses={handleUpdateStatuses}
            />
          )}

          {currentTab === 'personal' && (
            <StaffProgressPage
              staffList={staffList}
              progressReports={progressReports}
              simulatedEmail={simulatedEmail}
              onSimulateEmailChange={handleSimulateEmailChange}
              onSaveProgress={handleSaveProgress}
              isAdmin={isAdmin}
              tasks={tasks}
              statuses={statuses}
            />
          )}
        </div>
      </main>

      {/* Footer copyright info */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-500 py-6 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 Orange Island Resorts. All Rights Reserved.</span>
          <div className="flex space-x-4">
            <span className="text-slate-400 font-mono">Status: {sheetsConfig.spreadsheetId ? 'Online (Google Sheets DB)' : 'Local Offline Mode'}</span>
            {sheetsConfig.lastSyncedAt && (
              <span className="text-slate-400 font-mono">Last Sync: {sheetsConfig.lastSyncedAt}</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
