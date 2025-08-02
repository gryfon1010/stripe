"use client";

import React, { useState, useEffect } from "react";
import type { Stripe as StripeType, StripeElementsOptions } from "@stripe/stripe-js";
import type { SimplePaymentIntent } from "@/lib/actions";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handlePaymentIntent } from "@/lib/actions";
import { Loader2, CreditCard } from "lucide-react";

interface CheckoutFormProps {
  stripePromise: Promise<StripeType | null>;
  onPaymentSuccess: (paymentIntent: SimplePaymentIntent) => void;
  onError: (message: string) => void;
  code1?: string | null;
  code2?: string | null;
}

interface FormContentProps extends Omit<CheckoutFormProps, 'stripePromise'>{
  code1?: string | null;
  code2?: string | null;
}

function FormContent({ onPaymentSuccess, onError, code1, code2 }: FormContentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState("10.00");
  const [userFields, setUserFields] = useState<{ address?: string; uid?: string; email?: string } | null>(null);
  const [doctorFields, setDoctorFields] = useState<{ consultationFee?: number; email?: string; uid?: string } | null>(null);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentElementComplete, setIsPaymentElementComplete] = useState(false);

  // When userFields changes, auto-fill email if available
  useEffect(() => {
    if (userFields && (userFields as any).email) {
      setEmail((userFields as any).email);
    }
  }, [userFields]);

  // Set default amount based on code
  useEffect(() => {
    if (!(code1 && code2)) return;
    (async () => {
      try {
        const { getApps, initializeApp } = await import('firebase/app');
        const { getFirestore, doc, getDoc } = await import('firebase/firestore');
        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        };
        let app;
        if (getApps().length === 0) {
          app = initializeApp(firebaseConfig);
        } else {
          app = getApps()[0];
        }
        const db = getFirestore(app);
        const [doctorSnap, userSnap] = await Promise.all([
          getDoc(doc(db, 'doctors', code1)),
          getDoc(doc(db, 'users', code2)),
        ]);
        let userFields = null, doctorFields = null;
        if (userSnap.exists()) {
          const userData = userSnap.data();
          userFields = {
            address: userData.address,
            uid: userData.uid,
            email: userData.email,
          };
        }
        if (doctorSnap.exists()) {
          const doctorData = doctorSnap.data();
          doctorFields = {
            consultationFee: doctorData.consultationFee,
            email: doctorData.email,
            uid: doctorData.uid,
          };
          // If consultationFee is defined and > 0, set it as amount
          if (doctorData.consultationFee && !isNaN(Number(doctorData.consultationFee))) {
            setAmount(doctorData.consultationFee.toString());
          }
        }
        setUserFields(userFields);
        setDoctorFields(doctorFields);
        console.log('[CLIENT] User fields:', userFields);
        console.log('[CLIENT] Doctor fields:', doctorFields);
      } catch (err) {
        console.error('[CLIENT] Firestore fetch error:', err);
      }
    })();
  }, [code1, code2]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log("=== CHECKOUT FORM SUBMIT ===");
    console.log("📧 Email value:", email);
    console.log("💰 Amount value:", amount);
    console.log("🏷️ Code1:", code1, "Code2:", code2);

    if (!stripe || !elements) {
      console.error("❌ Stripe or elements not available");
      return;
    }

    setIsLoading(true);

    // Step 1: Validate form
    if (!amount || parseFloat(amount) <= 0) {
      console.error("❌ Invalid amount:", amount);
      onError("Please enter a valid amount.");
      setIsLoading(false);
      return;
    }

    if (!email) {
      console.error("❌ No email provided");
      onError("Please enter your email address.");
      setIsLoading(false);
      return;
    }

    console.log("✅ Form validation passed");

    try {
      // Step 2: Create Payment Intent
      console.log("💳 Calling handlePaymentIntent with:");
      const paymentIntentParams = {
        amount: parseFloat(amount),
        email: email,
        code1: code1 || undefined,
        code2: code2 || undefined
      };
      console.log("📋 Payment intent params:", JSON.stringify(paymentIntentParams, null, 2));

      const response = await handlePaymentIntent(paymentIntentParams);

      if (response.error) {
        console.error("❌ PaymentIntent creation failed:", response.error);
        onError(response.error);
        setIsLoading(false);
        return;
      }

      const clientSecret = response.clientSecret;
      if (!clientSecret) {
        console.error("❌ No client secret received");
        onError("Failed to create payment session.");
        setIsLoading(false);
        return;
      }

      console.log("✅ PaymentIntent created, submitting elements...");

      // Step 3: Submit elements first (required by Stripe)
      const { error: submitError } = await elements.submit();
      if (submitError) {
        console.error("❌ Elements submission failed:", submitError);
        onError(submitError.message || "Failed to submit payment details.");
        setIsLoading(false);
        return;
      }

      console.log("✅ Elements submitted, confirming payment...");

      // Step 4: Confirm Payment
      const { error } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/success`,
        },
        redirect: "if_required",
      });

      if (error) {
        console.error("❌ Payment confirmation failed:", error);
        if (error.type === "card_error" || error.type === "validation_error") {
          onError(error.message || "An error occurred during payment.");
        } else {
          onError("An unexpected error occurred.");
        }
      } else {
        console.log("✅ Payment confirmed, retrieving details...");
        // Payment succeeded, get the payment intent
        const piResponse = await handlePaymentIntent({
          paymentIntentId: clientSecret.split('_secret')[0]
        });

        if (piResponse.paymentIntent) {
          console.log("✅ Payment success callback triggered");
          onPaymentSuccess(piResponse.paymentIntent);
        } else {
          console.error("❌ Couldn't retrieve payment details");
          onError("Payment succeeded but couldn't retrieve details.");
        }
      }
    } catch (error) {
      console.error("❌ Unexpected payment error:", error);
      onError("An unexpected error occurred.");
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
       <div className="space-y-2 text-center">
         <CreditCard className="mx-auto h-12 w-12 text-primary" />
        <h2 className="text-2xl font-bold font-headline">One-Time Payment</h2>
        <p className="text-muted-foreground">
          {code1 && code2 ? `Doctor ${code1} / User ${code2}` : 'Enter an amount and your payment details below.'}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (USD)</Label>
          <div className="relative">
             <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground">$</span>
            <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.00"
                required
                min="0.50"
                step="0.01"
                className="pl-7"
                disabled={!!(code1 && code2)}
            />
          </div>
        </div>
        <PaymentElement onChange={(e) => setIsPaymentElementComplete(e.complete)} />
        <Button
          type="submit"
          className="w-full transition-all"
          disabled={!stripe || !elements || isLoading || !amount || !email || !isPaymentElementComplete}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            `Pay $${parseFloat(amount || '0').toFixed(2)}`
          )}
        </Button>
      </form>
    </div>
  );
}

export function CheckoutForm({ stripePromise, ...props }: CheckoutFormProps) {
  const options: StripeElementsOptions = {
    mode: "payment",
    amount: 100, // dummy amount, will be updated
    currency: "usd",
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#708090',
        colorBackground: '#F0F8FF',
        colorText: '#334155',
        colorDanger: '#df1b41',
        fontFamily: 'Inter, sans-serif',
        borderRadius: '0.5rem'
      }
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <FormContent {...props} />
    </Elements>
  );
}