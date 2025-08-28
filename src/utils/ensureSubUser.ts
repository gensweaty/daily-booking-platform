import { supabase } from "@/integrations/supabase/client";

export async function ensureSubUser(boardOwnerId: string, email: string, fullName?: string) {
  const normalized = email.trim().toLowerCase();
  const display = fullName?.trim() || normalized.split('@')[0];

  const { data, error } = await supabase
    .from('sub_users')
    .upsert(
      { board_owner_id: boardOwnerId, email: normalized, fullname: display },
      { onConflict: 'board_owner_id,email' }
    )
    .select('id, fullname, email, avatar_url')
    .single();

  if (error) throw error;
  return data;
}