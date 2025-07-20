"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";

interface ApiKeyFormProps {
  onApiKeysSubmit: (keys: { publishableKey: string; secretKey: string }) => void;
}

export function ApiKeyForm({ onApiKeysSubmit }: ApiKeyFormProps) {
  const [publishableKey, setPublishableKey] = useState("");
  const [secretKey, setSecretKey] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApiKeysSubmit({ publishableKey, secretKey });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <KeyRound className="mx-auto h-12 w-12 text-primary" />
        <h2 className="text-2xl font-bold font-headline">Stripe Configuration</h2>
        <p className="text-muted-foreground">
          Enter your Stripe API keys to begin processing payments.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="publishable-key">Stripe Publishable Key</Label>
          <Input
            id="publishable-key"
            type="text"
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            placeholder="pk_test_..."
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secret-key">Stripe Secret Key</Label>
          <Input
            id="secret-key"
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="sk_test_..."
            required
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={!publishableKey || !secretKey}
        >
          Save and Continue
        </Button>
      </form>
      <p className="text-xs text-center text-muted-foreground px-4">
        Your keys are saved locally in your browser and never sent to our
        servers.
      </p>
    </div>
  );
}
