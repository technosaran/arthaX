"use server";

import { createClient } from "@/lib/supabase-server";
import { getFriendlyErrorMessage, logLedgerEntry } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";

type RpcResult = {
  success: boolean;
  error?: string | null;
};

/* ── Family Members (family_members table) ── */

export async function addFamilyMember(data: { name: string; relationship: string; avatar_url?: string | null }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!data.name || data.name.trim().length === 0) {
      return { error: "Name is required" };
    }
    if (!data.relationship || data.relationship.trim().length === 0) {
      return { error: "Relationship is required" };
    }

    let insertRes = await supabase.from("family_members").insert({
      user_id: user.id,
      name: data.name.trim(),
      relationship: data.relationship.trim(),
      avatar_url: data.avatar_url?.trim() || null,
      balance: 0,
    }).select("id").single();

    if (insertRes.error && insertRes.error.message?.includes("avatar_url")) {
      // Fallback if avatar_url column is not yet present in Supabase table
      insertRes = await supabase.from("family_members").insert({
        user_id: user.id,
        name: data.name.trim(),
        relationship: data.relationship.trim(),
        balance: 0,
      }).select("id").single();
    }

    if (insertRes.error) return { error: getFriendlyErrorMessage(insertRes.error) };

    await logLedgerEntry(supabase, {
      user_id: user.id,
      action_type: "FAMILY_MEMBER_ADD",
      details: `Added family member: ${data.name.trim()} (${data.relationship.trim()})`,
      source_type: "family_member",
      source_id: insertRes.data?.id || null,
      metadata: data
    });

    revalidatePath("/dashboard/family");
    revalidatePath("/dashboard/ledger");
    return { success: true, message: "Family Member added successfully" };
  } catch (err) {
    console.error("Error in addFamilyMember:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function updateFamilyMember(id: string, data: { name: string; relationship: string; avatar_url?: string | null }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!id) return { error: "Member ID is required" };
    if (!data.name || data.name.trim().length === 0) {
      return { error: "Name is required" };
    }
    if (!data.relationship || data.relationship.trim().length === 0) {
      return { error: "Relationship is required" };
    }

    let updateRes = await supabase
      .from("family_members")
      .update({
        name: data.name.trim(),
        relationship: data.relationship.trim(),
        avatar_url: data.avatar_url?.trim() || null,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateRes.error && updateRes.error.message?.includes("avatar_url")) {
      // Fallback if avatar_url column is not yet present in Supabase table
      updateRes = await supabase
        .from("family_members")
        .update({
          name: data.name.trim(),
          relationship: data.relationship.trim(),
        })
        .eq("id", id)
        .eq("user_id", user.id);
    }

    if (updateRes.error) return { error: getFriendlyErrorMessage(updateRes.error) };

    await logLedgerEntry(supabase, {
      user_id: user.id,
      action_type: "FAMILY_MEMBER_UPDATE",
      details: `Updated family member: ${data.name.trim()} (${data.relationship.trim()})`,
      source_type: "family_member",
      source_id: id,
      metadata: data
    });

    revalidatePath("/dashboard/family");
    revalidatePath("/dashboard/ledger");
    return { success: true, message: "Family Member updated successfully" };
  } catch (err) {
    console.error("Error in updateFamilyMember:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function deleteFamilyMember(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!id) return { error: "Member ID is required" };

    const { error } = await supabase
      .from("family_members")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: getFriendlyErrorMessage(error) };

    await logLedgerEntry(supabase, {
      user_id: user.id,
      action_type: "FAMILY_MEMBER_DELETE",
      details: `Deleted family member profile`,
      source_type: "family_member",
      source_id: id
    });

    revalidatePath("/dashboard/family");
    revalidatePath("/dashboard/ledger");
    return { success: true, message: "Family Member deleted successfully" };
  } catch (err) {
    console.error("Error in deleteFamilyMember:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

/* ── Allowances (family_allowances table) ── */

export async function createAllowance(data: {
  family_member_id: string;
  amount: number;
  frequency: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const familyMemberId = data.family_member_id?.trim();
    if (!familyMemberId) return { error: "Member is required" };
    if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
      return { error: "Amount must be a positive number" };
    }
    const frequency = data.frequency?.trim();
    if (!frequency) {
      return { error: "Frequency is required" };
    }
    const { data: insertData, error } = await supabase.from("family_allowances").insert({
      user_id: user.id,
      family_member_id: familyMemberId,
      amount: data.amount,
      frequency,
    }).select("id").single();

    if (error) return { error: getFriendlyErrorMessage(error) };

    await logLedgerEntry(supabase, {
      user_id: user.id,
      action_type: "FAMILY_ALLOWANCE_ADD",
      amount: data.amount,
      details: `Configured ${frequency} allowance of ₹${data.amount.toLocaleString()}`,
      source_type: "family_allowance",
      source_id: insertData?.id || null,
      metadata: data
    });

    revalidatePath("/dashboard/family");
    revalidatePath("/dashboard/ledger");
    return { success: true, message: "Allowance created successfully" };
  } catch (err) {
    console.error("Error in createAllowance:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function updateAllowance(
  id: string,
  data: {
    amount: number;
    frequency: string;
  }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const allowanceId = id?.trim();
    if (!allowanceId) return { error: "Allowance ID is required" };
    if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
      return { error: "Amount must be a positive number" };
    }
    const frequency = data.frequency?.trim();
    if (!frequency) {
      return { error: "Frequency is required" };
    }

    const { error } = await supabase
      .from("family_allowances")
      .update({
        amount: data.amount,
        frequency,
      })
      .eq("id", allowanceId)
      .eq("user_id", user.id);

    if (error) return { error: getFriendlyErrorMessage(error) };

    await logLedgerEntry(supabase, {
      user_id: user.id,
      action_type: "FAMILY_ALLOWANCE_UPDATE",
      amount: data.amount,
      details: `Updated allowance to ${frequency} ₹${data.amount.toLocaleString()}`,
      source_type: "family_allowance",
      source_id: allowanceId,
      metadata: data
    });

    revalidatePath("/dashboard/family");
    revalidatePath("/dashboard/ledger");
    return { success: true, message: "Allowance updated successfully" };
  } catch (err) {
    console.error("Error in updateAllowance:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function deleteAllowance(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const allowanceId = id?.trim();
    if (!allowanceId) return { error: "Allowance ID is required" };

    const { error } = await supabase
      .from("family_allowances")
      .delete()
      .eq("id", allowanceId)
      .eq("user_id", user.id);

    if (error) return { error: getFriendlyErrorMessage(error) };

    await logLedgerEntry(supabase, {
      user_id: user.id,
      action_type: "FAMILY_ALLOWANCE_DELETE",
      details: `Deleted family allowance configuration`,
      source_type: "family_allowance",
      source_id: allowanceId
    });

    revalidatePath("/dashboard/family");
    revalidatePath("/dashboard/ledger");
    return { success: true, message: "Allowance deleted successfully" };
  } catch (err) {
    console.error("Error in deleteAllowance:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

/* ── Transfers (family_transfers table & RPCs) ── */

export async function processFamilyTransfer(data: {
  family_member_id: string;
  account_id: string;
  amount: number;
  type: string;
  note?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const familyMemberId = data.family_member_id?.trim();
    const accountId = data.account_id?.trim();
    const transferType = data.type?.trim() || "gift";
    const note = data.note?.trim();

    if (!familyMemberId) return { error: "Recipient is required" };
    if (!accountId) return { error: "Account is required" };
    if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
      return { error: "Amount must be a positive number" };
    }

    const { data: rpcData, error } = await supabase.rpc("process_family_transfer_v2", {
      p_user_id: user.id,
      p_family_member_id: familyMemberId,
      p_account_id: accountId,
      p_amount: data.amount,
      p_type: transferType,
      p_note: note || undefined,
    });

    if (error) return { error: getFriendlyErrorMessage(error) };
    const res = rpcData as RpcResult | null;
    if (!res?.success) return { error: res?.error || "Transfer failed" };

    revalidatePath("/dashboard/family");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/ledger");
    return { success: true, message: "Process Family Transfer successful" };
  } catch (err) {
    console.error("Error in processFamilyTransfer:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function payAllowance(data: { allowance_id: string; account_id: string }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const allowanceId = data.allowance_id?.trim();
    const accountId = data.account_id?.trim();
    if (!allowanceId) return { error: "Allowance ID is required" };
    if (!accountId) return { error: "Account is required" };

    const { data: rpcData, error } = await supabase.rpc("pay_family_allowance", {
      p_user_id: user.id,
      p_allowance_id: allowanceId,
      p_account_id: accountId,
    });

    if (error) return { error: getFriendlyErrorMessage(error) };
    const res = rpcData as RpcResult | null;
    if (!res?.success) return { error: res?.error || "Payment failed" };

    revalidatePath("/dashboard/family");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/ledger");
    return { success: true, message: "Pay Allowance successful" };
  } catch (err) {
    console.error("Error in payAllowance:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function deleteFamilyTransfer(transferId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!transferId) return { error: "Transfer ID is required" };

    const { data: transfer, error: fetchErr } = await supabase
      .from("family_transfers")
      .select("*")
      .eq("id", transferId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !transfer) return { error: "Transfer record not found" };

    const { error: delErr } = await supabase
      .from("family_transfers")
      .delete()
      .eq("id", transferId)
      .eq("user_id", user.id);

    if (delErr) return { error: getFriendlyErrorMessage(delErr) };

    const { data: member } = await supabase
      .from("family_members")
      .select("balance")
      .eq("id", transfer.family_member_id)
      .single();

    if (member) {
      const newBal = Math.max(0, Number(member.balance || 0) - Number(transfer.amount || 0));
      await supabase
        .from("family_members")
        .update({ balance: newBal })
        .eq("id", transfer.family_member_id);
    }

    await logLedgerEntry(supabase, {
      user_id: user.id,
      action_type: "FAMILY_TRANSFER_DELETE",
      amount: transfer.amount,
      details: `Removed family transfer record of ₹${Number(transfer.amount).toLocaleString()}`,
      source_type: "family_transfer",
      source_id: transferId
    });

    revalidatePath("/dashboard/family");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/ledger");
    return { success: true, message: "Transfer deleted successfully" };
  } catch (err) {
    console.error("Error in deleteFamilyTransfer:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}
