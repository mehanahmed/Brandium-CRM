import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { readSession, unauthorized } from "@/lib/session-server";

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg", ".pdf"];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const rejectSize = () =>
  NextResponse.json(
    { success: false, error: "File is too large. The limit is 10 MB." },
    { status: 413 },
  );

const rejectType = () =>
  NextResponse.json(
    { success: false, error: "Only image or PDF files can be uploaded." },
    { status: 400 },
  );

export async function POST(req: Request) {
  if (!readSession(req)) return unauthorized();
  // Base64 JSON bodies are about a third larger than the file itself
  if (Number(req.headers.get("content-length") || 0) > MAX_UPLOAD_BYTES * 1.4) return rejectSize();

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
      }

      if (file.size > MAX_UPLOAD_BYTES) return rejectSize();
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadDir = path.resolve(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadDir, { recursive: true });

      const ext = (path.extname(file.name) || ".png").toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) return rejectType();
      const uniqueName = `logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      const filePath = path.join(uploadDir, uniqueName);

      await fs.writeFile(filePath, buffer);

      return NextResponse.json({
        success: true,
        url: `/uploads/${uniqueName}`,
      });
    }

    const body = await req.json();
    const { filename, base64 } = body;
    if (!filename || !base64) {
      return NextResponse.json(
        { success: false, error: "No file or image data provided" },
        { status: 400 },
      );
    }

    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    if (buffer.length > MAX_UPLOAD_BYTES) return rejectSize();

    const uploadDir = path.resolve(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = (path.extname(filename) || ".png").toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) return rejectType();
    const uniqueName = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/${uniqueName}`,
    });
  } catch (error: any) {
    console.error("Upload handler error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "File upload failed" },
      { status: 500 },
    );
  }
}
