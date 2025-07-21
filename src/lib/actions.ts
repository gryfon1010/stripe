
"use server";

import Stripe from "stripe";

interface PaymentIntentOptions {
  amount?: number;
  paymentIntentId?: string;
}

export interface SimplePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  cardBrand: string | null;
  cardLast4: string | null;
}

interface PaymentIntentResponse {
  clientSecret?: string;
  paymentIntent?: SimplePaymentIntent;
  error?: string;
}

const getStripe = () => {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("Stripe API key is not configured.");
  }
  return new Stripe(apiKey, {
    apiVersion: "2024-06-20",
    typescript: true,
  });
}

export async function handlePaymentIntent(
  options: PaymentIntentOptions
): Promise<PaymentIntentResponse> {
  const stripe = getStripe();

  if (options.paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(options.paymentIntentId, {
        expand: ['payment_method']
      });
      
      const cardDetails = paymentIntent.payment_method && typeof paymentIntent.payment_method !== 'string' 
        ? paymentIntent.payment_method.card
        : null;

      const simplifiedIntent: SimplePaymentIntent = {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        cardBrand: cardDetails?.brand || null,
        cardLast4: cardDetails?.last4 || null,
      };
      
      return { paymentIntent: simplifiedIntent };
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

export async function handleWebhook(signature: string, body: string) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Stripe webhook secret is not configured.");
    return { error: "Webhook secret not configured.", status: 500 };
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return { error: `Webhook Error: ${err.message}`, status: 400 };
  }
  
  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntentSucceeded = event.data.object;
      console.log(`PaymentIntent for ${paymentIntentSucceeded.amount} was successful!`);
      // =========================================================================================
      // TODO: Add your business logic here.
      // This is where you would fulfill the order, update your database, or send an email.
      // For example:
      // await fulfillOrder(paymentIntentSucceeded.id);
      // await sendOrderConfirmationEmail(paymentIntentSucceeded.receipt_email);
      // =========================================================================================
      break;
    case 'payment_intent.payment_failed':
      const paymentIntentFailed = event.data.object;
      console.log(`Payment failed for PaymentIntent: ${paymentIntentFailed.id}`);
       // =========================================================================================
      // TODO: Add your business logic here.
      // This is where you might notify the user that their payment failed.
      // For example:
      // await sendPaymentFailedEmail(paymentIntentFailed.receipt_email);
      // =========================================================================================
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return { received: true, status: 200 };
}
