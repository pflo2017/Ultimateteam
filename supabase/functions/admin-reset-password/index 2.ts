import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const { userId, newPassword } = await req.json();

    // Validate input
    if (!userId) {
      throw new Error("User ID is required");
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters");
    }

    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the current user
    const {
      data: { user: adminUser },
    } = await supabaseClient.auth.getUser();

    if (!adminUser) {
      throw new Error("Not authenticated");
    }

    // Check if the user is a master admin
    const { data: masterAdmin, error: masterAdminError } = await supabaseClient
      .from("master_admins")
      .select("*")
      .eq("user_id", adminUser.id)
      .single();

    if (masterAdminError || !masterAdmin) {
      throw new Error("Not authorized - only master admins can reset passwords");
    }

    // Get the target user to verify they exist
    const { data: targetUserData, error: targetUserError } = await supabaseClient
      .from("auth_user_details")
      .select("email")
      .eq("id", userId)
      .single();

    if (targetUserError || !targetUserData) {
      throw new Error(`Target user not found: ${targetUserError?.message || "Unknown error"}`);
    }

    // For security reasons, we can't directly reset passwords in this Edge Function
    // Instead, we'll log the attempt and recommend using the Supabase Admin API
    // In a real production scenario, this would call the Admin API with proper credentials

    // Log the action
    const { data: logData, error: logError } = await supabaseClient
      .from("admin_logs")
      .insert({
        admin_id: adminUser.id,
        action_type: "password_reset_attempt",
        target_user_id: userId,
        target_table: "auth.users",
        details: {
          email: targetUserData.email,
          method: "edge_function",
          success: false,
          reason: "Edge function cannot directly reset passwords, needs Admin API"
        },
        ip_address: req.headers.get("x-forwarded-for") || "unknown"
      });

    if (logError) {
      console.error("Error logging action:", logError);
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: false,
        message: "Password reset via Edge Function is not supported. Please use the Supabase Dashboard or Admin API.",
        user: {
          id: userId,
          email: targetUserData.email
        }
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}); 