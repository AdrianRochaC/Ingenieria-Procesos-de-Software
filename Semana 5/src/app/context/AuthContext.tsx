import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { currentUser } from "../utils/mockData";
import type { User } from "../utils/mockData";
import {
  getFollowedUserIds,
  getLikedProjectIds,
  getProfileForUser,
  getSavedProjectIds,
  getSessionProfile,
  signInWithPassword,
  signOutUser,
  signUpWithPassword,
  subscribeToAuthChanges,
  toggleProjectLike,
  toggleProjectSave,
  toggleUserFollow,
  updateProfile,
} from "../lib/projectHubApi";
import { translate } from "../lib/i18n";
import { isSupabaseConfigured } from "../lib/supabase";

interface AuthContextValue {
  isLoading: boolean;
  isLoggedIn: boolean;
  user: User | null;
  savedIds: Set<string>;
  followedUserIds: Set<string>;
  likedProjectIds: Set<string>;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  toggleSave: (projectId: string) => Promise<boolean>;
  isSaved: (projectId: string) => boolean;
  toggleFollow: (targetUserId: string) => Promise<boolean>;
  isFollowing: (targetUserId: string) => boolean;
  toggleLike: (projectId: string) => Promise<boolean>;
  isLiked: (projectId: string) => boolean;
  saveProfile: (input: {
    fullName: string;
    username: string;
    bio: string;
    location: string;
    website: string;
  }) => Promise<User>;
}

declare global {
  var __projectHubAuthContext__: ReturnType<typeof createContext<AuthContextValue | null>> | undefined;
}

const AuthContext =
  globalThis.__projectHubAuthContext__ ??
  createContext<AuthContextValue | null>(null);

if (!globalThis.__projectHubAuthContext__) {
  globalThis.__projectHubAuthContext__ = AuthContext;
}

AuthContext.displayName = "ProjectHubAuthContext";

