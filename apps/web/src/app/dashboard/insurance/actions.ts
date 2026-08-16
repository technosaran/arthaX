"use server";

import { createClient } from "@/lib/supabase-server";
import { getFriendlyErrorMessage, logLedgerEntry } from "@/lib/action-utils";

export async function addInsurancePolicy(formData: {
  provider: string;
  policy_name: string;
  policy_number?: string;
  type: string;
  coverage_amount: number;
  premium_amount: number;
  premium_frequency: string;
  next_due_date?: string | null;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { data, error } = await supabase
      .from("insurance_policies")
      .insert([{
        ...formData,
        user_id: user.id,
      }])
      .select("id")
      .single();

    if (error) return { error: getFriendlyErrorMessage(error) };

    await logLedgerEntry(supabase, {
      user_id: user.id,
      action_type: "INSURANCE_ADDED",
      amount: formData.coverage_amount,
      details: `Added ${formData.type} policy from ${formData.provider}`,
      source_type: "insurance_policies",
      source_id: data.id,
      metadata: formData
    });

    return { success: true, message: "Policy added successfully" };
  } catch (err) {
    console.error("Error adding policy:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function deleteInsurancePolicy(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
      .from("insurance_policies")
      .delete()
      .match({ id, user_id: user.id });

    if (error) return { error: getFriendlyErrorMessage(error) };

    await logLedgerEntry(supabase, {
      user_id: user.id,
      action_type: "INSURANCE_DELETED",
      amount: 0,
      details: `Deleted insurance policy`,
      source_type: "insurance_policies",
      source_id: id,
    });

    return { success: true, message: "Policy deleted successfully" };
  } catch (err) {
    return { error: getFriendlyErrorMessage(err) };
  }
}
