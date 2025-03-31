
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export const useSignOut = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      console.error("Error signing out:", error.message);
    } finally {
      setLoading(false);
    }
  };

  return { signOut, loading };
};
