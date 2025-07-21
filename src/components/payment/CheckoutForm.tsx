
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
}

interface FormContentProps extends Omit<CheckoutFormProps, 'stripePromise'>{}

function FormContent({ onPaymentSuccess, onError }: FormContentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState("10.00");
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentElementComplete, setIsPaymentElementComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    onError("");
    
    // First, submit the form to validate payment details on the client side
    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message || "An unexpected error occurred during form submission.");
      setIsLoading(false);
      return;
    }

    // If client-side validation is successful, create the Payment Intent
    const { clientSecret, error: backendError } = await handlePaymentIntent({
      amount: parseFloat(amount),
    });

    if (backendError || !clientSecret) {
      onError(backendError || "Failed to create payment intent.");
      setIsLoading(false);
      return;
    }

    // Now, confirm the payment
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/return`, // a dummy page for now
      },
      redirect: "if_required",
    });

    if (error) {
      onError(error.message || "An unexpected error occurred.");
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      // Refetch the payment intent from the server to get full details
      const { paymentIntent: fullPaymentIntent, error: fetchError } = await handlePaymentIntent({
        paymentIntentId: paymentIntent.id,
      });

      if (fetchError || !fullPaymentIntent) {
        onError(fetchError || "Failed to retrieve payment details.");
      } else {
        onPaymentSuccess(fullPaymentIntent);
      }
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
        <PaymentElement onChange={(e) => setIsPaymentElementComplete(e.complete)} />
        <Button
          type="submit"
          className="w-full transition-all"
          disabled={!stripe || !elements || isLoading || !amount || !isPaymentElementComplete}
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
