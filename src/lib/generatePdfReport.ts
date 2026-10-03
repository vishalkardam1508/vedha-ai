import jsPDF from "jspdf";
import type { InterviewJSON } from "@/types";
import { formatTime } from "@/lib/utils";
import { summarizeQuestionBehavior } from "@/lib/behaviorSummary";

const MARGIN = 15;
const RED: [number, number, number] = [220, 38, 38];
const GREEN: [number, number, number] = [22, 163, 74];
const MUTED: [number, number, number] = [100, 116, 139];
const TEXT: [number, number, number] = [15, 23, 42];

function statusColor(status: InterviewJSON["status"]): [number, number, number] {
  if (status === "disqualified" || status === "rejected") return RED;
  if (status === "completed") return GREEN;
  return MUTED;
}

function statusLabel(status: InterviewJSON["status"]): string {
  if (status === "disqualified") return "DISQUALIFIED";
  if (status === "rejected") return "REJECTED";
  if (status === "completed") return "COMPLETED";
  return "ABANDONED";
}

// Renders the interview report as a real PDF file, client-side, no server involved — the
// point is a document a reviewer can actually open and read (with the violation snapshots
// visible inline), rather than scrolling through raw JSON.
export function generatePdfReport(data: InterviewJSON, statusOverride?: InterviewJSON["status"]): void {
  const status = statusOverride ?? data.status;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  function ensureSpace(need: number) {
    if (y + need > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function heading(text: string) {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...TEXT);
    doc.text(text, MARGIN, y);
    y += 3;
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 7;
  }

  function paragraph(text: string, size = 10, color: [number, number, number] = TEXT, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines: string[] = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
  }

  // ---- Header ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...TEXT);
  doc.text("Interview Report", MARGIN, y);
  y += 9;

  doc.setFontSize(11);
  doc.setTextColor(...statusColor(status));
  doc.text(statusLabel(status), MARGIN, y);
  y += 8;

  paragraph(`Interview ID: ${data.interviewId}`, 9, MUTED);
  paragraph(`Candidate ID: ${data.candidateId}`, 9, MUTED);
  paragraph(`Started: ${new Date(data.startTime).toLocaleString()}`, 9, MUTED);
  paragraph(`Ended: ${new Date(data.endTime).toLocaleString()}`, 9, MUTED);
  paragraph(
    `Duration: ${formatTime(data.duration)}   |   Questions: ${data.questions.length}   |   Warnings: ${data.warningCount}   |   Tab changes: ${data.tabChange}`,
    9,
    MUTED
  );
  y += 4;

  // ---- Violations (the highlight — includes the camera snapshot for each one) ----
  if (data.warnings.length > 0) {
    heading(`Flagged Violations (${data.warnings.length})`);
    for (const w of data.warnings) {
      ensureSpace(w.snapshot ? 42 : 16);
      paragraph(`${w.timestamp} — ${w.type.replace(/_/g, " ")}`, 10, RED, true);
      paragraph(w.message, 9, TEXT);
      if (w.snapshot) {
        try {
          const props = doc.getImageProperties(w.snapshot);
          const imgW = 55;
          const imgH = (props.height / props.width) * imgW;
          ensureSpace(imgH + 4);
          doc.addImage(w.snapshot, "JPEG", MARGIN, y, imgW, imgH);
          y += imgH + 6;
        } catch {
          // A malformed/unsupported image should never break the whole report generation.
        }
      } else {
        y += 2;
      }
    }
    y += 2;
  }

  // ---- Per-question summary ----
  heading("Per-Question Summary");
  for (const rec of data.questions) {
    ensureSpace(20);
    paragraph(`Q${rec.questionIndex + 1}. ${rec.question}`, 10, TEXT, true);
    paragraph(`Duration: ${formatTime(rec.duration)}`, 8.5, MUTED);
    paragraph(rec.transcript ? rec.transcript : "(No transcript recorded)", 9, TEXT);

    const entries = data.bodyLog.filter((e) => e.questionIndex === rec.questionIndex);
    if (entries.length > 0) {
      const summary = summarizeQuestionBehavior(entries);
      paragraph(`Behavior: ${summary.label}`, 8.5, MUTED);
    }
    y += 4;
  }

  doc.save(`interview-report-${data.interviewId}.pdf`);
}
