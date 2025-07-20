
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/actions";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const { received, error, status } = await handleWebhook(signature, body);

  if (error) {
    return NextResponse.json({ error }, { status });
  }
  
  return NextResponse.json({ received });
}
