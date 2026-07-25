import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import fs from "fs";
import path from "path";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  const expectedSecret = process.env.MIGRATION_SECRET || process.env.CRON_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL environment variable is not configured" }, { status: 500 });
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    const telegramMigrationPath = path.join(process.cwd(), "supabase", "migrations", "20260718210000_telegram_integration.sql");
    const geminiMigrationPath = path.join(process.cwd(), "supabase", "migrations", "20260725140000_gemini_integration.sql");

    if (fs.existsSync(telegramMigrationPath)) {
      const sql1 = fs.readFileSync(telegramMigrationPath, "utf8");
      logger.info("Executing Telegram migration SQL...");
      await client.query(sql1);
    }

    if (fs.existsSync(geminiMigrationPath)) {
      const sql2 = fs.readFileSync(geminiMigrationPath, "utf8");
      logger.info("Executing Gemini migration SQL...");
      await client.query(sql2);
    }
    
    logger.info("Reloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    
    await client.end();

    return NextResponse.json({ success: true, message: "Migrations completed and API schema cache refreshed successfully!" });
  } catch (error: any) {
    console.error("Migration endpoint error:", error);
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
