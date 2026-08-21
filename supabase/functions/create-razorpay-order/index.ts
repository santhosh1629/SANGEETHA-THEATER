
// create-razorpay-order/index.ts
// Creates a Razorpay order given amount (in rupees) and optional metadata.
// Public endpoint (no JWT).
console.info("create-razorpay-order function starting");

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { 
        status: 405, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        } 
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { 
        status: 400, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        } 
      });
    }

    const { amount, currency = "INR", receipt, notes, payment_capture = 1 } = body;

    if (amount === undefined || amount === null) {
      return new Response(JSON.stringify({ error: "Missing 'amount' in rupees" }), { 
        status: 400, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        } 
      });
    }

    // Allow amount as string or number. Convert to number safely.
    const amountNum = typeof amount === "string" ? parseFloat(amount) : Number(amount);
    if (!isFinite(amountNum) || amountNum <= 0) {
      return new Response(JSON.stringify({ error: "Invalid 'amount' value" }), { 
        status: 400, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        } 
      });
    }

    // Razorpay expects amount in smallest currency unit (paise)
    const amountInPaise = Math.round(amountNum * 100);

    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") || "rzp_test_TSLWjwn5NmoFT7";
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") || "j7Ajj80G5JuHWujxTkttiTv5";

    const payload = {
      amount: amountInPaise,
      currency,
      receipt: receipt ?? `rcpt_${Date.now()}`,
      payment_capture,
      notes: notes ?? {},
    };

    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Razorpay order creation failed", data);
      return new Response(JSON.stringify({ error: "Failed to create order", details: data }), { 
        status: 502, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        } 
      });
    }

    // Return the Razorpay order object to the client
    return new Response(JSON.stringify({ order: data }), { 
      status: 200, 
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      } 
    });
  } catch (err) {
    console.error("Unexpected error in create-razorpay-order:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { 
      status: 500, 
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      } 
    });
  }
});
