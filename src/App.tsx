/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState, useEffect } from 'react';
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
  User,
  Eye,
  EyeOff
} from 'lucide-react';
import { YTDTask, StaffMember, MonthProgress, SpreadsheetConfig, PaymentRequest, PaymentStatus, AppNotification } from './types';
import { 
  DEFAULT_STAFF, 
  DEFAULT_YTD_TASKS, 
  generateDefaultProgressReports,
  MONTHS,
  getCurrentLagosMonth
} from './data/mockData';
import Header from './components/Header';
import YTDPage from './components/YTDPage';
import OverviewPage from './components/OverviewPage';
import StaffProgressPage from './components/StaffProgressPage';
import PaymentPage from './components/PaymentPage';
import NotificationsPage from './components/NotificationsPage';
import { ApiClient, WorkbookPayload } from './apiClient';
import { requestNotificationPermission, subscribeToPushNotifications, onForegroundMessage } from './firebaseMessaging';
import { DEFAULT_ACCOUNTING_CODES } from './data/accountingCodes';

const DEFAULT_CONTRACTOR_HEADS = [
  'BRICK MORTAR STEEL (BMS)',
  '4 CLANS DEVELOPMENT',
  'CENTURION (ACCESS)',
  'DEL / VIATHAN (IPP)',
  'DELANO ARCHITECS',
  'EKEDC',
  'ELIZABETH SANDFILLING',
  'GATAS (GENERATORS)',
  'GREEN TREATS (IRRIGATION)',
  'INTRACONTRA / MTN',
  'KENOL (NEW METERS)',
  'KENOL (RETICULATION)',
  'LASBCA',
  'LASPPPA',
  'LAWMA',
  'OIDC ACCOUNTS',
  'OIDC BOARD',
  'OIMC',
  'OTHER',
  'PILGRIMS (CCTV)',
  'PILGRIMS (GUARDS)',
  'POWERFLOW',
  'ROELAG (WWTP)',
  'SAYKAY (ROADS)',
  'STEERING COMMITTEE',
  'TEZEON (WTP)',
  'TISD (POWER VENDING)',
  'VENCO',
];

