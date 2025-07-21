
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/actions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, stripe-signature",
};

export async function GET() {
  return NextResponse.json({ message: "Stripe webhook endpoint is active." }, { status: 200, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400, headers: corsHeaders });
  }

  // Acknowledge the webhook event immediately to prevent timeouts
  (async () => {
    try {
      const { error, status } = await handleWebhook(signature, body);
      if (error) {
        console.error(`Webhook processing error: ${error}`, { status });
      }
    } catch (e: any) {
        console.error(`Unhandled error in webhook processing: ${e.message}`);
    }
  })();
  
  // Return a 200 OK response to Stripe
  return NextResponse.json({ received: true }, { status: 200, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
