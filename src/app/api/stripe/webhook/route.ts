
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

  const { received, error, status } = await handleWebhook(signature, body);

  if (error) {
    return NextResponse.json({ error }, { status, headers: corsHeaders });
  }
  
  return NextResponse.json({ received }, { headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
