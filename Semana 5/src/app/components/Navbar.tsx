import { Search, Upload, Bell, User, LogOut, Languages } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "./ui/input";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { listNotifications, markNotificationsAsRead, type AppNotification } from "../lib/projectHubApi";
import { useLanguage } from "../context/LanguageContext";

interface NavbarProps {
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

export function Navbar({ searchQuery = "", onSearchChange }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const notificationCopy = (notification: AppNotification) => {
    const actor = notification.actor?.name ?? (language === "es" ? "Alguien" : "Someone");
    const project = notification.project?.title ?? (language === "es" ? "tu proyecto" : "your project");

    switch (notification.type) {
      case "like":
        return {
          title: t("notifications_like_title", { actor }),
          body: t("notifications_like_body", { project }),
        };
      case "comment":
        return {
          title: t("notifications_comment_title", { actor }),
          body: t("notifications_comment_body", { project }),
        };
      case "comment_like":
        return {
          title: t("notifications_comment_like_title", { actor }),
          body: t("notifications_comment_like_body", { project }),
        };
      case "new_project":
        return {
          title: t("notifications_new_project_title", { actor }),
          body: t("notifications_new_project_body", { project }),
        };
      default:
        return {
          title: notification.title || t("notifications_new"),
          body: notification.body || t("notifications_new"),
        };
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !user) {
      setNotifications([]);
      return;
    }

    listNotifications(user.id)
      .then(setNotifications)
      .catch((error) => {
        console.error("Unable to load notifications", error);
      });
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (!isNotificationsOpen || !user || unreadCount === 0) {
      return;
    }

    markNotificationsAsRead(user.id)
      .then(() => {
        setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
      })
      .catch((error) => {
        console.error("Unable to mark notifications as read", error);
      });
  }, [isNotificationsOpen, unreadCount, user]);

  const handleUploadClick = () => {
    if (!isLoggedIn) {
      toast(t("navbar_signInUpload"), {
        action: { label: t("common_signIn"), onClick: () => navigate("/login") },
        duration: 3000,
      });
      return;
    }
    navigate("/upload");
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast(t("navbar_signedOut"), { duration: 2000 });
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("navbar_signOutError"));
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigate("/home")}
              className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
            >
              {t("common_projectHub")}
            </button>

            <div className="hidden md:flex items-center gap-6">
              <button
                onClick={() => navigate("/home")}
                className={`text-sm transition-colors ${
                  isActive("/home") ? "text-gray-900 font-medium" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t("common_explore")}
              </button>
              <button
                onClick={handleUploadClick}
                className={`text-sm transition-colors ${
                  isActive("/upload") ? "text-gray-900 font-medium" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t("common_upload")}
              </button>
              {isLoggedIn && (
                <button
                  onClick={() => navigate("/profile")}
                  className={`text-sm transition-colors ${
                    isActive("/profile") ? "text-gray-900 font-medium" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {t("common_saved")}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8 hidden lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder={t("common_searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-10 bg-gray-50/50 border-gray-200 rounded-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <button
                  onClick={handleUploadClick}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">{t("common_upload")}</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setIsNotificationsOpen((prev) => !prev)}
                    className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Bell className="w-5 h-5 text-gray-600" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {isNotificationsOpen && (
                    <div className="absolute right-0 mt-2 w-96 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                      <div className="border-b border-gray-100 px-4 py-3">
                        <h3 className="text-sm font-semibold text-gray-900">{t("common_notifications")}</h3>
                        <p className="text-xs text-gray-500">{t("navbar_notificationsSubtitle")}</p>
                      </div>

                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                          notifications.map((notification) => {
                            const copy = notificationCopy(notification);

                            return (
                            <button
                              key={notification.id}
                              onClick={() => {
                                setIsNotificationsOpen(false);
                                if (notification.project?.id) {
                                  navigate(
                                    notification.project.creatorId === user?.id
                                      ? `/project/${notification.project.id}/manage`
                                      : `/project/${notification.project.id}`,
                                  );
                                }
                              }}
                              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                                notification.isRead ? "bg-white" : "bg-blue-50/50"
                              }`}
                            >
                              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white">
                                {notification.actor?.name?.[0] ?? "N"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {copy.title}
                                </p>
                                <p className="mt-1 text-xs text-gray-600">
                                  {copy.body}
                                </p>
                                <p className="mt-1 text-[11px] text-gray-400">
                                  {new Date(notification.createdAt).toLocaleString(language === "es" ? "es-CO" : "en-US", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </p>
                              </div>
                            </button>
                          )})
                        ) : (
                          <div className="px-4 py-8 text-center text-sm text-gray-500">
                            {t("common_noNotifications")}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={toggleLanguage}
                  className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  title={t("common_language")}
                >
                  <Languages className="h-4 w-4" />
                  <span>{language === "es" ? t("common_spanish") : t("common_english")}</span>
                </button>

                <button
                  onClick={() => navigate("/profile")}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                    {user?.name[0] ?? "U"}
                  </div>
                </button>

                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
                  title={t("common_signOut")}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/login")}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {t("common_signIn")}
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors text-sm"
                >
                  <User className="w-4 h-4" />
                  <span>{t("common_joinFree")}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
