
"use server";

import Stripe from "stripe";

interface CreatePaymentIntentOptions {
  amount: number;
}

interface CreatePaymentIntentResponse {
  clientSecret?: string;
  error?: string;
}

export async function createPaymentIntent(
  options: CreatePaymentIntentOptions
): Promise<CreatePaymentIntentResponse> {
  const { amount } = options;
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    return { error: "Stripe API key is not configured." };
  }
  
  if (!amount || amount <= 0) {
    return { error: "Invalid amount." };
  }

  try {
    const stripe = new Stripe(apiKey, {
      apiVersion: "2024-06-20",
      typescript: true,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Amount in cents
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
