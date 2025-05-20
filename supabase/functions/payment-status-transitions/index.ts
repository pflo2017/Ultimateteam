// Edge function to handle payment status transitions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("payment-status-transitions function initializing");

// Constants for payment status transitions
const GRACE_PERIOD_DAYS = 7; // Days after due date before moving to 'Overdue'
const OVERDUE_PERIOD_DAYS = 14; // Days after due date before moving to 'Suspended' (grace + this value)

// Ensure environment variables are available
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
// const edgeFunctionApiKey = Deno.env.get("EDGE_FUNCTION_API_KEY");

// if (!edgeFunctionApiKey) {
//   console.error("EDGE_FUNCTION_API_KEY is not set.");
//   // Optionally, throw an error or handle as appropriate for your security model
// }

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Supabase URL or Service Role Key is not set.");
  Deno.exit(1); // Exit if essential Supabase config is missing
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req: Request) => {
  console.log("payment-status-transitions function invoked");

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Temporarily comment out API key check for debugging
    // const authHeader = req.headers.get("Authorization");
    // console.log("Authorization header:", authHeader);

    // if (!authHeader) {
    //   console.error("Missing Authorization header.");
    //   return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
    //     status: 401,
    //     headers: { ...corsHeaders, "Content-Type": "application/json" },
    //   });
    // }

    // const apiKey = authHeader.replace("Bearer ", "");
    // if (apiKey !== edgeFunctionApiKey) {
    //   console.error("Invalid API key.");
    //   return new Response(JSON.stringify({ error: "Invalid API key" }), {
    //     status: 403, // Forbidden
    //     headers: { ...corsHeaders, "Content-Type": "application/json" },
    //   });
    // }

    console.log("Authorization check passed (or bypassed). Proceeding with logic.");

    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, status, current_payment_due_date, parent_id, team_id');

    if (playersError) {
      console.error("Error fetching players:", playersError);
      throw playersError;
    }

    console.log(`Fetched ${players.length} players for status check.`);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to start of day for comparison

    for (const player of players) {
      console.log(`Processing player ID: ${player.id}, Status: ${player.status}, Due Date: ${player.current_payment_due_date}`);
      if (!player.current_payment_due_date) {
        console.log(`Player ID: ${player.id} has no payment due date. Skipping.`);
        continue; // Skip if no due date
      }

      const dueDate = new Date(player.current_payment_due_date);
      dueDate.setHours(0, 0, 0, 0); // Normalize due date

      const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`Player ID: ${player.id}, Days difference from due date: ${daysDiff}`);

      let newStatus = player.status;

      if (player.status === 'Active' && daysDiff > GRACE_PERIOD_DAYS && daysDiff <= OVERDUE_PERIOD_DAYS) {
        newStatus = 'Overdue';
        console.log(`Player ID: ${player.id} transitioning from Active to Overdue. DaysDiff: ${daysDiff}, Grace: ${GRACE_PERIOD_DAYS}`);
      } else if ((player.status === 'Active' || player.status === 'Overdue') && daysDiff > OVERDUE_PERIOD_DAYS) {
        newStatus = 'Suspended';
        console.log(`Player ID: ${player.id} transitioning to Suspended. DaysDiff: ${daysDiff}, Overdue: ${OVERDUE_PERIOD_DAYS}`);
      }
      // Add logic for other transitions if needed, e.g., from 'Suspended' back to 'Active' upon payment.

      if (newStatus !== player.status) {
        const { error: updateError } = await supabase
          .from('players')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', player.id);

        if (updateError) {
          console.error(`Error updating player ${player.id} status to ${newStatus}:`, updateError);
        } else {
          console.log(`Player ${player.id} status updated to ${newStatus}.`);
          // Log the status change
          const { error: logError } = await supabase.from('payment_status_logs').insert({
            player_id: player.id,
            old_status: player.status,
            new_status: newStatus,
            change_reason: `Automatic transition based on due date. Days overdue: ${daysDiff}.`,
            changed_by: 'Edge Function' // System change
          });
          if (logError) {
            console.error(`Error logging status change for player ${player.id}:`, logError);
          } else {
            console.log(`Status change logged for player ${player.id}.`);
          }
        }
      }
    }

    console.log("Payment status transitions completed successfully.");
    return new Response(JSON.stringify({ message: "Payment status transitions completed successfully." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in payment-status-transitions function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

console.log("payment-status-transitions function initialized and server started."); 