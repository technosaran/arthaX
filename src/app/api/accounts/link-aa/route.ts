import { NextResponse } from "next/server";
import { isAccountAggregatorEnabled } from "@/lib/account-aggregator/aa-config";
import { AccountAggregatorClient } from "@/lib/account-aggregator/aa-client";
import { AccountAggregatorSyncService } from "@/lib/account-aggregator/aa-service";
import { createClient } from "@/lib/supabase-server";
import logger from "@/lib/logger";

export async function GET() {
  const enabled = isAccountAggregatorEnabled();
  return NextResponse.json({ enabled });
}

export async function POST(request: Request) {
  if (!isAccountAggregatorEnabled()) {
    return NextResponse.json({ error: "Account Aggregator integration is currently disabled." }, { status: 404 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const body = await request.json();
    const { action, mobileNumber, consentHandleId, otp, selectedAccountIds } = body;

    const aaClient = new AccountAggregatorClient();

    // Action 1: Initiate Consent (starts flow for mobile number)
    if (action === "initiate") {
      const mob = mobileNumber || user.phone || "";
      if (!mob) {
        return NextResponse.json({ error: "Mobile number is required to link bank accounts." }, { status: 400 });
      }

      const consentHandle = await aaClient.initiateConsent(mob);
      const discoveredAccounts = await aaClient.discoverAccounts(consentHandle.consentHandleId, mob);

      return NextResponse.json({
        success: true,
        consentHandleId: consentHandle.consentHandleId,
        mobileNumber: mob,
        discoveredAccounts,
      });
    }

    // Action 2: Verify OTP & Sync Authorized Bank Accounts
    if (action === "verify") {
      if (!consentHandleId || !otp) {
        return NextResponse.json({ error: "Consent Handle ID and OTP are required." }, { status: 400 });
      }

      const verificationResult = await aaClient.verifyOtpAndFetchData(
        consentHandleId,
        otp,
        selectedAccountIds || [],
        mobileNumber || ""
      );

      const syncService = new AccountAggregatorSyncService(supabase);
      const syncResult = await syncService.syncAccounts(user.id, verificationResult.accounts);

      logger.info("AA Route: Bank Sync Complete", { userId: user.id, syncedCount: syncResult.syncedCount });

      return NextResponse.json({
        success: true,
        message: `Successfully linked and synced ${syncResult.syncedCount} bank account(s)!`,
        ...syncResult,
      });
    }

    return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
  } catch (err: any) {
    logger.error("AA API Error", { message: err?.message || String(err) });
    return NextResponse.json(
      { error: err?.message || "An error occurred during Account Aggregator bank linking." },
      { status: 500 }
    );
  }
}
