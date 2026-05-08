// Re-exports the browser Supabase client.
// All existing imports of "@/lib/supabase" continue to work unchanged.
// Server actions and middleware import from "@/lib/supabase/server" or
// "@/lib/supabase/middleware" directly.
export { createClient as createBrowserClient } from "./supabase/browser";

import { createClient } from "./supabase/browser";
export const supabase = createClient();