async function loadUserCollections(userId: string) {
  const [savedIds, followedIds, likedIds] = await Promise.all([
    getSavedProjectIds(userId),
    getFollowedUserIds(userId),
    getLikedProjectIds(userId),
  ]);

  return {
    savedIds: new Set(savedIds),
    followedIds: new Set(followedIds),
    likedIds: new Set(likedIds),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set());
  const [likedProjectIds, setLikedProjectIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      if (!isSupabaseConfigured) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const sessionUser = await getSessionProfile();
        if (!isMounted) return;

        setUser(sessionUser);
        setIsLoggedIn(Boolean(sessionUser));

        if (sessionUser) {
          const collections = await loadUserCollections(sessionUser.id);
          if (!isMounted) return;
          setSavedIds(collections.savedIds);
          setFollowedUserIds(collections.followedIds);
          setLikedProjectIds(collections.likedIds);
        }
      } catch (error) {
        console.error("Error loading auth session", error);
        if (!isMounted) return;
        setUser(null);
        setIsLoggedIn(false);
        setSavedIds(new Set());
        setFollowedUserIds(new Set());
        setLikedProjectIds(new Set());
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    hydrateSession();

    const unsubscribe = subscribeToAuthChanges((_event, session) => {
      window.setTimeout(async () => {
        try {
          if (!session?.user) {
            if (!isMounted) return;
            setUser(null);
            setIsLoggedIn(false);
            setSavedIds(new Set());
            setFollowedUserIds(new Set());
            setLikedProjectIds(new Set());
            setIsLoading(false);
            return;
          }

          const nextUser = await getProfileForUser(session.user);
          if (!isMounted) return;

          setUser(nextUser);
          setIsLoggedIn(Boolean(nextUser));

          const collections = await loadUserCollections(nextUser.id);
          if (!isMounted) return;
          setSavedIds(collections.savedIds);
          setFollowedUserIds(collections.followedIds);
          setLikedProjectIds(collections.likedIds);
        } catch (error) {
          console.error("Error handling auth change", error);
          if (!isMounted) return;
          setUser(null);
          setIsLoggedIn(false);
          setSavedIds(new Set());
          setFollowedUserIds(new Set());
          setLikedProjectIds(new Set());
        }

        if (isMounted) {
          setIsLoading(false);
        }
      }, 0);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      setUser(currentUser);
      setIsLoggedIn(true);
      setIsLoading(false);
      return;
    }

    const nextUser = await signInWithPassword(email, password);
    setUser(nextUser);
    setIsLoggedIn(true);
    setIsLoading(false);
  };

  const logout = async () => {
    await signOutUser();
    setIsLoggedIn(false);
    setUser(null);
    setSavedIds(new Set());
    setFollowedUserIds(new Set());
    setLikedProjectIds(new Set());
  };

  const register = async (fullName: string, email: string, password: string) => {
    if (!isSupabaseConfigured) {
      setUser(currentUser);
      setIsLoggedIn(true);
      setIsLoading(false);
      return { needsEmailConfirmation: false };
    }

    const result = await signUpWithPassword(email, password, fullName);

    if (result.user) {
      setUser(result.user);
      setIsLoggedIn(true);
    } else {
      setUser(null);
      setIsLoggedIn(false);
      setSavedIds(new Set());
      setFollowedUserIds(new Set());
      setLikedProjectIds(new Set());
    }

    setIsLoading(false);
    return { needsEmailConfirmation: result.needsEmailConfirmation };
  };

  const toggleSave = async (projectId: string) => {
    if (!user) {
      throw new Error(translate("detail_signInSaveProjects"));
    }

    const wasSaved = savedIds.has(projectId);
    const nextSaved = !wasSaved;

    setSavedIds((prev) => {
      const next = new Set(prev);
      if (nextSaved) next.add(projectId);
      else next.delete(projectId);
      return next;
    });

    if (!isSupabaseConfigured) {
      return nextSaved;
    }

    try {
      await toggleProjectSave(user.id, projectId);
      return nextSaved;
    } catch (error) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(projectId);
        else next.delete(projectId);
        return next;
      });
      throw error;
    }
  };

  const isSaved = (projectId: string) => savedIds.has(projectId);

  const toggleLike = async (projectId: string) => {
    if (!user) {
      throw new Error(translate("detail_signInLikeProjects"));
    }

    const wasLiked = likedProjectIds.has(projectId);
    const nextLiked = !wasLiked;

    setLikedProjectIds((prev) => {
      const next = new Set(prev);
      if (nextLiked) next.add(projectId);
      else next.delete(projectId);
      return next;
    });

    if (!isSupabaseConfigured) {
      return nextLiked;
    }

    try {
      await toggleProjectLike(user.id, projectId);
      return nextLiked;
    } catch (error) {
      setLikedProjectIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(projectId);
        else next.delete(projectId);
        return next;
      });
      throw error;
    }
  };

  const isLiked = (projectId: string) => likedProjectIds.has(projectId);

  const toggleFollow = async (targetUserId: string) => {
    if (!user) {
      throw new Error(translate("detail_signInFollowCreators"));
    }

    if (targetUserId === user.id) {
      throw new Error(translate("auth_cannotFollowSelf"));
    }

    const wasFollowing = followedUserIds.has(targetUserId);
    const nextFollowing = !wasFollowing;

    setFollowedUserIds((prev) => {
      const next = new Set(prev);
      if (nextFollowing) next.add(targetUserId);
      else next.delete(targetUserId);
      return next;
    });

    setUser((prev) =>
      prev
        ? {
            ...prev,
            following: Math.max((prev.following ?? 0) + (nextFollowing ? 1 : -1), 0),
          }
        : prev,
    );

    try {
      await toggleUserFollow(user.id, targetUserId);

      const refreshedUser = await getProfileForUser({
        id: user.id,
        email: user.email,
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: user.joinedAt ?? new Date().toISOString(),
      } as SupabaseAuthUser);
      setUser(refreshedUser);

      return nextFollowing;
    } catch (error) {
      setFollowedUserIds((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.add(targetUserId);
        else next.delete(targetUserId);
        return next;
      });
      setUser((prev) =>
        prev
          ? {
              ...prev,
              following: Math.max((prev.following ?? 0) + (wasFollowing ? 1 : -1), 0),
            }
          : prev,
      );
      throw error;
    }
  };

  const isFollowing = (targetUserId: string) => followedUserIds.has(targetUserId);

  const saveProfile = async (input: {
    fullName: string;
    username: string;
    bio: string;
    location: string;
    website: string;
  }) => {
    if (!user) {
      throw new Error(translate("auth_editProfileSignIn"));
    }

    const nextUser = await updateProfile(user.id, input);
    setUser(nextUser);
    return nextUser;
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isLoggedIn,
        user,
        savedIds,
        followedUserIds,
        likedProjectIds,
        login,
        register,
        logout,
        toggleSave,
        isSaved,
        toggleFollow,
        isFollowing,
        toggleLike,
        isLiked,
        saveProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
