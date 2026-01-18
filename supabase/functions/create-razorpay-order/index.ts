
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, studentId } = await req.json()

    // YOUR LIVE KEYS
    const KEY_ID = 'rzp_live_S0V6Bz1xXIWsbn'
    const KEY_SECRET = 'aleVqiBaaVo8ZatFBmWQS1vV'

    if (!amount || amount <= 0) {
      throw new Error("Amount must be greater than zero.");
    }

    console.log(`[Razorpay] Creating Order. Amount: ${amount}, Student: ${studentId}`);

    // Call Razorpay Orders API
    const auth = btoa(`${KEY_ID}:${KEY_SECRET}`)
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: Math.round(Number(amount) * 100), // paise
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        payment_capture: 1, // CRITICAL: This enables Auto-Capture
        notes: {
          student_id: studentId,
          source: "Sangeetha Theater Web"
        }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Razorpay Error:", data);
      return new Response(
        JSON.stringify({ error: data.error?.description || "Razorpay API error" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Edge Function Error:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
