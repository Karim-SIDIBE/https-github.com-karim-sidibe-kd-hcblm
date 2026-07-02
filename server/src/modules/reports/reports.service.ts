/**
 * reports.service.ts — scheduled e-mail delivery of course reports (P3 brick 4).
 *
 * Admins define schedules (course + recipients + weekly/monthly + xlsx/csv); a
 * cron hits POST /jobs/scheduled-reports/run, which builds the report over the
 * full dataset (reusing the analytics workbook) and e-mails it as an attachment.
 */
import type { ReportFrequency } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { buildXlsx } from "../../lib/export/xlsx.js";
import { sendSmtpEmail, smtpConfigured } from "../../lib/notify/email.js";
import { env } from "../../config/env.js";
import { courseWorkbook } from "../analytics/analytics.service.js";

export class ReportError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const INTERVAL_DAYS: Record<ReportFrequency, number> = { WEEKLY: 7, MONTHLY: 30 };

/**
 * List schedules, optionally filtered by course, and confined to the courses the
 * caller may see (`visible`: "all" for platform staff, else an org-scoped id list).
 */
export async function listSchedules(courseId?: string, visible: "all" | string[] = "all") {
  const courseFilter =
    visible === "all"
      ? courseId
        ? { courseId }
        : {}
      : { courseId: courseId ? (visible.includes(courseId) ? courseId : "__none__") : { in: visible } };
  return prisma.reportSchedule.findMany({
    where: courseFilter,
    orderBy: { createdAt: "desc" },
  });
}

export async function createSchedule(input: {
  courseId: string; recipients: string[]; frequency: ReportFrequency; format?: string; createdById?: string;
}) {
  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  if (!course) throw new ReportError(404, "no_course", "Parcours introuvable");
  const recipients = [...new Set(input.recipients.map((r) => r.trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) throw new ReportError(400, "no_recipients", "Au moins un destinataire est requis.");
  const bad = recipients.filter((r) => !EMAIL_RE.test(r));
  if (bad.length) throw new ReportError(400, "bad_email", `Adresse(s) invalide(s) : ${bad.join(", ")}`);
  const format = input.format === "csv" ? "csv" : "xlsx";
  return prisma.reportSchedule.create({
    data: { courseId: input.courseId, recipients, frequency: input.frequency, format, createdById: input.createdById ?? null },
  });
}

export async function deleteSchedule(id: string, visible: "all" | string[] = "all") {
  const found = await prisma.reportSchedule.findUnique({ where: { id } });
  // Answer 404 (not 403) for a schedule outside the caller's tenant scope, so a
  // cross-tenant probe cannot confirm it exists.
  if (!found || (visible !== "all" && !visible.includes(found.courseId))) {
    throw new ReportError(404, "not_found", "Planification introuvable");
  }
  await prisma.reportSchedule.delete({ where: { id } });
  return { id };
}

/** Build the report file for a course (xlsx workbook or CSV of the Apprenants sheet). */
async function buildReportFile(courseId: string, format: string): Promise<{ filename: string; content: Buffer; contentType: string }> {
  const sheets = await courseWorkbook(courseId);
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const learners = sheets.find((s) => s.name === "Apprenants")?.rows ?? [];
    const csv = "﻿" + learners.map((row) => row.map((c) => {
      const s = c == null ? "" : String(c);
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("\r\n");
    return { filename: `rapport-${stamp}.csv`, content: Buffer.from(csv, "utf-8"), contentType: "text/csv; charset=utf-8" };
  }
  return {
    filename: `rapport-${stamp}.xlsx`, content: buildXlsx(sheets),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

/** Is a schedule due to send at `now`? (never sent, or older than its interval). */
export function isDue(schedule: { frequency: ReportFrequency; lastSentAt: Date | null }, now: Date): boolean {
  if (!schedule.lastSentAt) return true;
  const days = (now.getTime() - schedule.lastSentAt.getTime()) / 86_400_000;
  return days >= INTERVAL_DAYS[schedule.frequency];
}

export type ReportRunResult = {
  processed: number; sent: number; failed: number; skipped: number;
  details: { id: string; courseId: string; recipients: number; bytes: number; sent: number; error?: string }[];
};

/** Cron entry point: send every due schedule. Graceful — a failed schedule
 *  doesn't abort the run, and lastSentAt advances only on a successful send. */
export async function runDueReports(now: Date = new Date()): Promise<ReportRunResult> {
  const schedules = await prisma.reportSchedule.findMany({ where: { active: true } });
  const res: ReportRunResult = { processed: 0, sent: 0, failed: 0, skipped: 0, details: [] };
  for (const s of schedules) {
    if (!isDue(s, now)) { res.skipped++; continue; }
    res.processed++;
    try {
      const file = await buildReportFile(s.courseId, s.format);
      const course = await prisma.course.findUnique({ where: { id: s.courseId }, include: { versions: { take: 1, orderBy: { version: "desc" } } } });
      const title = course?.versions[0]?.title ?? "Parcours";
      const subject = `${env.BRAND_NAME} — Rapport « ${title} » (${now.toISOString().slice(0, 10)})`;
      const body = `Bonjour,\n\nVeuillez trouver ci-joint le rapport ${s.frequency === "WEEKLY" ? "hebdomadaire" : "mensuel"} du parcours « ${title} ».\n\nGénéré automatiquement par ${env.BRAND_NAME}.`;
      let sentOne = 0; let lastErr: string | undefined;
      for (const to of s.recipients) {
        try { await sendSmtpEmail(to, subject, body, [file]); sentOne++; res.sent++; }
        catch (e) { res.failed++; lastErr = e instanceof Error ? e.message : "send failed"; }
      }
      if (sentOne > 0) await prisma.reportSchedule.update({ where: { id: s.id }, data: { lastSentAt: now } });
      res.details.push({ id: s.id, courseId: s.courseId, recipients: s.recipients.length, bytes: file.content.length, sent: sentOne, ...(sentOne === 0 && lastErr ? { error: lastErr } : {}) });
    } catch (e) {
      res.failed++;
      res.details.push({ id: s.id, courseId: s.courseId, recipients: s.recipients.length, bytes: 0, sent: 0, error: e instanceof Error ? e.message : "build failed" });
    }
  }
  return { ...res, smtp: smtpConfigured() } as ReportRunResult & { smtp: boolean };
}
