
import { NextResponse } from "next/server";
import { getConfirmedTransactions } from "@/lib/actions";

export async function GET() {
  const timestamp = new Date().toISOString();
  
  // Check environment variables
  const envCheck = {
    stripe_secret: !!process.env.STRIPE_SECRET_KEY,
    stripe_webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
    sendgrid_api_key: !!process.env.SENDGRID_API_KEY,
    sendgrid_from_email: !!process.env.SENDGRID_FROM_EMAIL,
  };

  return NextResponse.json({
    status: "healthy",
    timestamp,
    environment: envCheck,
    endpoints: {
      webhook: "/api/stripe/webhook",
      health: "/api/health",
      transactions: "/api/transactions"
    },
    services: {
      stripe: envCheck.stripe_secret && envCheck.stripe_webhook_secret,
      sendgrid: envCheck.sendgrid_api_key && envCheck.sendgrid_from_email,
      webhook_ready: !!envCheck.stripe_webhook_secret
    }
  });
}
