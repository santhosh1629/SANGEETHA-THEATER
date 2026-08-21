
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

async function hmacSHA256(secret: string, message: string) {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  try {
    // ✅ CORS
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    // ✅ Read body
    const body = await req.json();
    const razorpay_order_id = body.razorpay_order_id;
    const razorpay_payment_id = body.razorpay_payment_id;
    const razorpay_signature = body.razorpay_signature;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // ✅ Get secret from env
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "j7Ajj80G5JuHWujxTkttiTv5";

    // ✅ Verify signature
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSig = await hmacSHA256(keySecret, payload);

    const isValid = expectedSig === razorpay_signature;

    return new Response(
      JSON.stringify({
        success: isValid,
        message: isValid ? "Payment verified ✅" : "Invalid signature ❌",
      }),
      {
        status: isValid ? 200 : 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
