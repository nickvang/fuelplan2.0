import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const GARMIN_STATE_KEY = "garmin_oauth_state";
const GARMIN_PREFILL_KEY = "garmin_prefill";
const GARMIN_ERROR_KEY = "garmin_error_message";
const GARMIN_CODE_VERIFIER_KEY = "garmin_code_verifier";

function setErrorAndRedirect(
  navigate: (to: string, opts?: { replace?: boolean }) => void,
  setStatus: (s: "error") => void,
  setErrorMessage: (m: string | null) => void,
  message: string
) {
  sessionStorage.setItem(GARMIN_ERROR_KEY, message);
  localStorage.setItem(GARMIN_ERROR_KEY, message);
  if (import.meta.env.DEV) console.error("[Garmin]", message);
  setErrorMessage(message);
  setStatus("error");
  if (typeof window !== "undefined" && window.opener) {
    window.opener.postMessage({ type: "garmin-error", message }, window.location.origin);
    setTimeout(() => window.close(), 100);
    return;
  }
  setTimeout(() => navigate("/?garmin=error", { replace: true }), 5000);
}

export default function GarminCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    const clearState = () => {
      sessionStorage.removeItem(GARMIN_STATE_KEY);
      localStorage.removeItem(GARMIN_STATE_KEY);
    };

    if (errorParam) {
      clearState();
      setErrorAndRedirect(navigate, setStatus, setErrorMessage, `Garmin denied: ${errorParam}`);
      return;
    }

    let storedState = sessionStorage.getItem(GARMIN_STATE_KEY);
    if (!storedState) {
      const lsRaw = localStorage.getItem(GARMIN_STATE_KEY);
      if (lsRaw) {
        try {
          const parsed = JSON.parse(lsRaw);
          const STATE_MAX_AGE_MS = 10 * 60 * 1000;
          if (parsed.state && parsed.ts && Date.now() - parsed.ts < STATE_MAX_AGE_MS) {
            storedState = parsed.state;
          }
        } catch {
          storedState = lsRaw;
        }
      }
    }

    if (!code || !state) {
      clearState();
      setErrorAndRedirect(navigate, setStatus, setErrorMessage, "Missing code or state from Garmin.");
      return;
    }

    if (!storedState) {
      clearState();
      setErrorAndRedirect(navigate, setStatus, setErrorMessage, "Session expired. Please try connecting Garmin again.");
      return;
    }

    if (storedState !== state) {
      clearState();
      setErrorAndRedirect(navigate, setStatus, setErrorMessage, "Invalid state (session may have expired).");
      return;
    }

    clearState();

    // Retrieve code_verifier from localStorage (survives popup boundary)
    const codeVerifier = localStorage.getItem(GARMIN_CODE_VERIFIER_KEY);
    localStorage.removeItem(GARMIN_CODE_VERIFIER_KEY);

    if (!codeVerifier) {
      setErrorAndRedirect(navigate, setStatus, setErrorMessage, "Missing PKCE verifier. Please try connecting Garmin again.");
      return;
    }

    const redirectBase =
      typeof window !== "undefined"
        ? (window.location.hostname.endsWith("supplme.app") ? "https://supplme.app" : window.location.origin)
        : "";
    const redirect_uri = redirectBase ? `${redirectBase}/garmin-callback` : "";
    if (import.meta.env.DEV) console.log("[Garmin] Exchanging code, redirect_uri:", redirect_uri);

    (async () => {
      try {
        const { data: body, error } = await supabase.functions.invoke('garmin-connect', {
          body: { code, redirect_uri, code_verifier: codeVerifier },
        });

        if (import.meta.env.DEV) console.log("[Garmin] Response", body, error);

        if (error) {
          const msg = typeof error === 'object' && 'message' in error
            ? error.message
            : "Error connecting to Garmin";
          setErrorAndRedirect(navigate, setStatus, setErrorMessage, msg);
          return;
        }

        if (body?.error) {
          setErrorAndRedirect(navigate, setStatus, setErrorMessage, body.error);
          return;
        }

        const garmin_snapshot = body?.garmin_snapshot;
        const connectionId = body?.connectionId;
        if (garmin_snapshot || connectionId) {
          const payload = JSON.stringify({ garmin_snapshot: garmin_snapshot ?? null, connectionId: connectionId ?? null });
          sessionStorage.setItem(GARMIN_PREFILL_KEY, payload);
          localStorage.setItem(GARMIN_PREFILL_KEY, payload);
        }

        if (typeof window !== "undefined") {
          if (window.opener) {
            window.opener.postMessage({ type: "garmin-connected" }, window.location.origin);
          }
          if (window.opener || sessionStorage.getItem("garmin_use_popup") === "1") {
            sessionStorage.removeItem("garmin_use_popup");
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
        <p className="text-muted-foreground font-medium">Garmin connection failed</p>
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

export { GARMIN_STATE_KEY, GARMIN_PREFILL_KEY, GARMIN_CODE_VERIFIER_KEY, GARMIN_ERROR_KEY };
