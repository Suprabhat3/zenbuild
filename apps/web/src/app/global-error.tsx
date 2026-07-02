"use client";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, where
 * no stylesheet is guaranteed to load — hence the inline styles. It must render
 * its own <html>/<body>.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#faf6f0",
          color: "#2b2622",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <p style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          ZenBuild hit an unexpected error
        </p>
        <p style={{ maxWidth: "28rem", margin: 0, color: "#6b6259" }}>
          Something broke while rendering the page. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.75rem",
            padding: "0.55rem 1.25rem",
            borderRadius: "999px",
            border: "1px solid #2b2622",
            background: "#2b2622",
            color: "#faf6f0",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
