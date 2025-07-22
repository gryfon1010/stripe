"use server";

import Stripe from "stripe";
import sgMail from '@sendgrid/mail';

interface PaymentIntentOptions {
  amount?: number;
  paymentIntentId?: string;
  code?: string;
  email?: string;
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

// Transaction storage
let confirmedTransactions: Array<{
  id: string;
  amount: number;
  currency: string;
  customerEmail: string;
  timestamp: string;
  metadata: any;
}> = [];

// Load transactions from file on startup
try {
  const fs = require('fs');
  const path = require('path');
  const transactionsFile = path.join(process.cwd(), 'transactions.json');
  
  if (fs.existsSync(transactionsFile)) {
    const data = fs.readFileSync(transactionsFile, 'utf8');
    confirmedTransactions = JSON.parse(data);
    console.log(`📁 Loaded ${confirmedTransactions.length} transactions from file`);
  }
} catch (error) {
  console.log('📁 No existing transactions file found, starting fresh');
}

// Save transactions to file
function saveTransactionsToFile() {
  try {
    const fs = require('fs');
    const path = require('path');
    const transactionsFile = path.join(process.cwd(), 'transactions.json');
    
    fs.writeFileSync(transactionsFile, JSON.stringify(confirmedTransactions, null, 2));
    console.log(`💾 Saved ${confirmedTransactions.length} transactions to file`);
  } catch (error) {
    console.error('❌ Error saving transactions to file:', error);
  }
}

// Initialize SendGrid
const sendGridApiKey = process.env.SENDGRID_API_KEY;
if (sendGridApiKey) {
  sgMail.setApiKey(sendGridApiKey);
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
 * Get stored confirmed transactions
 */
export async function getConfirmedTransactions() {
  return confirmedTransactions;
}

/**
 * Fulfills the order after successful payment.
 * @param paymentIntent The successful PaymentIntent object from Stripe.
 */
async function fulfillOrder(paymentIntent: Stripe.PaymentIntent) {
  console.log("=== FULFILLING ORDER ===");
  console.log("Attempting to fulfill order for PaymentIntent:", paymentIntent.id);
  console.log(`Payment of ${paymentIntent.amount} succeeded! ID: ${paymentIntent.id}`);
  
  // Store transaction data
  const customerEmail = paymentIntent.metadata?.customer_email && 
                       paymentIntent.metadata.customer_email !== 'no-email-provided' 
                       ? paymentIntent.metadata.customer_email 
                       : paymentIntent.receipt_email || 'no-email';

  const transactionData = {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    customerEmail,
    timestamp: new Date().toISOString(),
    metadata: paymentIntent.metadata
  };

  confirmedTransactions.push(transactionData);
  saveTransactionsToFile();
  console.log("✅ Transaction stored persistently:", transactionData);
  console.log(`📊 Total confirmed transactions: ${confirmedTransactions.length}`);
  console.log("🎉 TRANSACTION SUCCESS CONFIRMED BY STRIPE WEBHOOK! 🎉");
  console.log(`💰 Amount: $${(transactionData.amount / 100).toFixed(2)}`);
  console.log(`📧 Customer: ${transactionData.customerEmail}`);
  console.log(`🆔 Transaction ID: ${transactionData.id}`);
  console.log("📊 View all transactions at: /api/transactions");
}

/**
 * Sends a transaction confirmation email using SendGrid.
 * @param customerEmail The email address of the customer.
 * @param paymentIntent The successful PaymentIntent object from Stripe.
 */
async function sendOrderConfirmationEmail(customerEmail: string | null, paymentIntent?: Stripe.PaymentIntent) {
  console.log("=== SENDING ORDER CONFIRMATION EMAIL ===");
  console.log("📧 Customer email parameter:", customerEmail);
  console.log("💳 PaymentIntent provided:", paymentIntent ? "YES" : "NO");
  console.log("🔑 SendGrid API key available:", sendGridApiKey ? "YES" : "NO");

  if (!customerEmail) {
    console.log("❌ No customer email provided, skipping order confirmation email.");
    return;
  }

  if (!sendGridApiKey) {
    console.log("❌ SendGrid API key not configured, skipping email send.");
    console.log("💡 Make sure SENDGRID_API_KEY environment variable is set");
    return;
  }

  if (!paymentIntent) {
    console.log("❌ No payment intent provided, skipping email send.");
    return;
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@yourapp.com';
  console.log("📤 From email:", fromEmail);
  console.log("📥 To email:", customerEmail);
  console.log("💰 Amount:", paymentIntent.amount / 100, paymentIntent.currency);

  const msg = {
    to: customerEmail,
    from: fromEmail, // Use a verified sender
    subject: 'Payment Confirmation - Transaction Successful',
    text: `Thank you for your payment! Your transaction ID is ${paymentIntent.id}. The amount charged is ${(paymentIntent.amount / 100).toLocaleString('en-US', { style: 'currency', currency: paymentIntent.currency })}.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Payment Confirmation</h2>
        <p><strong>Thank you for your payment!</strong></p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Transaction Details:</strong></p>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Transaction ID:</strong> ${paymentIntent.id}</li>
            <li><strong>Amount:</strong> ${(paymentIntent.amount / 100).toLocaleString('en-US', { style: 'currency', currency: paymentIntent.currency })}</li>
            <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
          </ul>
        </div>
        <p>If you have any questions about this transaction, please contact our support team.</p>
        <p>Thank you for your business!</p>
      </div>
    `,
  };

  console.log("📋 Email message object created:");
  console.log("- To:", msg.to);
  console.log("- From:", msg.from);
  console.log("- Subject:", msg.subject);

  try {
    console.log("📤 Attempting to send email via SendGrid...");
    const response = await sgMail.send(msg);
    console.log("✅ Transaction confirmation email sent successfully!");
    console.log("📧 Sent to:", customerEmail);
    console.log("📋 SendGrid response:", response);
  } catch (error: any) {
    console.error("❌ Error sending transaction confirmation email:");
    console.error("🔍 Error details:", error);
    if (error.response) {
      console.error("📋 SendGrid API response:", error.response.body);
    }
  }
  console.log("=== EMAIL SENDING COMPLETED ===");
}

/**
 * Sends a payment failed notification email using SendGrid.
 * @param customerEmail The email address of the customer.
 * @param paymentIntent The failed PaymentIntent object from Stripe.
 */
async function sendPaymentFailedEmail(customerEmail: string | null, paymentIntent?: Stripe.PaymentIntent) {
  if (!customerEmail) {
    console.log("No customer email provided, skipping payment failed email.");
    return;
  }

  if (!sendGridApiKey) {
    console.log("SendGrid API key not configured, skipping email send.");
    return;
  }

  if (!paymentIntent) {
    console.log("No payment intent provided, skipping email send.");
    return;
  }

  const msg = {
    to: customerEmail,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourapp.com', // Use a verified sender
    subject: 'Payment Failed - Action Required',
    text: `We're sorry, but your payment could not be processed. Transaction ID: ${paymentIntent.id}. Please try again or contact support for assistance.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Payment Failed</h2>
        <p>We're sorry, but your payment could not be processed.</p>
        <div style="background-color: #fff3e0; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff9800;">
          <p><strong>Transaction Details:</strong></p>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Transaction ID:</strong> ${paymentIntent.id}</li>
            <li><strong>Attempted Amount:</strong> ${(paymentIntent.amount / 100).toLocaleString('en-US', { style: 'currency', currency: paymentIntent.currency })}</li>
            <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
          </ul>
        </div>
        <p>Please try the following:</p>
        <ul>
          <li>Check your payment method details</li>
          <li>Ensure sufficient funds are available</li>
          <li>Try a different payment method</li>
        </ul>
        <p>If you continue to experience issues, please contact our support team.</p>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log('Payment failed notification email sent successfully to:', customerEmail);
  } catch (error) {
    console.error('Error sending payment failed notification email:', error);
  }
}


export async function handlePaymentIntent(
  options: PaymentIntentOptions
): Promise<PaymentIntentResponse> {
  console.log("=== HANDLE PAYMENT INTENT CALLED ===");
  console.log("📋 Full options received:", JSON.stringify(options, null, 2));
  console.log("📧 Email in options:", options.email);
  console.log("💰 Amount in options:", options.amount);
  console.log("🏷️ Code in options:", options.code);
  console.log("🆔 PaymentIntent ID in options:", options.paymentIntentId);

  const stripe = getStripe();

  if (options.paymentIntentId) {
    console.log("🔍 Retrieving existing PaymentIntent:", options.paymentIntentId);
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(options.paymentIntentId, {
        expand: ['payment_method']
      });

      console.log("📋 Retrieved PaymentIntent metadata:", paymentIntent.metadata);
      console.log("📧 Retrieved PaymentIntent receipt_email:", paymentIntent.receipt_email);

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
      console.error("❌ Error retrieving PaymentIntent:", e.message);
      return { error: e.message };
    }
  }

  if (options.amount || options.code) {
    // Determine the amount to charge
    let finalAmount = options.amount;

    if (options.code && !options.amount) {
      // If only code is provided, use the mapped price
      finalAmount = getCodePrice(options.code);
      console.log(`🏷️ Using code ${options.code} price: $${finalAmount}`);
    } else if (options.code && options.amount) {
      // If both are provided, you can choose to use code price or validate against it
      const codePrice = getCodePrice(options.code);
      console.log(`🏷️ Code ${options.code} maps to $${codePrice}, but amount $${options.amount} was also provided`);
      // For now, we'll use the provided amount, but you can change this logic
      finalAmount = options.amount;
    }

    if (!finalAmount || finalAmount <= 0.50) {
      console.error("❌ Invalid amount:", finalAmount);
      return { error: "Amount must be at least $0.50." };
    }

    try {
      console.log("💳 Creating PaymentIntent with:");
      console.log("- Amount:", Math.round(finalAmount * 100), "cents");
      console.log("- Email:", options.email || "NONE");
      console.log("- Code:", options.code || "NONE");

      const createPaymentIntentData = {
        amount: Math.round(finalAmount * 100), // Amount in cents
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        receipt_email: options.email || null,
        metadata: {
          code: options.code || 'no-code',
          original_amount: finalAmount.toString(),
          customer_email: options.email || 'no-email-provided'
        }
      };

      console.log("📋 PaymentIntent creation data:", JSON.stringify(createPaymentIntentData, null, 2));

      const paymentIntent = await stripe.paymentIntents.create(createPaymentIntentData);

      console.log("✅ PaymentIntent created successfully:");
      console.log("- ID:", paymentIntent.id);
      console.log("- Receipt email:", paymentIntent.receipt_email);
      console.log("- Metadata:", JSON.stringify(paymentIntent.metadata, null, 2));
      console.log("- Client secret:", paymentIntent.client_secret ? "PRESENT" : "MISSING");

      return { clientSecret: paymentIntent.client_secret ?? undefined };
    } catch (e: any) {
      console.error("❌ Error creating payment intent:");
      console.error("- Message:", e.message);
      console.error("- Stack:", e.stack);
      return { error: e.message };
    }
  }

  console.error("❌ Invalid options provided to handlePaymentIntent");
  return { error: "Invalid options provided." };
}

export async function handleWebhook(signature: string, body: string) {
  console.log("=== STRIPE WEBHOOK HANDLER INVOKED ===");
  console.log("📅 Timestamp:", new Date().toISOString());
  console.log("🔍 Signature received:", signature ? "YES" : "NO");
  console.log("📦 Body received:", body ? `YES (${body.length} chars)` : "NO");
  console.log("🌐 Webhook URL should be: https://your-repl-url.replit.dev/api/stripe/webhook");

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log("🔧 Environment variables check:");
  console.log("- STRIPE_WEBHOOK_SECRET:", webhookSecret ? "SET" : "NOT SET");
  console.log("- SENDGRID_API_KEY:", process.env.SENDGRID_API_KEY ? "SET" : "NOT SET");
  console.log("- SENDGRID_FROM_EMAIL:", process.env.SENDGRID_FROM_EMAIL ? "SET" : "NOT SET");

  if (!webhookSecret) {
    console.error("❌ Stripe webhook secret is not configured.");
    return { error: "Webhook secret not configured.", status: 500 };
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log("✅ Stripe event constructed successfully:", event.id);
    console.log("📊 Event type:", event.type);
    console.log("📋 Event created:", new Date(event.created * 1000).toISOString());
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return { error: `Webhook Error: ${err.message}`, status: 400 };
  }

  console.log(`📨 Processing verified Stripe event: ${event.type}`);

  // Log webhook event summary
  console.log("📊 WEBHOOK EVENT SUMMARY:");
  console.log("- Event ID:", event.id);
  console.log("- Event Type:", event.type);
  console.log("- Created:", new Date(event.created * 1000).toISOString());
  console.log("- Live Mode:", event.livemode ? "YES" : "NO (TEST MODE)");

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      console.log("🎯 HANDLING PAYMENT_INTENT.SUCCEEDED");
      const paymentIntentSucceeded = event.data.object as Stripe.PaymentIntent;
      console.log(`💰 PaymentIntent for ${paymentIntentSucceeded.amount} was successful! ID: ${paymentIntentSucceeded.id}`);
      console.log(`📧 Customer email from receipt_email: ${paymentIntentSucceeded.receipt_email || 'NONE'}`);
      console.log(`📧 Customer email from metadata: ${paymentIntentSucceeded.metadata?.customer_email || 'NONE'}`);
      console.log(`📋 Full PaymentIntent metadata:`, JSON.stringify(paymentIntentSucceeded.metadata, null, 2));

      // Get customer email from metadata (more reliable for webhooks)
      const customerEmail = paymentIntentSucceeded.metadata?.customer_email && 
                           paymentIntentSucceeded.metadata.customer_email !== 'no-email-provided' 
                           ? paymentIntentSucceeded.metadata.customer_email 
                           : paymentIntentSucceeded.receipt_email;

      console.log(`📧 Final customer email to use: ${customerEmail || 'NONE'}`);

      // Fulfill the order
      console.log("📦 Starting order fulfillment...");
      try {
        await fulfillOrder(paymentIntentSucceeded);
        console.log("✅ Order fulfillment completed");
        console.log("🎉 TRANSACTION SUCCESS CONFIRMED BY STRIPE WEBHOOK! 🎉");
        console.log(`💰 Amount: $${(paymentIntentSucceeded.amount / 100).toFixed(2)}`);
        console.log(`📧 Customer: ${customerEmail}`);
        console.log(`🆔 Transaction ID: ${paymentIntentSucceeded.id}`);
        console.log("📊 Transaction data stored and ready for Firestore migration");
      } catch (fulfillError: any) {
        console.error("❌ Error during order fulfillment:", fulfillError);
      }

      break;
    case 'payment_intent.payment_failed':
      console.log("🎯 HANDLING PAYMENT_INTENT.PAYMENT_FAILED");
      const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
      console.log(`❌ Payment failed for PaymentIntent: ${paymentIntentFailed.id}`);
      console.log(`📧 Customer email from receipt_email: ${paymentIntentFailed.receipt_email || 'NONE'}`);
      console.log(`📧 Customer email from metadata: ${paymentIntentFailed.metadata?.customer_email || 'NONE'}`);

      // Get customer email from metadata (more reliable for webhooks)
      const failedCustomerEmail = paymentIntentFailed.metadata?.customer_email && 
                                  paymentIntentFailed.metadata.customer_email !== 'no-email-provided' 
                                  ? paymentIntentFailed.metadata.customer_email 
                                  : paymentIntentFailed.receipt_email;

      // Notify the user that their payment failed.
      try {
        await sendPaymentFailedEmail(failedCustomerEmail, paymentIntentFailed);
        console.log("✅ Failed payment email sent");
      } catch (emailError: any) {
        console.error("❌ Error sending failed payment email:", emailError);
      }

      break;
    // ... handle other event types you care about
    default:
      console.log(`🤷 Unhandled event type ${event.type}`);
  }

  console.log("=== WEBHOOK HANDLER COMPLETED ===");
  return { received: true, status: 200 };
}