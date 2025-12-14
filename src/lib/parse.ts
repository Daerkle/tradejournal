"use client";

import Parse from "parse";

// Initialize Parse - will be called once on client side
let initialized = false;

export function initializeParse() {
  if (initialized || typeof window === "undefined") return;

  Parse.initialize(
    process.env.NEXT_PUBLIC_PARSE_APP_ID || "YOURAPPNAME",
    process.env.NEXT_PUBLIC_PARSE_JS_KEY || ""
  );
  Parse.serverURL =
    process.env.NEXT_PUBLIC_PARSE_SERVER_URL || "http://localhost:28080/parse";

  initialized = true;
}

export { Parse };
