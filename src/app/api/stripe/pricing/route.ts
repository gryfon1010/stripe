
import { NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Maps a code to a price. You can customize this logic as needed.
 * @param code The code to map to a price
 * @returns The price in dollars
 */
function getCodePrice(code: string): number {
  const priceMap: { [key: string]: number } = {
    'basic': 5.00,
    'premium': 15.00,
    'pro': 25.00,
    'enterprise': 50.00
  };
  
  return priceMap[code.toLowerCase()] || 10.00; // Default to $10.00 if code not found
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.json(
      { error: "Code parameter is required" }, 
      { status: 400, headers: corsHeaders }
    );
  }
  
  const price = getCodePrice(code);
  
  return NextResponse.json(
    { 
      code,
      price,
      formatted_price: `$${price.toFixed(2)}`
    }, 
    { status: 200, headers: corsHeaders }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
