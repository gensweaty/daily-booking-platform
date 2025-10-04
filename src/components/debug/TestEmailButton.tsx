
import React from 'react';
import { Button } from '@/components/ui/button';

export const TestEmailButton = () => {
  const testFunction = async () => {
    console.log("🧪 Testing Edge Function connection...");
    
    try {
      const response = await fetch("https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/test-debug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          test: "debug",
          timestamp: new Date().toISOString()
        })
      });
      
      const result = await response.json();
      console.log("✅ Test function response:", result);
      alert("Test function called! Check Supabase logs and browser console.");
    } catch (error) {
      console.error("❌ Test function failed:", error);
      alert("Test function failed! Check browser console.");
    }
  };

  return (
    <Button onClick={testFunction} variant="outline">
      🧪 Test Edge Function
    </Button>
  );
};
