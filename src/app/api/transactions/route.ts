
import { NextResponse } from "next/server";
import { getConfirmedTransactions } from "@/lib/actions";

export async function GET() {
  try {
    const transactions = await getConfirmedTransactions();
    
    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      transaction_count: transactions.length,
      transactions: transactions,
      message: transactions.length > 0 
        ? "Transactions found! Ready for Firestore migration."
        : "No transactions yet. Complete a payment to see data here."
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
