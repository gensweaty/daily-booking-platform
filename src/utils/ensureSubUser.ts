import { supabase } from "@/integrations/supabase/client";

export async function ensureSubUser(boardOwnerId: string, email: string, fullName?: string) {
  const normalized = email.trim().toLowerCase();
  const display = fullName?.trim() || normalized.split('@')[0];

  // First check if sub-user already exists
  const { data: existingUser, error: selectError } = await supabase
    .from('sub_users')
    .select('id, fullname, email, avatar_url')
    .eq('board_owner_id', boardOwnerId)
    .ilike('email', normalized)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    throw selectError;
  }

  // If user exists, return it
  if (existingUser) {
    return existingUser;
  }

  // If user doesn't exist, create new one
  const { data: newUser, error: insertError } = await supabase
    .from('sub_users')
    .insert({
      board_owner_id: boardOwnerId,
      email: normalized,
      fullname: display
    })
    .select('id, fullname, email, avatar_url')
    .single();

  if (insertError) throw insertError;
  return newUser;
}