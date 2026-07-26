import { NextResponse } from "next/server";
import { parseCASText } from "@/lib/cas-parser/cas-parser-engine";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let textContent = "";
    let password = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      password = (formData.get("password") as string) || "";

      if (!file) {
        return NextResponse.json({ error: "No CAS statement file uploaded" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        try {
          const pdfParse = require("pdf-parse");
          const options: Record<string, any> = {};
          if (password) options.password = password;

          const pdfData = await pdfParse(buffer, options);
          textContent = pdfData.text || "";
        } catch (pdfErr: any) {
          const errMsg = pdfErr?.message || String(pdfErr);
          console.error("PDF parse error for CAS file:", errMsg);

          if (
            pdfErr?.name === "PasswordException" ||
            errMsg.toLowerCase().includes("password") ||
            errMsg.toLowerCase().includes("encrypted")
          ) {
            return NextResponse.json(
              {
                error:
                  "This CAS statement PDF is password-protected. Please enter your PDF password (e.g. PAN in capital letters or DOB) in the password field.",
              },
              { status: 400 }
            );
          }
          textContent = buffer.toString("utf-8");
        }
      } else {
        textContent = buffer.toString("utf-8");
      }
    } else {
      const body = await request.json();
      textContent = body.text || "";
      password = body.password || "";
    }

    if (!textContent || textContent.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from CAS statement. Please enter your PDF password if encrypted." },
        { status: 400 }
      );
    }

    const result = parseCASText(textContent);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error parsing CAS statement:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse CAS statement" },
      { status: 500 }
    );
  }
}
