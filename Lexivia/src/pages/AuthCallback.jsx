import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabase.js";

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handle = async () => {
      // Exchange the code in the URL for a real session
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        console.error("Auth callback error:", error.message);
        navigate("/login");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate("/profile");
      } else {
        navigate("/login");
      }
    };

    handle();
  }, []);

  return <p>Confirming your email...</p>;
}

export default AuthCallback;
