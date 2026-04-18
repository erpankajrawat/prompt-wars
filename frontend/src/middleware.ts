import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Print the API_URL so it shows up in your Cloud Run Logs
    console.log("[Middleware] The value of process.env.API_URL is:", process.env.API_URL);

    // Read the API_URL from the Cloud Run environment at runtime!
    const backendUrl = process.env.API_URL || 'http://127.0.0.1:8000';
    
    // Construct the actual destination URL
    const destinationUrl = new URL(request.nextUrl.pathname, backendUrl);
    destinationUrl.search = request.nextUrl.search;
    
    // Transparently rewrite the request to the runtime backend URL
    return NextResponse.rewrite(destinationUrl);
  }
}

// Ensure the middleware only runs for API routes
export const config = {
  matcher: '/api/:path*',
};
