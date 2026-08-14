/**
 * User Profile Repository Implementation.
 * Implements requirement ADR 001: Repository pattern for user profile and settings data.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";
import { DatabaseError } from "@/lib/errors";
import { SupabaseRepository } from "./base-repository";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export class ProfileRepository extends SupabaseRepository<Profile> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, "profiles");
  }

  /**
   * Finds user profile by user ID.
   */
  public async findByUserId(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await this.supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw new DatabaseError(error.message);
      return data as Profile | null;
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }

  /**
   * Updates currency preference for a user.
   */
  public async updateBaseCurrency(userId: string, baseCurrency: "INR" | "USD"): Promise<Profile | null> {
    return this.update(userId, { base_currency: baseCurrency } as Partial<Profile>);
  }
}
