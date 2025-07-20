"use client";

import React, { useState } from "react";
import type { Stripe as StripeType, PaymentIntent, StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPaymentIntent } from "@/lib/actions";
import { Loader2, CreditCard } from "lucide-react";

interface CheckoutFormProps {
  stripePromise: Promise<StripeType | null>;
  apiKey: string;
  onPaymentSuccess: (paymentIntent: PaymentIntent) => void;
  onError: (message: string) => void;
  onChangeKey: () => void;
}

interface FormContentProps extends Omit<CheckoutFormProps, 'stripePromise'>{}

function FormContent({ apiKey, onPaymentSuccess, onError, onChangeKey }: FormContentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    onError("");

    const { clientSecret, error: backendError } = await createPaymentIntent({
      amount: parseFloat(amount),
      apiKey: apiKey,
    });

    if (backendError || !clientSecret) {
      onError(backendError || "Failed to create payment intent.");
      setIsLoading(false);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {},
      redirect: "if_required",
    });

    if (error) {
      onError(error.message || "An unexpected error occurred.");
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      onPaymentSuccess(paymentIntent);
    } else {
      onError("Payment was not successful.");
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
       <div className="space-y-2 text-center">
         <CreditCard className="mx-auto h-12 w-12 text-primary" />
        <h2 className="text-2xl font-bold font-headline">One-Time Payment</h2>
        <p className="text-muted-foreground">
          Enter an amount and your payment details below.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
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
            />
          </div>
        </div>
        <PaymentElement />
        <Button
          type="submit"
          className="w-full transition-all"
          disabled={!stripe || !elements || isLoading || !amount}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            `Pay $${parseFloat(amount || '0').toFixed(2)}`
          )}
        </Button>
        <Button variant="link" size="sm" className="w-full" onClick={onChangeKey}>
            Use a different API Key
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
