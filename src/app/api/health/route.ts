
import { NextResponse } from "next/server";

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
      health: "/api/health"
    }
  });
}
