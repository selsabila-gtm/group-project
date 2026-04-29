import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabase.js";

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handle = async () => {
      try {
        // Exchange the code in the URL for a real session.
        // This handles BOTH signup confirmation and email-change confirmation.
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        if (error) {
          console.error("Auth callback error:", error.message);
          navigate("/login?error=confirmation_failed");
          return;
        }

        const session = data?.session;

        if (session) {
          // Persist the session so the rest of the app finds it in localStorage
          localStorage.setItem("token", session.access_token);
          localStorage.setItem("user", JSON.stringify(session.user));

          // Sync the profile to the backend (non-blocking)
          const user = session.user;
          fetch("http://127.0.0.1:8000/sync-user", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              user_id:   user.id,
              full_name: user.user_metadata?.full_name || "",
              email:     user.email,
            }),
          }).catch(console.error);

          // Check whether this is an email-change confirmation or a fresh signup.
          // Supabase sets the `type` param in the URL for email changes.
          const params = new URLSearchParams(window.location.search);
          const type   = params.get("type"); // "email_change" | "signup" | null

          if (type === "email_change") {
            // Redirect back to settings with a success flag
            navigate("/settings?email_confirmed=1");
          } else {
            // Fresh signup confirmation → go to dashboard
            navigate("/dashboard");
          }
        } else {
          navigate("/login");
        }
      } catch (err) {
        console.error("Unexpected auth callback error:", err);
        navigate("/login");
      }
    };

    handle();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <p style={{ color: "#8892a4", fontSize: "14px" }}>Confirming your email…</p>
    </div>
  );
}

export default AuthCallback;
