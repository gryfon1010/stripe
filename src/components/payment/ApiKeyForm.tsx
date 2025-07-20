"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";

interface ApiKeyFormProps {
  onSubmit: (apiKey: string) => void;
}

export function ApiKeyForm({ onSubmit }: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(apiKey);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <KeyRound className="mx-auto h-12 w-12 text-primary" />
        <h2 className="text-2xl font-bold font-headline">Stripe Configuration</h2>
        <p className="text-muted-foreground">
          Enter your Stripe secret key to begin processing payments.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-key">Stripe API Secret Key</Label>
          <Input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk_test_..."
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={!apiKey}>
          Save and Continue
        </Button>
      </form>
       <p className="text-xs text-center text-muted-foreground px-4">
          Your key is saved locally in your browser and never sent to our servers.
        </p>
    </div>
  );
}
