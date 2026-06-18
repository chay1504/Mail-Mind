import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/env";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Disconnected successfully" });
  
  // Clear the mailmind_user_id cookie
  response.cookies.delete("mailmind_user_id");
  
  return response;
}
