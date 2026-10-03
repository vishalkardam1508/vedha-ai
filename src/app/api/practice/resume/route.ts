import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

// Keep the resume text bounded — it's spliced into every chat turn's system prompt plus the
// final report call, and a multi-page PDF can easily run to tens of thousands of characters.
const MAX_RESUME_CHARS = 8000;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Resume file is too large (max 5MB)." }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let text: string;
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText({ pageJoiner: "\n" });
        text = result.text;
      } finally {
        await parser.destroy();
      }
    } else if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return NextResponse.json({ error: "Please upload a PDF or DOCX resume." }, { status: 400 });
    }

    text = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) {
      return NextResponse.json({ error: "Couldn't read any text from that file — is it a scanned image?" }, { status: 422 });
    }

    return NextResponse.json({ text: text.slice(0, MAX_RESUME_CHARS) });
  } catch (err) {
    console.error("[api/practice/resume] Parse failed:", err);
    return NextResponse.json({ error: "Couldn't read that resume file. Please try a different PDF or DOCX." }, { status: 422 });
  }
}
