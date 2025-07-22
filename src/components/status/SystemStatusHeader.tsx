"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";

interface HealthData {
  services: {
    stripe: boolean;
    sendgrid: boolean;
    webhook_ready: boolean;
  };
}

/**
 * Displays the current health status of critical backend services.
 * It queries GET /api/health and shows green (✓) or red (✗) icons
 * for Stripe API, Stripe Webhook, and SendGrid email service.
 */
export function SystemStatusHeader() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchHealth();
  }, []);

  const renderIndicator = (ready: boolean) =>
    ready ? (
      <CheckCircle2 className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="animate-spin w-4 h-4" />
        Checking system status...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 text-red-600 text-sm">
        <AlertTriangle className="w-4 h-4" />
        Unable to fetch system status
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        {renderIndicator(data.services.stripe)}
        <span>Stripe</span>
      </div>
      <div className="flex items-center gap-1">
        {renderIndicator(data.services.webhook_ready)}
        <span>Webhook</span>
      </div>
      <div className="flex items-center gap-1">
        {renderIndicator(data.services.sendgrid)}
        <span>SendGrid</span>
      </div>
    </div>
  );
}
