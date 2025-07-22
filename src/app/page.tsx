import { PaymentWrapper } from "@/components/payment/PaymentWrapper";
import { SystemStatusHeader } from "@/components/status/SystemStatusHeader";
import { CircleDollarSign } from "lucide-react";

export default function Home() {
  return (
    <div className="bg-background font-body">
      <header className="py-4 px-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <CircleDollarSign className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-headline font-semibold text-foreground">
          PayUp
        </h1>
        {/* System status indicators */}
        <div className="mt-2 sm:mt-0 sm:ml-auto">
          <SystemStatusHeader />
        </div>
      </header>
      <main className="flex flex-col items-center justify-start pt-8 sm:pt-12 md:pt-16 px-4">
        <PaymentWrapper />
      </main>
    </div>
  );
}
