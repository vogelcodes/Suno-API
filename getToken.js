// Helper script to extract authorization token from browser
// Run this in the browser console on https://suno.com

// Method 1: Extract from localStorage/sessionStorage
console.log("=== Method 1: Check Storage ===");
console.log("localStorage:", localStorage);
console.log("sessionStorage:", sessionStorage);

// Method 2: Extract from network requests
console.log("\n=== Method 2: Monitor Network ===");
console.log("Open DevTools > Network tab, filter by 'feed' or 'api'");
console.log("Look for requests to studio-api.prod.suno.com");
console.log("Check the 'authorization' header in the request headers");

// Method 3: Extract from current page's fetch intercept
console.log("\n=== Method 3: Intercept Fetch ===");
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (typeof url === 'string' && url.includes('studio-api.prod.suno.com')) {
    const headers = args[1]?.headers;
    if (headers?.authorization) {
      console.log("🔑 Found Authorization Token:");
      console.log(headers.authorization);
      console.log("\nCopy the token after 'Bearer '");
    }
  }
  return originalFetch.apply(this, args);
};
console.log("✅ Fetch interceptor installed. Navigate around Suno to capture token.");

// Method 4: Extract from Clerk session (if available)
console.log("\n=== Method 4: Clerk Session ===");
if (window.Clerk) {
  window.Clerk.session?.getToken().then(token => {
    console.log("🔑 Clerk Token:", token);
  });
} else {
  console.log("Clerk not available on this page");
}

