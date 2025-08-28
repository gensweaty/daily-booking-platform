import { supabase } from "@/integrations/supabase/client";

export async function ensureSubUser(boardOwnerId: string, email: string, fullName?: string) {
  const normalized = email.trim().toLowerCase();
  let display = fullName?.trim() || normalized.split('@')[0];

  // First check if sub-user already exists by email
  const { data: existingUser, error: selectError } = await supabase
    .from('sub_users')
    .select('id, fullname, email, avatar_url')
    .eq('board_owner_id', boardOwnerId)
    .eq('email', normalized)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  // If user exists, return it
  if (existingUser) {
    return existingUser;
  }

  // Check if fullname is already taken by another user
  const { data: nameConflict } = await supabase
    .from('sub_users')
    .select('id')
    .eq('board_owner_id', boardOwnerId)
    .eq('fullname', display)
    .maybeSingle();

  // If fullname is taken, make it unique by appending email local part
  if (nameConflict) {
    const emailLocal = normalized.split('@')[0];
    display = `${display} (${emailLocal})`;
  }

  // Create new sub-user
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