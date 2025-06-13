// Edge function to send payment reminders to parents
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("send-payment-reminder function initializing");

// Ensure environment variables are available
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Supabase URL or Service Role Key is not set.");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req: Request) => {
  console.log("send-payment-reminder function invoked");

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const { playerId, parentId, month, monthName, year, playerName, senderId, senderType } = await req.json();
    
    console.log("Received payment reminder request:", { 
      playerId, parentId, month, monthName, year, playerName, senderId, senderType 
    });
    
    // Validate required fields
    if (!playerId || !parentId || !month || !monthName || !year || !playerName || !senderId || !senderType) {
      console.error("Missing required fields in request");
      return new Response(JSON.stringify({ 
        error: "Missing required fields" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get parent information
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .select('id, name, email, phone_number')
      .eq('id', parentId)
      .single();
    
    if (parentError || !parentData) {
      console.error("Error fetching parent information:", parentError);
      return new Response(JSON.stringify({ 
        error: "Could not find parent information" 
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get sender information
    const { data: senderData, error: senderError } = await supabase
      .from(senderType === 'admin' ? 'admins' : 'coaches')
      .select('id, name')
      .eq('id', senderId)
      .single();
    
    if (senderError || !senderData) {
      console.error("Error fetching sender information:", senderError);
      // Continue anyway as this is not critical
    }
    
    // Create notification record
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: parentId,
        recipient_type: 'parent',
        sender_id: senderId,
        sender_type: senderType,
        type: 'payment_reminder',
        title: 'Payment Reminder',
        message: `Payment for ${monthName} ${year} is due for ${playerName}.`,
        status: 'sent',
        metadata: {
          player_id: playerId,
          player_name: playerName,
          month: month,
          month_name: monthName,
          year: year,
          sender_name: senderData?.name || 'Club Staff'
        }
      })
      .select()
      .single();
    
    if (notificationError) {
      console.error("Error creating notification:", notificationError);
      return new Response(JSON.stringify({ 
        error: "Failed to create notification" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Create payment reminder log
    const { error: logError } = await supabase
      .from('payment_reminder_logs')
      .insert({
        player_id: playerId,
        parent_id: parentId,
        sender_id: senderId,
        sender_type: senderType,
        month: month,
        year: year,
        sent_at: new Date().toISOString()
      });
    
    if (logError) {
      console.error("Error logging payment reminder:", logError);
      // Continue anyway as this is not critical
    }
    
    console.log("Payment reminder sent successfully to parent:", parentData.name);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `Payment reminder sent to ${parentData.name}`,
      notification_id: notification.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error) {
    console.error("Error in send-payment-reminder function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

console.log("send-payment-reminder function initialized and server started."); 