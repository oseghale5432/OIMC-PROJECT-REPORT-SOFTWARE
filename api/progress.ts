import { readJson, sendJson, type ApiRequest, type ApiResponse } from '../server/http';
import { getSessionUser, isAdmin } from '../server/security';
import { fetchWorkbook, sanitizeStaff, saveProgressReports, saveYTDTasks } from '../server/googleSheets';
import type { MonthProgress, YTDTask } from '../server/types';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: 'Not signed in.' });

    const body = await readJson<{ email: string; reports: MonthProgress[]; ytdTasks?: YTDTask[] }>(req);
    const targetEmail = body.email?.trim().toLowerCase();
    if (!targetEmail || !Array.isArray(body.reports)) return sendJson(res, 400, { error: 'Invalid progress payload.' });
    if (!isAdmin(user) && user.email.toLowerCase() !== targetEmail) return sendJson(res, 403, { error: 'You can only edit your own workbook.' });

    const workbook = await fetchWorkbook();
    const updatedReports = workbook.progressReports.map((report) => {
      const replacement = body.reports.find((r) => r.id === report.id && r.staffEmail.toLowerCase() === targetEmail);
      return replacement || report;
    });

    let updatedTasks = workbook.ytdTasks;
    if (body.ytdTasks) {
      if (isAdmin(user)) {
        updatedTasks = body.ytdTasks;
      } else {
        updatedTasks = workbook.ytdTasks.map((task) => {
          const replacement = body.ytdTasks?.find((t) => t.id === task.id);
          return replacement ? { ...task, status: replacement.status, remark: replacement.remark } : task;
        });
      }
      await saveYTDTasks(updatedTasks);
    }

    await saveProgressReports(updatedReports);

    return sendJson(res, 200, {
      ytdTasks: updatedTasks,
      staff: sanitizeStaff(workbook.staff),
      progressReports: updatedReports,
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message || 'Failed to save progress.' });
  }
}
