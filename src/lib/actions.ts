
"use server";

import Stripe from "stripe";
import { connectToDatabase } from "./db";

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

/**
 * Stores the successful payment information in the database.
 * @param paymentIntent The successful PaymentIntent object from Stripe.
 */
async function fulfillOrder(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { db } = await connectToDatabase();
    const paymentsCollection = db.collection('payments');
    
    const payment = {
      stripeId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      receiptEmail: paymentIntent.receipt_email,
      createdAt: new Date(paymentIntent.created * 1000), // Convert from Unix timestamp
    };
    
    await paymentsCollection.insertOne(payment);
    console.log(`Successfully inserted payment ${paymentIntent.id} into DB.`);

  } catch (error) {
    console.error("Failed to fulfill order and save to DB:", error);
    // You might want to add more robust error handling here,
    // like sending a notification to your team.
  }
}

/**
 * Placeholder function for sending an order confirmation email.
 * @param customerEmail The email address of the customer.
 */
async function sendOrderConfirmationEmail(customerEmail: string | null) {
  if (!customerEmail) return;
  // TODO: Implement your email sending logic here.
  // Use a service like SendGrid, Resend, or Nodemailer.
  console.log(`Sending order confirmation to: ${customerEmail}`);
  // Example: await emailService.send({ to: customerEmail, subject: 'Your order is confirmed!', ... });
  return Promise.resolve();
}

/**
 * Placeholder function for sending a payment failed email.
 * @param customerEmail The email address of the customer.
 */
async function sendPaymentFailedEmail(customerEmail: string | null) {
  if (!customerEmail) return;
  // TODO: Implement your email sending logic for failed payments.
  console.log(`Sending payment failed notification to: ${customerEmail}`);
  // Example: await emailService.send({ to: customerEmail, subject: 'Your payment failed', ... });
  return Promise.resolve();
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
        receipt_email: 'customer@example.com', // Example email, replace with actual customer email if available
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
      
      // Fulfill the order and send a confirmation email.
      await fulfillOrder(paymentIntentSucceeded);
      await sendOrderConfirmationEmail(paymentIntentSucceeded.receipt_email);
      
      break;
    case 'payment_intent.payment_failed':
      const paymentIntentFailed = event.data.object;
      console.log(`Payment failed for PaymentIntent: ${paymentIntentFailed.id}`);
      
      // Notify the user that their payment failed.
      await sendPaymentFailedEmail(paymentIntentFailed.receipt_email);
      
      break;
    // ... handle other event types you care about
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return { received: true, status: 200 };
}
