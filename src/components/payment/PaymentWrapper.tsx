"use client";

import React, { useState, useEffect } from "react";
import type { Stripe as StripeType, PaymentIntent } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AnimatePresence, motion } from "framer-motion";
import { ApiKeyForm } from "./ApiKeyForm";
import { CheckoutForm } from "./CheckoutForm";
import { OrderSummary } from "./OrderSummary";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

type View = "apiKey" | "checkout" | "summary";

export function PaymentWrapper() {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<StripeType | null> | null>(null);
  const [view, setView] = useState<View>("apiKey");
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedPublishableKey = localStorage.getItem("stripePublishableKey");
    const storedSecretKey = localStorage.getItem("stripeSecretKey");
    if (storedPublishableKey && storedSecretKey) {
      handleApiKeysSubmit({ publishableKey: storedPublishableKey, secretKey: storedSecretKey });
    }
  }, []);
  
  const handleApiKeysSubmit = (keys: { publishableKey: string; secretKey: string }) => {
    const { publishableKey, secretKey } = keys;
    if (publishableKey && publishableKey.startsWith("pk_") && secretKey && secretKey.startsWith("sk_")) {
      setPublishableKey(publishableKey);
      setSecretKey(secretKey);
      localStorage.setItem("stripePublishableKey", publishableKey);
      localStorage.setItem("stripeSecretKey", secretKey);
      try {
        setStripePromise(loadStripe(publishableKey));
        setView("checkout");
        setError(null);
      } catch (e) {
        setError("Invalid Stripe Publishable key format.");
        setPublishableKey(null);
        setSecretKey(null);
        localStorage.removeItem("stripePublishableKey");
        localStorage.removeItem("stripeSecretKey");
      }
    } else {
        setError("Invalid Stripe keys provided. Please check your keys and try again.");
    }
  };

  const handlePaymentSuccess = (intent: PaymentIntent) => {
    setPaymentIntent(intent);
    setView("summary");
  };
  
  const handleReset = () => {
    setPaymentIntent(null);
    setView("checkout");
  };
  
  const handleKeyChange = () => {
      setPublishableKey(null);
      setSecretKey(null);
      localStorage.removeItem("stripePublishableKey");
      localStorage.removeItem("stripeSecretKey");
      setView("apiKey");
  }

  const renderView = () => {
    switch (view) {
      case "apiKey":
        return <ApiKeyForm onApiKeysSubmit={handleApiKeysSubmit} />;
      case "checkout":
        if (secretKey && stripePromise) {
          return (
            <CheckoutForm
              stripePromise={stripePromise}
              secretKey={secretKey}
              onPaymentSuccess={handlePaymentSuccess}
              onError={setError}
              onChangeKey={handleKeyChange}
            />
          );
        }
        return null;
      case "summary":
        if (paymentIntent) {
          return <OrderSummary paymentIntent={paymentIntent} onReset={handleReset} />;
        }
        return null;
    }
  };

  if (!isMounted) {
      return null;
  }

  return (
    <Card className="w-full max-w-md shadow-lg transition-all duration-300">
      <CardContent className="p-6">
        {error && (
            <Alert variant="destructive" className="mb-4">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
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
