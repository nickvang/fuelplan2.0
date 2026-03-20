import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STRAVA_STATE_KEY = "strava_oauth_state";
const STRAVA_PREFILL_KEY = "strava_prefill";

const STRAVA_ERROR_KEY = "strava_error_message";

function setErrorAndRedirect(
  navigate: (to: string, opts?: { replace?: boolean }) => void,
  setStatus: (s: "error") => void,
  setErrorMessage: (m: string | null) => void,
  message: string
) {
  sessionStorage.setItem(STRAVA_ERROR_KEY, message);
  localStorage.setItem(STRAVA_ERROR_KEY, message); // survive app→browser return on mobile
  if (import.meta.env.DEV) console.error("[Strava]", message);
  setErrorMessage(message);
  setStatus("error");
  // If in popup, notify opener and close (delay close so postMessage is received)
  if (typeof window !== "undefined" && window.opener) {
    window.opener.postMessage({ type: "strava-error", message }, window.location.origin);
    setTimeout(() => window.close(), 100);
    return;
  }
  setTimeout(() => navigate("/?strava=error", { replace: true }), 5000);
}

export default function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    const clearState = () => {
      sessionStorage.removeItem(STRAVA_STATE_KEY);
      localStorage.removeItem(STRAVA_STATE_KEY);
    };

    if (errorParam) {
      clearState();
      setErrorAndRedirect(navigate, setStatus, setErrorMessage, `Strava denied: ${errorParam}`);
      return;
    }

    let storedState = sessionStorage.getItem(STRAVA_STATE_KEY);
    if (!storedState) {
      const lsRaw = localStorage.getItem(STRAVA_STATE_KEY);
      if (lsRaw) {
        try {
          const parsed = JSON.parse(lsRaw);
          const STRAVA_STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
          if (parsed.state && parsed.ts && Date.now() - parsed.ts < STRAVA_STATE_MAX_AGE_MS) {
            storedState = parsed.state;
          }
        } catch {
          // Legacy plain string format
          storedState = lsRaw;
        }
      }
    }
    // If Strava doesn't send code/state at all, that's a real error.
    if (!code || !state) {
      clearState();
      setErrorAndRedirect(
        navigate,
        setStatus,
        setErrorMessage,
        "Missing code or state from Strava."
      );
      return;
    }

    // CSRF protection: storedState must exist and match
    if (!storedState) {
      clearState();
      setErrorAndRedirect(
        navigate,
        setStatus,
        setErrorMessage,
        "Session expired. Please try connecting Strava again."
      );
      return;
    }

    if (storedState !== state) {
      clearState();
      setErrorAndRedirect(
        navigate,
        setStatus,
        setErrorMessage,
        "Invalid state (session may have expired)."
      );
      return;
    }

    clearState();
    const redirectBase =
      typeof window !== "undefined"
        ? (window.location.hostname.endsWith("supplme.app") ? "https://supplme.app" : window.location.origin)
        : "";
    const redirect_uri = redirectBase ? `${redirectBase}/strava-callback` : "";
    if (import.meta.env.DEV) console.log("[Strava] Exchanging code, redirect_uri:", redirect_uri);

    (async () => {
      try {
        const { data: body, error } = await supabase.functions.invoke('strava-connect', {
          body: { code, redirect_uri },
        });

        if (import.meta.env.DEV) console.log("[Strava] Response", body, error);

        if (error) {
          const msg = typeof error === 'object' && 'message' in error
            ? error.message
            : "Error connecting to Strava";
          setErrorAndRedirect(navigate, setStatus, setErrorMessage, msg);
          return;
        }

        if (body?.error) {
          setErrorAndRedirect(navigate, setStatus, setErrorMessage, body.error);
          return;
        }

        const prefill = body?.prefill;
        const strava_snapshot = body?.strava_snapshot;
        if (prefill) {
          const payload = JSON.stringify({ prefill, strava_snapshot: strava_snapshot ?? null });
          sessionStorage.setItem(STRAVA_PREFILL_KEY, payload);
          localStorage.setItem(STRAVA_PREFILL_KEY, payload);  // survive mobile app switch
        }
        // If opened in popup: notify opener and close, or just close so opener can poll sessionStorage
        if (typeof window !== "undefined") {
          if (window.opener) {
            window.opener.postMessage({ type: "strava-connected" }, window.location.origin);
          }
          if (window.opener || sessionStorage.getItem("strava_use_popup") === "1") {
            sessionStorage.removeItem("strava_use_popup");
            setTimeout(() => window.close(), 100);
            return;
          }
        }
        navigate("/", { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network or server error";
        setErrorAndRedirect(navigate, setStatus, setErrorMessage, message);
      }
    })();
  }, [searchParams, navigate]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <p className="text-muted-foreground font-medium">Strava connection failed</p>
        {errorMessage && (
          <p className="mt-3 text-sm text-muted-foreground max-w-md text-center break-words" role="alert">
            {errorMessage}
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">Redirecting in a few seconds…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export { STRAVA_STATE_KEY, STRAVA_PREFILL_KEY, STRAVA_ERROR_KEY };
