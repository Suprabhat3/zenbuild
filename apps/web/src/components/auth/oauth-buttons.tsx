"use client";

import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17" className="fill-current">
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.4-1.27.74-1.56-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .98-.31 3.2 1.18a11.1 11.1 0 0 1 5.82 0c2.22-1.49 3.2-1.18 3.2-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

export function GithubButton({ redirectTo }: { redirectTo: string }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const { error } = await authClient.signIn.social({
      provider: "github",
      callbackURL: redirectTo,
    });
    if (error) {
      setLoading(false);
      toast.error(error.message ?? "Could not start GitHub sign-in.");
    }
    // On success the browser is redirected to GitHub; no further work here.
  }

  return (
    <button
      type="button"
      className="auth-btn auth-btn-ghost"
      onClick={onClick}
      disabled={loading}
    >
      <GithubIcon />
      Continue with GitHub
    </button>
  );
}
