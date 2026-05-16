import { Mail, Lock, ArrowRight, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { useState } from "react";
import { isSupabaseConfigured } from "../lib/supabase";
import { signInWithOAuth } from "../lib/projectHubApi";
import { useLanguage } from "../context/LanguageContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register, isLoading } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFormIncomplete =
    !email.trim() ||
    !password.trim() ||
    (mode === "register" && (!fullName.trim() || !confirmPassword.trim()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "register") {
      if (!fullName.trim()) {
        toast.error(t("login_nameRequired"));
        return;
      }

      if (password !== confirmPassword) {
        toast.error(t("login_passwordMismatch"));
        return;
      }
    }

    try {
      setIsSubmitting(true);

      if (mode === "login") {
        await login(email, password);
        toast.success(t("login_welcomeBack"), { duration: 2500 });
        navigate("/home");
        return;
      }

      const result = await register(fullName.trim(), email, password);

      if (result.needsEmailConfirmation) {
        toast.success(t("login_accountCreatedCheckEmail"), {
          duration: 4500,
        });
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      toast.success(t("login_accountCreated"), { duration: 2500 });
      navigate("/home");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("login_requestError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "github") => {
    if (!isSupabaseConfigured) {
      toast.error(t("login_supabaseFirst"));
      return;
    }

    try {
      await signInWithOAuth(provider);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("login_socialError"));
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-center items-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 text-center text-white"
        >
          <h1 className="text-5xl font-bold mb-6">{t("login_welcomeTitle")}</h1>
          <p className="text-xl text-white/90 max-w-md">
            {t("login_welcomeSubtitle")}
          </p>

          <div className="mt-12 grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl"
              />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="flex flex-col justify-center items-center bg-white p-8 sm:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {mode === "login" ? t("login_signInTitle") : t("login_registerTitle")}
            </h2>
            <p className="text-gray-600">
              {isSupabaseConfigured
                ? mode === "login"
                  ? t("login_signInSubtitle")
                  : t("login_registerSubtitle")
                : t("login_demoSubtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "register" && (
              <div className="space-y-2">
                <label className="text-sm text-gray-700">{t("login_fullName")}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder={t("login_enterFullName")}
                    className="pl-11 h-12 bg-gray-50 border-gray-200 rounded-xl"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-gray-700">{t("login_email")}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  placeholder={t("login_enterEmail")}
                  className="pl-11 h-12 bg-gray-50 border-gray-200 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">{t("login_password")}</label>
                {mode === "login" && (
                  <button type="button" className="text-sm text-blue-600 hover:underline">
                    {t("login_forgotPassword")}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="password"
                  placeholder={t("login_enterPassword")}
                  className="pl-11 h-12 bg-gray-50 border-gray-200 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {mode === "register" && (
              <div className="space-y-2">
                <label className="text-sm text-gray-700">{t("login_confirmPassword")}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="password"
                    placeholder={t("login_repeatPassword")}
                    className="pl-11 h-12 bg-gray-50 border-gray-200 rounded-xl"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            {mode === "login" && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="remember" className="text-sm text-gray-700">
                  {t("login_remember")}
                </label>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || isFormIncomplete}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl flex items-center justify-center gap-2 group"
            >
              <span>
                {isSubmitting
                  ? mode === "login"
                    ? t("login_signingIn")
                    : t("login_creatingAccount")
                  : mode === "login"
                    ? t("common_signIn")
                    : t("login_createAccount")}
              </span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </form>

          <div className="mt-6 text-center">
            {isLoading && (
              <p className="text-xs text-amber-600 mb-3">
                {t("login_checkingSession")}
              </p>
            )}
            <p className="text-sm text-gray-600">
              {mode === "login" ? `${t("login_noAccount")} ` : `${t("login_haveAccount")} `}
              <button
                type="button"
                onClick={() => {
                  setMode((prev) => (prev === "login" ? "register" : "login"));
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="text-blue-600 hover:underline font-medium"
              >
                {mode === "login" ? t("login_signUpFree") : t("common_signIn")}
              </button>
            </p>
          </div>

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">{t("login_orContinue")}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleOAuthLogin("google")}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-sm">Google</span>
            </button>
            <button
              type="button"
              onClick={() => handleOAuthLogin("github")}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="text-sm">GitHub</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
