import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("UPI Collection webhook received:", JSON.stringify(payload, null, 2));

    // Extract key fields from webhook
    const clientReferenceId = payload.client_reference_id;
    const transactionStatus = payload.transaction_status;
    const utr = payload.utr || payload.rrn;
    const amount = payload.transaction_amount || payload.amount;
    const payerVpa = payload.payer_vpa;
    const payerName = payload.payer_name;
    const npciTransactionId = payload.npci_transaction_id;
    const transactionTimestamp = payload.transaction_timestamp;

    if (!clientReferenceId) {
      console.error("Missing client_reference_id in webhook");
      return new Response(
        JSON.stringify({ success: false, error: "Missing client_reference_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the transaction
    const { data: transaction, error: fetchError } = await supabase
      .from("nupay_upi_transactions")
      .select("*")
      .eq("client_reference_id", clientReferenceId)
      .single();

    if (fetchError || !transaction) {
      console.error("Transaction not found for webhook:", clientReferenceId);
      return new Response(
        JSON.stringify({ success: false, error: "Transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent duplicate processing
    if (transaction.status === transactionStatus && transaction.webhook_payload) {
      console.log("Webhook already processed for:", clientReferenceId);
      return new Response(
        JSON.stringify({ success: true, message: "Already processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update transaction record
    const updateData: Record<string, any> = {
      status: transactionStatus,
      status_description: payload.status_description || payload.message,
      webhook_payload: payload,
      updated_at: new Date().toISOString(),
    };

    if (transactionStatus === "SUCCESS") {
      updateData.utr = utr;
      updateData.npci_transaction_id = npciTransactionId;
      updateData.payer_vpa = payerVpa;
      updateData.payer_name = payerName || transaction.payer_name;
      updateData.transaction_amount = amount;
      updateData.transaction_timestamp = transactionTimestamp;
    }

    const { error: updateError } = await supabase
      .from("nupay_upi_transactions")
      .update(updateData)
      .eq("id", transaction.id);

    if (updateError) {
      console.error("Failed to update transaction:", updateError);
    }

    // Auto-reconciliation for successful payments
    if (transactionStatus === "SUCCESS" && transaction.schedule_id) {
      console.log("Processing auto-reconciliation for schedule:", transaction.schedule_id);

      // Get schedule details with interest_rate and disbursement_date for due-today calc
      const { data: schedule, error: scheduleError } = await supabase
        .from("loan_repayment_schedule")
        .select("*, loan_applications(id, contact_id, interest_rate, loan_disbursements(disbursement_date))")
        .eq("id", transaction.schedule_id)
        .single();

      if (scheduleError || !schedule) {
        console.error("Schedule not found:", scheduleError);
      } else {
        const paymentAmount = parseFloat(amount) || transaction.request_amount;
        const paymentNumber = `UPI${Date.now()}`;

        // Insert payment record
        const { error: paymentError } = await supabase
          .from("loan_payments")
          .insert({
            loan_application_id: transaction.loan_application_id,
            schedule_id: transaction.schedule_id,
            org_id: transaction.org_id,
            payment_number: paymentNumber,
            payment_date: new Date().toISOString().split("T")[0],
            payment_amount: paymentAmount,
            principal_paid: schedule.principal || 0,
            interest_paid: schedule.interest || 0,
            late_fee_paid: 0,
            payment_method: "upi_collection",
            transaction_reference: utr || npciTransactionId,
            notes: `Auto-reconciled from UPI Collection. Payer VPA: ${payerVpa || "N/A"}`,
          });

        if (paymentError) {
          console.error("Failed to create payment record:", paymentError);
        } else {
          console.log("Payment record created:", paymentNumber);

          // Update schedule status - compare against due-today (not just total_emi)
          const newAmountPaid = (schedule.amount_paid || 0) + paymentAmount;
          const interestRate = schedule.loan_applications?.interest_rate || 0;
          const disbData = schedule.loan_applications?.loan_disbursements;
          const disbDate = Array.isArray(disbData) ? disbData[0]?.disbursement_date : disbData?.disbursement_date;
          let dueToday = schedule.total_emi;
          if (interestRate && disbDate) {
            const actualDays = Math.max(1, Math.round((Date.now() - new Date(disbDate).getTime()) / (1000 * 60 * 60 * 24)));
            dueToday = schedule.principal_amount + Math.round(schedule.principal_amount * (interestRate / 100) * actualDays);
          }
          const newStatus = (newAmountPaid >= dueToday || newAmountPaid >= schedule.total_emi)
            ? "paid"
            : newAmountPaid > 0
              ? "partially_paid"
              : "pending";

          const scheduleUpdate: Record<string, any> = {
            amount_paid: newAmountPaid,
            status: newStatus,
          };

          if (newStatus === "paid") {
            scheduleUpdate.payment_date = new Date().toISOString().split("T")[0];
          }

          const { error: scheduleUpdateError } = await supabase
            .from("loan_repayment_schedule")
            .update(scheduleUpdate)
            .eq("id", transaction.schedule_id);

          if (scheduleUpdateError) {
            console.error("Failed to update schedule:", scheduleUpdateError);
          } else {
            console.log("Schedule updated to:", newStatus);
          }
        }
      }
    }

    // Log webhook for audit
    console.log(`Webhook processed: ${clientReferenceId} -> ${transactionStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
        transaction_id: transaction.id,
        status: transactionStatus,
        reconciled: transactionStatus === "SUCCESS" && !!transaction.schedule_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
