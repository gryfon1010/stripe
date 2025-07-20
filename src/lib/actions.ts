
"use server";

import Stripe from "stripe";

interface PaymentIntentOptions {
  amount?: number;
  paymentIntentId?: string;
}

interface PaymentIntentResponse {
  clientSecret?: string;
  paymentIntent?: Stripe.PaymentIntent;
  error?: string;
}

export async function handlePaymentIntent(
  options: PaymentIntentOptions
): Promise<PaymentIntentResponse> {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    return { error: "Stripe API key is not configured." };
  }
  
  const stripe = new Stripe(apiKey, {
    apiVersion: "2024-06-20",
    typescript: true,
  });

  if (options.paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(options.paymentIntentId);
      return { paymentIntent };
    } catch (e: any) {
      return { error: e.message };
    }
  }
  
  if (options.amount) {
     if (options.amount <= 0) {
        return { error: "Invalid amount." };
      }
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(options.amount * 100), // Amount in cents
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return { clientSecret: paymentIntent.client_secret ?? undefined };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  return { error: "Invalid options provided." };
}
