
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
  console.log("Attempting to fulfill order for PaymentIntent:", paymentIntent.id);
  try {
    console.log("Connecting to database to fulfill order...");
    const { db } = await connectToDatabase();
    console.log("Database connection successful for fulfillment.");
    
    // Test database connection
    await db.admin().ping();
    console.log("Database ping successful.");
    
    const paymentsCollection = db.collection('payments');
    
    const payment = {
      stripeId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      receiptEmail: paymentIntent.receipt_email,
      createdAt: new Date(paymentIntent.created * 1000), // Convert from Unix timestamp
      processedAt: new Date(),
    };

    console.log("Inserting payment document:", JSON.stringify(payment, null, 2));
    const result = await paymentsCollection.insertOne(payment);
    console.log(`Successfully inserted payment ${paymentIntent.id} into DB with _id: ${result.insertedId}`);

    // Verify the insertion
    const insertedDoc = await paymentsCollection.findOne({ _id: result.insertedId });
    console.log("Verified inserted document:", insertedDoc);

  } catch (error: any) {
    console.error("CRITICAL: Failed to fulfill order and save to DB.", {
      paymentIntentId: paymentIntent.id,
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    
    // Re-throw the error so it can be handled upstream if needed
    throw error;
  }
}

/**
 * Placeholder function for sending an order confirmation email.
 * @param customerEmail The email address of the customer.
 */
async function sendOrderConfirmationEmail(customerEmail: string | null) {
  if (!customerEmail) {
    console.log("No customer email provided, skipping order confirmation email.");
    return;
  };
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
  if (!customerEmail) {
    console.log("No customer email provided, skipping payment failed email.");
    return;
  };
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
     if (options.amount <= 0.50) {
        return { error: "Amount must be at least $0.50." };
      }
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(options.amount * 100), // Amount in cents
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        receipt_email: 'customer@example.com', // Example email, replace with actual customer email if available
      });

      return { clientSecret: paymentIntent.client_secret ?? undefined };
    } catch (e: any) {
      console.error("Error creating payment intent:", {
        message: e.message,
        stack: e.stack,
      });
      return { error: e.message };
    }
  }

  return { error: "Invalid options provided." };
}

export async function handleWebhook(signature: string, body: string) {
  console.log("Stripe webhook handler invoked.");
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Stripe webhook secret is not configured.");
    return { error: "Webhook secret not configured.", status: 500 };
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log("Stripe event constructed successfully:", event.id);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return { error: `Webhook Error: ${err.message}`, status: 400 };
  }
  
  console.log(`Received verified Stripe event: ${event.type}`);

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntentSucceeded = event.data.object as Stripe.PaymentIntent;
      console.log(`PaymentIntent for ${paymentIntentSucceeded.amount} was successful! ID: ${paymentIntentSucceeded.id}`);
      
      // Fulfill the order and send a confirmation email.
      await fulfillOrder(paymentIntentSucceeded);
      await sendOrderConfirmationEmail(paymentIntentSucceeded.receipt_email);
      
      break;
    case 'payment_intent.payment_failed':
      const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
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
