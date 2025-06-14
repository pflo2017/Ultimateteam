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
    let requestData;
    try {
      requestData = await req.json();
      console.log("Request data:", JSON.stringify(requestData));
    } catch (e) {
      console.error("Error parsing request body:", e);
      return new Response(JSON.stringify({ 
        error: "Invalid request body",
        details: e.message
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const { playerId, parentId, month, monthName, year, playerName, senderId, senderType } = requestData;
    
    // Validate required fields
    const missingFields = [];
    if (!playerId) missingFields.push('playerId');
    if (!parentId) missingFields.push('parentId');
    if (!month) missingFields.push('month');
    if (!monthName) missingFields.push('monthName');
    if (!year) missingFields.push('year');
    if (!playerName) missingFields.push('playerName');
    if (!senderId) missingFields.push('senderId');
    if (!senderType) missingFields.push('senderType');
    
    if (missingFields.length > 0) {
      console.error("Missing required fields:", missingFields);
      return new Response(JSON.stringify({ 
        error: "Missing required fields",
        missingFields
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Check if notifications table exists
    try {
      const { count, error: tableCheckError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true });
      
      if (tableCheckError) {
        console.error("Error checking notifications table:", tableCheckError);
        return new Response(JSON.stringify({ 
          error: "Database setup issue",
          details: "The notifications table may not exist. Please run the migration to create it.",
          originalError: tableCheckError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log("Notifications table exists, count:", count);
    } catch (e) {
      console.error("Error checking database tables:", e);
      return new Response(JSON.stringify({ 
        error: "Database setup issue",
        details: "Could not verify database tables. Please run the migration to create required tables.",
        originalError: e.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get parent information
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .select('id, name, email, phone_number')
      .eq('id', parentId)
      .single();
    
    if (parentError) {
      console.error("Error fetching parent information:", parentError);
      return new Response(JSON.stringify({ 
        error: "Could not find parent information",
        details: parentError.message
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (!parentData) {
      console.error("No parent found with ID:", parentId);
      return new Response(JSON.stringify({ 
        error: "Parent not found",
        details: `No parent found with ID: ${parentId}`
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get sender information
    let senderName = 'Club Staff';
    try {
      const { data: senderData, error: senderError } = await supabase
        .from(senderType === 'admin' ? 'admins' : 'coaches')
        .select('id, name')
        .eq('id', senderId)
        .single();
      
      if (!senderError && senderData) {
        senderName = senderData.name || senderName;
      } else {
        console.warn("Could not fetch sender information:", senderError);
      }
    } catch (e) {
      console.warn("Error fetching sender information:", e);
      // Continue anyway as this is not critical
    }
    
    // Create notification record
    let notification;
    try {
      const { data, error: notificationError } = await supabase
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
            sender_name: senderName
          }
        })
        .select()
        .single();
      
      if (notificationError) {
        console.error("Error creating notification:", notificationError);
        return new Response(JSON.stringify({ 
          error: "Failed to create notification",
          details: notificationError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      notification = data;
    } catch (e) {
      console.error("Exception creating notification:", e);
      return new Response(JSON.stringify({ 
        error: "Exception creating notification",
        details: e.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Create payment reminder log
    try {
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
    } catch (e) {
      console.warn("Exception logging payment reminder:", e);
      // Continue anyway as this is not critical
    }
    
    console.log("Payment reminder sent successfully to parent:", parentData.name);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `Payment reminder sent to ${parentData.name}`,
      notification_id: notification?.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error) {
    console.error("Unhandled error in send-payment-reminder function:", error);
    return new Response(JSON.stringify({ 
      error: "Unhandled server error",
      details: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

console.log("send-payment-reminder function initialized and server started."); 