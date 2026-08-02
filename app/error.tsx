"use client";

/**
 * Catch-all for render-time failures — most likely a GitHub outage, a missing
 * env var, or a rate limit. Next hides the real message in production, so we
 * offer a retry rather than pretending to explain.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="stack">
      <h2>Something broke</h2>
      <p className="meta">
        The tune list could not be loaded. This is usually a hiccup talking to GitHub.
      </p>
      <button type="button" className="btn btn-block" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
