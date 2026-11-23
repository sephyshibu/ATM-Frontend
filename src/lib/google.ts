// Google sign-in, the standard way: the button sends the browser to the backend, which passes it on to Google's
// sign-in page; Google sends it back to the backend, which signs the person in and returns them to the app.

import { API_URL } from "./config"

/** The address the "Sign in with Google" button opens. `next` is where to land afterwards. */
export function googleSignInUrl(next = "/", loginHint?: string) {
  const q = new URLSearchParams({ next })
  if (loginHint) q.set("login_hint", loginHint)
  return `${API_URL}/auth/google?${q}`
}
