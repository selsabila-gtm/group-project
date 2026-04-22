import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://adlsnvrrgqwahnlgiayo.supabase.co";
const supabaseKey = "sb_publishable_GUj2ppVSXeXnO7aeCiNojg_BYoStmsK";

export const supabase = createClient(supabaseUrl, supabaseKey);