export default function App() {
  // Authentication & Session States
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('oi_current_user');
    return saved ? JSON.parse(saved) : null;
  });
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
  const [firstLoginCurrentPassword, setFirstLoginCurrentPassword] = useState('');
  const [newFirstPassword, setNewFirstPassword] = useState('');
  const [confirmFirstPassword, setConfirmFirstPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showNewFirstPassword, setShowNewFirstPassword] = useState(false);
  const [showConfirmFirstPassword, setShowConfirmFirstPassword] = useState(false);

  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [pushToken, setPushToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('oi_push_token');
  });
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: any) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
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
        name: 'Super Admin',
        department: 'MANAGEMENT',
        activity: 'SUPER ADMIN',
        label: 'Super Admin',
        isNew: false,
        role: 'admin',
        password: 'admin123',
        isFirstLogin: true
      });
    } else {
      const admin = list[superAdminIndex];
      if (admin.name === 'Admin Boss') admin.name = 'Super Admin';
      if (!admin.label || admin.label.includes('Admin Boss')) admin.label = 'Super Admin';
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
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [canApprovePayments, setCanApprovePayments] = useState(false);
  const [canCompletePayments, setCanCompletePayments] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [contractorHeads, setContractorHeads] = useState<string[]>(() => {
    const saved = localStorage.getItem('oi_contractor_heads');
    return saved ? JSON.parse(saved) : DEFAULT_CONTRACTOR_HEADS;
  });
  const [accountingCodes, setAccountingCodes] = useState<string[]>(() => {
    const saved = localStorage.getItem('oi_accounting_codes');
    return saved ? JSON.parse(saved) : DEFAULT_ACCOUNTING_CODES;
  });

  const handleUpdateDepartments = (newDepts: string[]) => {
    setDepartments(newDepts);
    localStorage.setItem('oi_departments', JSON.stringify(newDepts));
  };

  const handleUpdateStatuses = (newStatuses: string[]) => {
    setStatuses(newStatuses);
    localStorage.setItem('oi_statuses', JSON.stringify(newStatuses));
  };

  const handleUpdateContractorHeads = (newContractorHeads: string[]) => {
    setContractorHeads(newContractorHeads);
    localStorage.setItem('oi_contractor_heads', JSON.stringify(newContractorHeads));
  };
  const handleUpdateAccountingCodes = (newCodes: string[]) => {
    setAccountingCodes(newCodes);
    localStorage.setItem('oi_accounting_codes', JSON.stringify(newCodes));
  };

  // Navigation & View States
  const [currentTab, setCurrentTab] = useState<string>(() => {
    return localStorage.getItem('oi_current_tab') || 'ytd';
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentLagosMonth);

  // Notifications States
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isSavingNotification, setIsSavingNotification] = useState(false);

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

  const applyServerWorkbook = (workbook: WorkbookPayload) => {
    setTasks(workbook.ytdTasks || []);
    setStaffList((workbook.staff || []).map((staff) => (
      staff.email?.toLowerCase() === 'oseghale5432@gmail.com'
        ? {
            ...staff,
            name: staff.name === 'Admin Boss' ? 'Super Admin' : staff.name || 'Super Admin',
            label: !staff.label || staff.label.includes('Admin Boss') ? 'Super Admin' : staff.label,
          }
        : staff
    )));
    setProgressReports(workbook.progressReports || []);
    setSheetsConfig((prev) => ({
      ...prev,
      spreadsheetId: workbook.databaseId || prev.spreadsheetId || 'firestore',
      spreadsheetUrl: null,
      isSynced: true,
      lastSyncedAt: new Date().toLocaleTimeString(),
    }));
  };

  const refreshServerWorkbook = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setIsSyncing(true);
    try {
      const workbook = await ApiClient.loadWorkbook();
      applyServerWorkbook(workbook);
      return workbook;
    } catch (err: any) {
      console.warn('Server-managed workbook is not available yet:', err);
      throw err;
    } finally {
      if (!options.silent) setIsSyncing(false);
    }
  }, []);

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

  useEffect(() => {
    if (!currentUser) return;

    refreshServerWorkbook()
      .catch((err) => {
        if (String(err?.message || err).includes('401')) {
          setSheetsConfig({
            spreadsheetId: null,
            spreadsheetUrl: null,
            isSynced: false,
            lastSyncedAt: null,
          });
        }
      });
  }, [currentUser?.email, refreshServerWorkbook]);

  useEffect(() => {
    if (!currentUser || currentTab !== 'ytd') return;

    refreshServerWorkbook({ silent: true }).catch(() => {});
    const timer = window.setInterval(() => {
      refreshServerWorkbook({ silent: true }).catch(() => {});
    }, 300000);

    return () => window.clearInterval(timer);
  }, [currentUser, currentTab, refreshServerWorkbook]);

  const refreshPayments = useCallback(async () => {
    const result = await ApiClient.loadPayments();
    setPayments(result.payments);
    setCanApprovePayments(result.canApprove);
    setCanCompletePayments(result.canComplete);
  }, []);

  useEffect(() => {
    if (!currentUser || currentTab !== 'payment') return;
    refreshPayments()
      .then(() => setPaymentError(null))
      .catch((err) => setPaymentError(err.message || 'Could not load payments.'));
    const timer = window.setInterval(() => refreshPayments().catch(() => {}), 300000);
    return () => window.clearInterval(timer);
  }, [currentUser, currentTab, refreshPayments]);

  const refreshNotifications = useCallback(async () => {
    try {
      const result = await ApiClient.loadNotifications();
      setNotifications(result.notifications);
    } catch {
      // Fail silently
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    refreshNotifications().catch(() => {});
    // Poll for notifications every 30 seconds for quick updates
    const timer = window.setInterval(() => refreshNotifications().catch(() => {}), 30000);
    return () => window.clearInterval(timer);
  }, [currentUser, refreshNotifications]);

  useEffect(() => {
    if (!currentUser || currentTab !== 'notifications') return;
    refreshNotifications().catch(() => {});
  }, [currentUser, currentTab, refreshNotifications]);

  const handleSubmitPayment = async (
    payment: Pick<PaymentRequest, 'code' | 'payment' | 'description' | 'amount'>
  ) => {
    setIsSavingPayment(true);
    setPaymentError(null);
    try {
      const result = await ApiClient.createPayment(payment);
      setPayments(result.payments);
      setCanApprovePayments(result.canApprove);
      setCanCompletePayments(result.canComplete);
      refreshNotifications().catch(() => {});
    } catch (err: any) {
      setPaymentError(err.message || 'Could not submit payment request.');
      throw err;
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handlePaymentStatus = async (id: string, status: PaymentStatus, rejectionNotes?: string) => {
    setIsSavingPayment(true);
    setPaymentError(null);
    try {
      const result = await ApiClient.updatePaymentStatus(id, status, rejectionNotes);
      setPayments(result.payments);
      setCanApprovePayments(result.canApprove);
      setCanCompletePayments(result.canComplete);
      refreshNotifications().catch(() => {});
    } catch (err: any) {
      setPaymentError(err.message || 'Could not update payment status.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleMarkNotificationsRead = async (id?: string) => {
    setIsSavingNotification(true);
    try {
      const result = await ApiClient.markNotificationRead(id);
      setNotifications(result.notifications);
    } catch (err: any) {
      console.error('Failed to mark notifications read:', err);
    } finally {
      setIsSavingNotification(false);
    }
  };



  // Custom Login Flow Handler
  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();

    if (!email || !password) {
      setAuthError('Please enter both your email address and password.');
      return;
    }

    try {
      const result = await ApiClient.login(email, password);

      if (result.requiresPasswordChange && result.staff) {
        setFirstLoginStaff(result.staff);
        setFirstLoginCurrentPassword(password);
        setIsFirstLoginMode(true);
        return;
      }

      if (result.user && result.workbook) {
        setCurrentUser(result.user);
        applyServerWorkbook(result.workbook);
        handleSimulateEmailChange(result.user.email);
        setAuthError(null);
        setLoginEmail('');
        setLoginPassword('');
      }
    } catch (err: any) {
      setAuthError(`Access Denied: ${err.message || 'Login failed.'}`);
    }
  };

  // First-Time Login Password Activation Handler
  const handleFirstTimePasswordSubmit = async (e: React.FormEvent) => {
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

    try {
      const result = await ApiClient.changePassword(firstLoginStaff.email, firstLoginCurrentPassword, pass);
      setCurrentUser(result.user);
      applyServerWorkbook(result.workbook);
      handleSimulateEmailChange(result.user.email);

      setIsFirstLoginMode(false);
      setFirstLoginStaff(null);
      setFirstLoginCurrentPassword('');
      setNewFirstPassword('');
      setConfirmFirstPassword('');
      setLoginEmail('');
      setLoginPassword('');
      alert('Your secure custom password has been registered successfully! Welcome to the Progress Tracker portal.');
    } catch (err: any) {
      setAuthError(err.message || 'Password setup failed.');
    }
  };

  // Self-Serve Forgot Password Reset Handler (Verifies name and resets password)
  const handleForgotPasswordReset = async (e: React.FormEvent) => {
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

    try {
      const result = await ApiClient.resetPassword(email, name, newPass);
      setCurrentUser(result.user);
      applyServerWorkbook(result.workbook);
      handleSimulateEmailChange(result.user.email);

      setIsResetMode(false);
      setResetName('');
      setResetNewPassword('');
      setLoginEmail('');
      setLoginPassword('');
      alert('Your password has been reset successfully! You have been logged into your secure session.');
    } catch (err: any) {
      setAuthError(`Verification Failed: ${err.message || 'Password reset failed.'}`);
    }
  };

  // Logout Trigger
  const handleLogout = async () => {
    try {
      await ApiClient.logout();
    } catch (err) {
      console.error('Server logout failed:', err);
    }
    setCurrentUser(null);
    localStorage.removeItem('oi_current_user');
    handleSimulateEmailChange('oseghale5432@gmail.com');
    setSheetsConfig({
      spreadsheetId: null,
      spreadsheetUrl: null,
      isSynced: false,
      lastSyncedAt: null,
    });
  };

  // Load the server-managed Firestore database configured in Vercel.
  const handleLinkSheets = async () => {
    setIsLinkingSheets(true);
    try {
      await refreshServerWorkbook();
      alert('Firestore database loaded. Admins and employees are now using the same live database.');
    } catch (err: any) {
      console.error('Failed to load Firestore:', err);
      alert(`Could not load Firestore. Check the Firebase service-account environment variables. Details: ${err.message || err}`);
    } finally {
      setIsLinkingSheets(false);
    }
  };

  // Push updates to Firestore.
  const syncUpdatesToGoogleSheet = async (
    updatedTasks?: YTDTask[],
    updatedReports?: MonthProgress[]
  ) => {
    setIsSyncing(true);
    try {
      const workbook = updatedReports
        ? await ApiClient.saveProgress(simulatedEmail, updatedReports, updatedTasks)
        : updatedTasks
        ? await ApiClient.saveYTDTasks(updatedTasks)
        : null;

      if (workbook) applyServerWorkbook(workbook);
      
      setSheetsConfig((prev) => ({
        ...prev,
        isSynced: true,
        lastSyncedAt: new Date().toLocaleTimeString(),
      }));
    } catch (err: any) {
      console.error('Error syncing updates to sheet:', err);
      alert(`Could not sync changes to Firestore: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Add YTD Task
  const handleAddTask = async (newTask: Omit<YTDTask, 'id' | 'daysRemaining'>) => {
    const due = new Date(newTask.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const task: YTDTask = {
      ...newTask,
      id: `ytd_${Math.random().toString(36).substr(2, 9)}`,
      daysRemaining: diffDays > 0 ? diffDays : 0,
    };

    const updatedTasks = [...tasks, task];
    setTasks(updatedTasks);

    // Logged-in users save through Firestore.
    if (currentUser) {
      await syncUpdatesToGoogleSheet(updatedTasks, undefined);
    }
  };

  // Update YTD Task
  const handleUpdateTask = async (updatedTask: YTDTask) => {
    const updatedTasks = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    setTasks(updatedTasks);

    // Logged-in users save through Firestore.
    if (currentUser) {
      await syncUpdatesToGoogleSheet(updatedTasks, undefined);
    }
  };

  // Delete YTD Task
  const handleDeleteTask = async (id: string) => {
    const updatedTasks = tasks.filter((t) => t.id !== id);
    setTasks(updatedTasks);

    // Logged-in users save through Firestore.
    if (currentUser) {
      await syncUpdatesToGoogleSheet(updatedTasks, undefined);
    }
  };

  // Save Progress reports and linked YTD Tasks for an employee
  const handleSaveProgress = async (email: string, updatedReports: MonthProgress[], updatedYTDTasks?: YTDTask[]) => {
    const existingReportIds = new Set(progressReports.map((report) => report.id));
    const updatedAllReports = progressReports.map((report) => {
      const match = updatedReports.find((r) => r.id === report.id);
      return match ? match : report;
    }).concat(updatedReports.filter((report) => !existingReportIds.has(report.id)));

    setProgressReports(updatedAllReports);

    if (updatedYTDTasks) {
      setTasks(updatedYTDTasks);
    }

    // Logged-in users save through Firestore.
    if (currentUser) {
      setIsSyncing(true);
      try {
        const workbook = await ApiClient.saveProgress(email, updatedReports, updatedYTDTasks);
        applyServerWorkbook(workbook);
      } catch (err: any) {
        console.error('Error saving progress through server:', err);
        alert(`Could not save progress to Firestore: ${err.message || err}`);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Quick navigation to user profile from Overview
  const handleNavigateToStaff = (email: string) => {
    handleSimulateEmailChange(email);
    handleTabChange('personal');
  };

  // Add new staff member and initialize progress reports
  const handleAddStaff = async (newStaff: StaffMember) => {
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

    // Logged-in admins save staff through Firestore.
    if (currentUser) {
      try {
        const workbook = await ApiClient.saveStaff(updatedStaffList, updatedReports);
        applyServerWorkbook(workbook);
      } catch (err: any) {
        alert(`Could not save staff profile to Firestore: ${err.message || err}`);
      }
    }
  };

  // Update existing staff member (e.g., toggling role)
  const handleUpdateStaff = async (updatedStaff: StaffMember) => {
    const updatedStaffList = staffList.map(s => s.email === updatedStaff.email ? updatedStaff : s);
    setStaffList(updatedStaffList);

    // Logged-in admins save staff through Firestore.
    if (currentUser) {
      try {
        const workbook = await ApiClient.saveStaff(updatedStaffList);
        applyServerWorkbook(workbook);
      } catch (err: any) {
        alert(`Could not update staff profile in Firestore: ${err.message || err}`);
      }
    }
  };

  // Delete staff member and their progress reports
  const handleDeleteStaff = async (email: string) => {
    const updatedStaffList = staffList.filter(s => s.email !== email);
    const updatedReports = progressReports.filter(r => r.staffEmail !== email);

    setStaffList(updatedStaffList);
    setProgressReports(updatedReports);

    // Logged-in admins save staff through Firestore.
    if (currentUser) {
      try {
        const workbook = await ApiClient.saveStaff(updatedStaffList, updatedReports);
        applyServerWorkbook(workbook);
      } catch (err: any) {
        alert(`Could not delete staff profile from Firestore: ${err.message || err}`);
      }
    }
  };

  const registerNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationStatus('This browser does not support notifications.');
      return;
    }

    try {
      const permission = await requestNotificationPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') {
        setNotificationStatus('Notifications are blocked or not granted.');
        return;
      }

      const token = await subscribeToPushNotifications();
      if (!token) {
        setNotificationStatus('Unable to obtain a push notification token.');
        return;
      }

      setPushToken(token);
      localStorage.setItem('oi_push_token', token);
      await ApiClient.registerPushToken(token);
      setNotificationStatus('Progress reminder notifications are enabled.');
    } catch (error: any) {
      setNotificationStatus(`Notification setup failed: ${error.message || String(error)}`);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (pushToken) {
      ApiClient.registerPushToken(pushToken).catch(() => {});
      return;
    }
    registerNotifications();
  }, [currentUser, pushToken, registerNotifications]);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onForegroundMessage((payload) => {
      if (payload.notification?.title || payload.notification?.body) {
        setNotificationStatus(`Reminder received: ${payload.notification.title || ''} ${payload.notification.body || ''}`);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleBroadcastReminder = async () => {
    try {
      const result = await ApiClient.broadcastNotification(
        'Update your progress now',
        'Please update your progress in the app as you complete your tasks.'
      );
      alert(`Reminder sent to ${result.delivered} staff.`);
      refreshNotifications().catch(() => {});
    } catch (error: any) {
      alert(`Failed to send reminder: ${error.message || String(error)}`);
    }
  };

  const handleInstallApp = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choiceResult = await deferredInstallPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setDeferredInstallPrompt(null);
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
            <img
              src={new URL('../assets/orange-island-logo-white.png', import.meta.url).href}
              alt="Orange Island Lagos"
              className="mx-auto h-20 w-auto max-w-[240px] object-contain"
            />
            <div className="space-y-1">
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
                <div className="relative">
                <input
                  type={showNewFirstPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  value={newFirstPassword}
                  onChange={(e) => setNewFirstPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 pr-12 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors font-mono"
                />
                <button type="button" onClick={() => setShowNewFirstPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 px-4 text-slate-500 hover:text-orange-400"
                  aria-label={showNewFirstPassword ? 'Hide password' : 'Show password'}>
                  {showNewFirstPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-mono font-bold text-slate-400 block flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Confirm Custom Password</span>
                </label>
                <div className="relative">
                <input
                  type={showConfirmFirstPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat your password"
                  value={confirmFirstPassword}
                  onChange={(e) => setConfirmFirstPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 pr-12 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors font-mono"
                />
                <button type="button" onClick={() => setShowConfirmFirstPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 px-4 text-slate-500 hover:text-orange-400"
                  aria-label={showConfirmFirstPassword ? 'Hide password' : 'Show password'}>
                  {showConfirmFirstPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                </div>
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
                <div className="relative">
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 pr-12 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors font-mono"
                />
                <button type="button" onClick={() => setShowResetPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 px-4 text-slate-500 hover:text-orange-400"
                  aria-label={showResetPassword ? 'Hide password' : 'Show password'}>
                  {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                </div>
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
                <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 pr-12 text-sm text-slate-100 placeholder-slate-650 focus:outline-none transition-colors font-mono"
                />
                <button type="button" onClick={() => setShowLoginPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 px-4 text-slate-500 hover:text-orange-400"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}>
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-sans font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer"
              >
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
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
        onBroadcastReminder={handleBroadcastReminder}
        unreadCount={notifications.filter((n) => !n.isRead).length}
      />

      {/* Main workspace container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {(notificationStatus || deferredInstallPrompt) && (
          <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm p-4 space-y-3 text-sm text-slate-700">
            {notificationStatus && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">Notification status</p>
                  <p className="text-slate-600">{notificationStatus}</p>
                </div>
                {notificationPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={registerNotifications}
                    className="inline-flex items-center justify-center rounded-full bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-500 transition-colors"
                  >
                    Enable reminders
                  </button>
                )}
              </div>
            )}
            {deferredInstallPrompt && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">Install the app</p>
                  <p className="text-slate-600">Add this tracker to your phone or desktop for faster access.</p>
                </div>
                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
                >
                  Install App
                </button>
              </div>
            )}
          </div>
        )}

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
        {currentUser && isActualAdmin && !sheetsConfig.spreadsheetId && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
            <div className="space-y-1">
              <h3 className="font-sans font-extrabold text-base flex items-center space-x-2">
                <Database className="w-5 h-5 animate-bounce" />
                <span>Firestore Database Not Loaded</span>
              </h3>
              <p className="text-sm text-orange-50">
                Load the shared Firestore project configured in Vercel. Admins and employees use this same database.
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
              <span>Load Server Sheet</span>
            </button>
          </div>
        )}

        {/* Sync Indicator */}
        {isSyncing && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 text-white border border-slate-700 px-4 py-2 rounded-full text-xs font-semibold shadow-2xl flex items-center space-x-2 z-50">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
            <span>Syncing database with Firestore...</span>
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
              staffList={staffList}
              contractorHeads={contractorHeads}
            />
          )}

          {currentTab === 'overview' && (
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
              contractorHeads={contractorHeads}
              accountingCodes={accountingCodes}
              onUpdateDepartments={handleUpdateDepartments}
              onUpdateStatuses={handleUpdateStatuses}
              onUpdateContractorHeads={handleUpdateContractorHeads}
              onUpdateAccountingCodes={handleUpdateAccountingCodes}
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

          {currentTab === 'payment' && (
            <PaymentPage
              payments={payments}
              canApprove={canApprovePayments}
              canComplete={canCompletePayments}
              isSaving={isSavingPayment}
              accountingCodes={accountingCodes}
              error={paymentError}
              onSubmit={handleSubmitPayment}
              onUpdateStatus={handlePaymentStatus}
            />
          )}

          {currentTab === 'notifications' && (
            <NotificationsPage
              notifications={notifications}
              onMarkRead={handleMarkNotificationsRead}
              isSaving={isSavingNotification}
            />
          )}
        </div>
      </main>

      {/* Footer copyright info */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-500 py-6 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 Orange Island Resorts. All Rights Reserved.</span>
          <div className="flex space-x-4">
            <span className="text-slate-400 font-mono">Status: {sheetsConfig.spreadsheetId ? 'Online (Firestore DB)' : 'Local Offline Mode'}</span>
            {sheetsConfig.lastSyncedAt && (
              <span className="text-slate-400 font-mono">Last Sync: {sheetsConfig.lastSyncedAt}</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
