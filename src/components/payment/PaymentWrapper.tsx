
"use client";

import React, { useState, useEffect } from "react";
import type { Stripe as StripeType } from "@stripe/stripe-js";
import type { SimplePaymentIntent } from "@/lib/actions";
import { loadStripe } from "@stripe/stripe-js";
import { AnimatePresence, motion } from "framer-motion";
import { CheckoutForm } from "./CheckoutForm";
import { OrderSummary } from "./OrderSummary";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { toast } from "@/hooks/use-toast";

type View = "checkout" | "summary";

export function PaymentWrapper() {
  const [stripePromise, setStripePromise] = useState<Promise<StripeType | null> | null>(null);
  const [view, setView] = useState<View>("checkout");
  const [paymentIntent, setPaymentIntent] = useState<SimplePaymentIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    
    // Extract code from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    setCode(codeParam);
    
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (publishableKey) {
        setStripePromise(loadStripe(publishableKey));
    } else {
        setError("Stripe Publishable Key is not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your environment variables.");
    }
  }, []);
  
  const handlePaymentSuccess = (intent: SimplePaymentIntent) => {
  toast({
    title: "Payment confirmed",
    description: `Transaction ${intent.id} stored successfully.`,
  });
    setPaymentIntent(intent);
    setView("summary");
    setError(null);
  };

  const handleError = (message: string) => {
    setError(message);
  }
  
  const renderView = () => {
    if (!stripePromise) {
      return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
      )
    }

    switch (view) {
      case "checkout":
        return (
          <CheckoutForm
            stripePromise={stripePromise}
            onPaymentSuccess={handlePaymentSuccess}
            onError={handleError}
            code={code}
          />
        );
      case "summary":
        if (paymentIntent) {
          return <OrderSummary paymentIntent={paymentIntent} />;
        }
        return null;
    }
  };

  if (!isMounted) {
      return (
        <Card className="w-full max-w-md shadow-lg">
            <CardContent className="p-6">
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
        </Card>
      );
  }

  return (
    <Card className="w-full max-w-md shadow-lg transition-all duration-300">
      <CardContent className="p-6">
        {error && (
            <Alert variant="destructive" className="mb-4">
                <Terminal className="h-4 w-4" />
                <AlertTitle>An Error Occurred</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
