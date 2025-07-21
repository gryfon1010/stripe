
"use server";

import Stripe from "stripe";

interface PaymentIntentOptions {
  amount?: number;
  paymentIntentId?: string;
  code?: string;
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
 * Maps a code to a price. You can customize this logic as needed.
 * @param code The code to map to a price
 * @returns The price in dollars
 */
function getCodePrice(code: string): number {
  const priceMap: { [key: string]: number } = {
    'basic': 5.00,
    'premium': 15.00,
    'pro': 25.00,
    'enterprise': 50.00
  };
  
  return priceMap[code.toLowerCase()] || 10.00; // Default to $10.00 if code not found
}

/**
 * Fulfills the order after successful payment.
 * @param paymentIntent The successful PaymentIntent object from Stripe.
 */
async function fulfillOrder(paymentIntent: Stripe.PaymentIntent) {
  console.log("Attempting to fulfill order for PaymentIntent:", paymentIntent.id);
  console.log(`Payment of ${paymentIntent.amount} succeeded! ID: ${paymentIntent.id}`);
  // Add any other fulfillment logic here (email notifications, inventory updates, etc.)
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
  
  if (options.amount || options.code) {
    // Determine the amount to charge
    let finalAmount = options.amount;
    
    if (options.code && !options.amount) {
      // If only code is provided, use the mapped price
      finalAmount = getCodePrice(options.code);
    } else if (options.code && options.amount) {
      // If both are provided, you can choose to use code price or validate against it
      const codePrice = getCodePrice(options.code);
      console.log(`Code ${options.code} maps to $${codePrice}, but amount $${options.amount} was also provided`);
      // For now, we'll use the provided amount, but you can change this logic
      finalAmount = options.amount;
    }
    
    if (!finalAmount || finalAmount <= 0.50) {
      return { error: "Amount must be at least $0.50." };
    }
    
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(finalAmount * 100), // Amount in cents
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        receipt_email: 'customer@example.com', // Example email, replace with actual customer email if available
        metadata: {
          code: options.code || 'no-code',
          original_amount: finalAmount.toString()
        }
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
