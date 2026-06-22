"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => Promise<void>;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function GoogleSignInButton({ onCredential, onError, disabled = false }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

  useEffect(() => {
    if (!scriptReady || !clientId || !containerRef.current || !window.google) {
      return;
    }

    containerRef.current.innerHTML = "";

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (!response.credential) {
          onError("Google did not return a sign-in token.");
          return;
        }

        try {
          await onCredential(response.credential);
        } catch {
          onError("Google sign-in could not be completed.");
        }
      },
    });

    const measuredWidth = containerRef.current.offsetWidth || 320;
    const width = Math.min(400, Math.max(200, measuredWidth));

    window.google.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
      width,
    });
  }, [clientId, onCredential, onError, scriptReady]);

  if (!clientId) {
    return (
      <div className="google-signin-missing">
        Google sign-in is not configured for this environment.
      </div>
    );
  }

  return (
    <div className="google-signin-stack">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div ref={containerRef} className={`google-signin-button${disabled ? " is-disabled" : ""}`} aria-disabled={disabled} />
    </div>
  );
}
