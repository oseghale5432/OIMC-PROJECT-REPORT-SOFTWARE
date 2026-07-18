import { getSessionUser, isAdmin, readJson, sendJson, type ApiRequest, type ApiResponse } from './_server_helpers.js';
import { sendFcmMessage } from './_server_helpers.js';
import {
  fetchWorkbook,
  getDatabaseId,
  getPushTokens,
  sanitizeStaff,
  saveProgressReports,
  saveYTDTasks,
} from '../server/firestore.js';
import type { MonthProgress, YTDTask } from '../server/types.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: 'Not signed in.' });

    const body = await readJson(req);
    const targetEmail = body.email?.trim().toLowerCase();
    if (!targetEmail || !Array.isArray(body.reports)) {
      return sendJson(res, 400, { error: 'Invalid progress payload.' });
    }
    if (!isAdmin(user) && user.email.toLowerCase() !== targetEmail) {
      return sendJson(res, 403, { error: 'You can only edit your own workbook.' });
    }

    const workbook = await fetchWorkbook();
    const existingReportIds = new Set(workbook.progressReports.map((report) => report.id));
    const updatedReports = workbook.progressReports
      .map((report) => {
        const replacement = body.reports.find(
          (candidate: MonthProgress) =>
            candidate.id === report.id && candidate.staffEmail.toLowerCase() === targetEmail
        );
        return replacement || report;
      })
      .concat(
        body.reports.filter(
          (report: MonthProgress) =>
            report.staffEmail.toLowerCase() === targetEmail && !existingReportIds.has(report.id)
        )
      );

    let updatedTasks = workbook.ytdTasks;
    const changedStatuses: Array<{ description: string; newStatus: string }> = [];
    if (Array.isArray(body.ytdTasks)) {
      if (isAdmin(user)) {
        updatedTasks = body.ytdTasks;
      } else {
        updatedTasks = workbook.ytdTasks.map((task) => {
          const replacement = body.ytdTasks.find((candidate: YTDTask) => candidate.id === task.id);
          if (replacement && replacement.status !== task.status) {
            changedStatuses.push({ description: task.description, newStatus: replacement.status });
          }
          return replacement ? { ...task, status: replacement.status, remark: replacement.remark } : task;
        });
      }
      await saveYTDTasks(updatedTasks);

      if (changedStatuses.length && !isAdmin(user)) {
        try {
          const tokens = await getPushTokens();
          const adminEmails = workbook.staff
            .filter((staff) => staff.role === 'admin')
            .map((staff) => staff.email.toLowerCase());
          const adminTokens = tokens.filter((entry) => adminEmails.includes(entry.email.toLowerCase()));
          const details = changedStatuses.map((change) => `${change.description} → ${change.newStatus}`).join('; ');
          await Promise.all(
            adminTokens.map((entry) =>
              sendFcmMessage(
                entry.token,
                `${user.displayName || user.email} updated task status`,
                `${user.displayName || user.email} updated ${changedStatuses.length} task(s): ${details}`,
                { email: entry.email, actor: user.email }
              ).catch(() => undefined)
            )
          );
        } catch (error) {
          console.warn('Failed to send admin notifications:', error);
        }
      }
    }

    await saveProgressReports(updatedReports);
    return sendJson(res, 200, {
      ytdTasks: updatedTasks,
      staff: sanitizeStaff(workbook.staff),
      progressReports: updatedReports,
      databaseId: getDatabaseId(),
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Failed to save progress.' });
  }
}
