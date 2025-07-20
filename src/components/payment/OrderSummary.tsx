"use client";

import React from "react";
import type { PaymentIntent } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OrderSummaryProps {
  paymentIntent: PaymentIntent;
  onReset: () => void;
}

export function OrderSummary({ paymentIntent, onReset }: OrderSummaryProps) {
  const { id, amount, currency, charges } = paymentIntent;
  const cardDetails = charges.data[0]?.payment_method_details?.card;

  return (
    <div className="space-y-6 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-accent" />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-headline">Payment Successful!</h2>
        <p className="text-muted-foreground">
          Thank you for your payment. Here is your summary.
        </p>
      </div>
      <div className="rounded-lg border bg-secondary/50 p-4 text-left text-sm space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount Paid:</span>
          <span className="font-medium text-foreground">
            {(amount / 100).toLocaleString("en-US", {
              style: "currency",
              currency: currency,
            })}
          </span>
        </div>
        
        {cardDetails && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Payment Method:</span>
            <div className="flex items-center gap-2">
              <span className="font-medium capitalize text-foreground">{cardDetails.brand}</span>
              <Badge variant="outline">**** {cardDetails.last4}</Badge>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">Transaction ID:</span>
          <span className="font-mono text-xs font-medium text-foreground truncate max-w-[150px]">
            {id}
          </span>
        </div>
      </div>
      <Button onClick={onReset} className="w-full">
        Make Another Payment
      </Button>
    </div>
  );
}
