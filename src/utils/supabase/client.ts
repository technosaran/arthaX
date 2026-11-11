import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function getClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}

let clientInstance: ReturnType<typeof getClient> | undefined;

export const createClient = () => {
  if (typeof window === "undefined") {
    return getClient();
  }
  if (!clientInstance) {
    clientInstance = getClient();
  }
  return clientInstance;
};
