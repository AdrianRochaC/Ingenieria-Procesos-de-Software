import type {
  AuthChangeEvent,
  Provider,
  Session,
  User as SupabaseAuthUser,
} from "@supabase/supabase-js";
import { categories, currentUser, getSubcategoriesForCategory, mockComments, mockProjects, mockUsers } from "../utils/mockData";
import type { Comment, Project, User } from "../utils/mockData";
import { isSupabaseConfigured, supabase } from "./supabase";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  followers_count: number | null;
  following_count: number | null;
  created_at: string | null;
};

type ProjectRow = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  category: string;
  tags: string[] | null;
  likes_count: number | null;
  saves_count: number | null;
  views_count: number | null;
  created_at: string | null;
  project_file_name: string | null;
  project_file_size: string | null;
  project_file_type: string | null;
  project_file_path: string | null;
  download_allowed: boolean | null;
  creator: ProfileRow | null;
};

type CommentRow = {
  id: string;
  content: string;
  created_at: string | null;
  likes_count: number | null;
  author: ProfileRow | null;
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean | null;
  created_at: string | null;
  actor: ProfileRow | null;
  project: {
    id: string;
    title: string;
    image_url: string;
    creator_id: string;
  } | null;
};

type ProjectInput = {
  title: string;
  description: string;
  category: string;
  tags: string[];
  allowDownload: boolean;
  imageFile: File;
  projectFile: File | null;
};

type ProjectUpdateInput = {
  title: string;
  description: string;
  category: string;
  tags: string[];
  allowDownload: boolean;
};

type ProfileUpdateInput = {
  fullName: string;
  username: string;
  bio: string;
  location: string;
  website: string;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
  actor: User | null;
  project: {
    id: string;
    title: string;
    image: string;
    creatorId: string;
  } | null;
};

const PROJECT_SELECT = `
  id,
  title,
  description,
  image_url,
  category,
  tags,
  likes_count,
  saves_count,
  views_count,
  created_at,
  project_file_name,
  project_file_size,
  project_file_type,
  project_file_path,
  download_allowed,
  creator:profiles!projects_creator_id_fkey (
    id,
    email,
    full_name,
    username,
    avatar_url,
    bio,
    location,
    website,
    followers_count,
    following_count,
    created_at
  )
`;

const PROJECT_CACHE_TTL_MS = 30_000;

let projectsCache:
  | {
      value: Project[];
      expiresAt: number;
    }
  | null = null;

function isMissingRelationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("could not find the table") ||
    normalized.includes("schema cache") ||
    (normalized.includes("relation") && normalized.includes("does not exist"))
  );
}

const fallbackUsers = [currentUser, ...mockUsers];

function slugifyUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 20) || `creator${Date.now()}`;
}

function createAvatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=ffffff`;
}

function mapAuthUser(user: SupabaseAuthUser): User {
  const metadata = user.user_metadata ?? {};
  const name =
    metadata.full_name ||
    metadata.name ||
    user.email?.split("@")[0] ||
    "Creative User";

  return {
    id: user.id,
    name,
    username: slugifyUsername(metadata.username || user.email?.split("@")[0] || name),
    avatar: metadata.avatar_url || createAvatarUrl(name),
    email: user.email,
  };
}

function mapProfile(profile: ProfileRow | null, fallback?: Partial<User>): User {
  const name = profile?.full_name || fallback?.name || "Creative User";
  return {
    id: profile?.id || fallback?.id || crypto.randomUUID(),
    name,
    username: profile?.username || fallback?.username || slugifyUsername(name),
    avatar: profile?.avatar_url || fallback?.avatar || createAvatarUrl(name),
    bio: profile?.bio || fallback?.bio,
    followers: profile?.followers_count ?? fallback?.followers ?? 0,
    following: profile?.following_count ?? fallback?.following ?? 0,
    email: profile?.email || fallback?.email,
    location: profile?.location || fallback?.location,
    website: profile?.website || fallback?.website,
    joinedAt: profile?.created_at || fallback?.joinedAt,
  };
}

function mapProject(row: ProjectRow): Project {
  const creatorFallback = fallbackUsers.find((user) => user.id === row.creator?.id);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    image: row.image_url,
    creator: mapProfile(row.creator, creatorFallback),
    category: row.category,
    tags: row.tags ?? [],
    likes: row.likes_count ?? 0,
    saves: row.saves_count ?? 0,
    createdAt: new Date(row.created_at ?? Date.now()),
    views: row.views_count ?? 0,
    projectFile: row.project_file_name
      ? {
          name: row.project_file_name,
          size: row.project_file_size || "Unknown size",
          type: row.project_file_type || "File",
          downloadAllowed: Boolean(row.download_allowed),
          filePath: row.project_file_path || undefined,
        }
      : undefined,
  };
}

function mapComment(row: CommentRow): Comment {
  return {
    id: row.id,
    user: mapProfile(row.author),
    content: row.content,
    createdAt: new Date(row.created_at ?? Date.now()),
    likes: row.likes_count ?? 0,
  };
}

function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body ?? undefined,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at ?? new Date().toISOString(),
    actor: row.actor ? mapProfile(row.actor) : null,
    project: row.project
      ? {
          id: row.project.id,
          title: row.project.title,
          image: row.project.image_url,
          creatorId: row.project.creator_id,
        }
      : null,
  };
}

function extractStoragePathFromPublicUrl(publicUrl: string | null | undefined, bucket: string) {
  if (!publicUrl) return null;

  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) {
    return null;
  }

  return publicUrl.slice(index + marker.length);
}

function getCachedProjects() {
  if (!projectsCache) {
    return null;
  }

  if (Date.now() > projectsCache.expiresAt) {
    projectsCache = null;
    return null;
  }

  return projectsCache.value;
}

function setProjectsCache(projects: Project[]) {
  projectsCache = {
    value: projects,
    expiresAt: Date.now() + PROJECT_CACHE_TTL_MS,
  };
}

function invalidateProjectsCache() {
  projectsCache = null;
}

async function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return supabase;
}

async function createNotifications(
  entries: Array<{
    recipient_id: string;
    actor_id: string;
    project_id?: string | null;
    type: string;
    title: string;
    body?: string | null;
  }>,
) {
  if (entries.length === 0) {
    return;
  }

  const client = await requireSupabase();
  const { error } = await client.from("notifications").insert(entries);

  if (error) {
    if (isMissingRelationError(error.message)) {
      return;
    }
    throw new Error(error.message);
  }
}

async function uploadToBucket(bucket: string, userId: string, file: File) {
  const client = await requireSupabase();
  const extension = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  const filePath = `${userId}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
  const { error } = await client.storage.from(bucket).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    if (error.message.toLowerCase().includes("row-level security")) {
      throw new Error(`Storage bloqueó la subida al bucket "${bucket}". Ejecuta otra vez el schema.sql o crea las policies de storage en Supabase.`);
    }
    throw new Error(error.message);
  }

  return filePath;
}

async function ensureProfile(user: SupabaseAuthUser) {
  const client = await requireSupabase();
  const metadata = user.user_metadata ?? {};
  const fullName =
    metadata.full_name ||
    metadata.name ||
    user.email?.split("@")[0] ||
    "Creative User";

  await client.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: fullName,
      username: slugifyUsername(metadata.username || user.email?.split("@")[0] || fullName),
      avatar_url: metadata.avatar_url || createAvatarUrl(fullName),
    },
    { onConflict: "id" },
  );

  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProfile(data as ProfileRow, currentUser);
}

export function getCategories() {
  return categories;
}

export function getSubcategories(category: string) {
  return getSubcategoriesForCategory(category);
}

export async function getSessionProfile() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.user) {
    return null;
  }

  return ensureProfile(session.user);
}

export async function getProfileForUser(user: SupabaseAuthUser) {
  return ensureProfile(user);
}

export function subscribeToAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  if (!isSupabaseConfigured || !supabase) {
    return () => undefined;
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);

  return () => subscription.unsubscribe();
}

export async function signInWithPassword(email: string, password: string) {
  if (!isSupabaseConfigured || !supabase) {
    return currentUser;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("No user was returned by Supabase.");
  }

  return mapAuthUser(data.user);
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName: string,
) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      user: currentUser,
      needsEmailConfirmation: false,
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("No se pudo crear el usuario.");
  }

  const needsEmailConfirmation = !data.session;

  return {
    user: needsEmailConfirmation ? null : mapAuthUser(data.user),
    needsEmailConfirmation,
  };
}

export async function signOutUser() {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function signInWithOAuth(provider: Provider) {
  const client = await requireSupabase();
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/home`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateProfile(userId: string, input: ProfileUpdateInput) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ...currentUser,
      id: userId,
      name: input.fullName,
      username: slugifyUsername(input.username),
      bio: input.bio,
      location: input.location,
      website: input.website,
    };
  }

  const client = await requireSupabase();
  const username = slugifyUsername(input.username);
  const website = input.website.trim()
    ? input.website.startsWith("http://") || input.website.startsWith("https://")
      ? input.website.trim()
      : `https://${input.website.trim()}`
    : null;

  const { error } = await client
    .from("profiles")
    .update({
      full_name: input.fullName.trim(),
      username,
      bio: input.bio.trim() || null,
      location: input.location.trim() || null,
      website,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  const { data, error: fetchError } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  return mapProfile(data as ProfileRow);
}

export async function listProjects() {
  if (!isSupabaseConfigured || !supabase) {
    return mockProjects;
  }

  const cached = getCachedProjects();
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const projects = (data as ProjectRow[]).map(mapProject);
  setProjectsCache(projects);
  return projects;
}

export async function getProject(projectId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return mockProjects.find((project) => project.id === projectId) ?? null;
  }

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", projectId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProject(data as ProjectRow);
}

export async function recordProjectView(projectId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const client = await requireSupabase();
  const { error } = await client.rpc("increment_project_views", {
    project_id_input: projectId,
  });

  if (error) {
    throw new Error(error.message);
  }

  invalidateProjectsCache();
}

export async function listComments(projectId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return mockComments;
  }

  const { data, error } = await supabase
    .from("comments")
    .select(
      `
        id,
        content,
        created_at,
        likes_count,
        author:profiles!comments_user_id_fkey (
          id,
          email,
          full_name,
          username,
          avatar_url,
          bio,
          location,
          website,
          followers_count,
          following_count,
          created_at
        )
      `,
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as CommentRow[]).map(mapComment);
}

export async function listNotifications(userId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
        id,
        type,
        title,
        body,
        is_read,
        created_at,
        actor:profiles!notifications_actor_id_fkey (
          id,
          email,
          full_name,
          username,
          avatar_url,
          bio,
          location,
          website,
          followers_count,
          following_count,
          created_at
        ),
        project:projects!notifications_project_id_fkey (
          id,
          title,
          image_url,
          creator_id
        )
      `,
    )
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingRelationError(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data as NotificationRow[]).map(mapNotification);
}

export async function markNotificationsAsRead(userId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const client = await requireSupabase();
  const { error } = await client
    .from("notifications")
    .update({ is_read: true })
    .eq("recipient_id", userId)
    .eq("is_read", false);

  if (error) {
    if (isMissingRelationError(error.message)) {
      return;
    }
    throw new Error(error.message);
  }
}

export async function createComment(projectId: string, userId: string, content: string) {
  const client = await requireSupabase();

  const { data, error } = await client
    .from("comments")
    .insert({
      project_id: projectId,
      user_id: userId,
      content,
    })
    .select(
      `
        id,
        content,
        created_at,
        likes_count,
        author:profiles!comments_user_id_fkey (
          id,
          email,
          full_name,
          username,
          avatar_url,
          bio,
          location,
          website,
          followers_count,
          following_count,
          created_at
        )
      `,
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { data: projectData } = await client
    .from("projects")
    .select("creator_id, title")
    .eq("id", projectId)
    .maybeSingle();

  if (projectData && projectData.creator_id && projectData.creator_id !== userId) {
    await createNotifications([
      {
        recipient_id: projectData.creator_id as string,
        actor_id: userId,
        project_id: projectId,
        type: "comment",
        title: "comento tu proyecto",
        body: `"${projectData.title as string}" recibio un nuevo comentario.`,
      },
    ]);
  }

  return mapComment(data as CommentRow);
}

export async function getLikedCommentIds(userId: string, commentIds: string[]) {
  if (!isSupabaseConfigured || !supabase || commentIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("user_id", userId)
    .in("comment_id", commentIds);

  if (error) {
    if (isMissingRelationError(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.comment_id as string);
}

export async function toggleCommentLike(userId: string, commentId: string) {
  const client = await requireSupabase();
  const { data: existing, error: lookupError } = await client
    .from("comment_likes")
    .select("comment_id")
    .eq("user_id", userId)
    .eq("comment_id", commentId)
    .maybeSingle();

  if (lookupError) {
    if (isMissingRelationError(lookupError.message)) {
      throw new Error("La tabla comment_likes aun no existe en Supabase. Ejecuta el bloque SQL de comment likes.");
    }
    throw new Error(lookupError.message);
  }

  if (existing) {
    const { error } = await client
      .from("comment_likes")
      .delete()
      .eq("user_id", userId)
      .eq("comment_id", commentId);

    if (error) {
      throw new Error(error.message);
    }

    return false;
  }

  const { error } = await client.from("comment_likes").insert({
    user_id: userId,
    comment_id: commentId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data: commentData } = await client
    .from("comments")
    .select("user_id, project_id, projects(title)")
    .eq("id", commentId)
    .maybeSingle();

  const commentOwnerId = commentData?.user_id as string | undefined;
  const projectId = commentData?.project_id as string | undefined;
  const projectTitle =
    commentData && "projects" in commentData && commentData.projects && typeof commentData.projects === "object"
      ? ((commentData.projects as { title?: string }).title ?? "un proyecto")
      : "un proyecto";

  if (commentOwnerId && commentOwnerId !== userId) {
    await createNotifications([
      {
        recipient_id: commentOwnerId,
        actor_id: userId,
        project_id: projectId,
        type: "comment_like",
        title: "le dio like a tu comentario",
        body: `Tu comentario en "${projectTitle}" recibio un nuevo like.`,
      },
    ]);
  }

  return true;
}

export async function getSavedProjectIds(userId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("saved_projects")
    .select("project_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.project_id as string);
}

export async function getFollowedUserIds(userId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (error) {
    if (isMissingRelationError(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.following_id as string);
}

export async function getLikedProjectIds(userId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("project_likes")
    .select("project_id")
    .eq("user_id", userId);

  if (error) {
    if (isMissingRelationError(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.project_id as string);
}

export async function toggleProjectSave(userId: string, projectId: string) {
  const client = await requireSupabase();
  const { data: existing, error: lookupError } = await client
    .from("saved_projects")
    .select("project_id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existing) {
    const { error } = await client
      .from("saved_projects")
      .delete()
      .eq("user_id", userId)
      .eq("project_id", projectId);

    if (error) {
      throw new Error(error.message);
    }

    return false;
  }

  const { error } = await client.from("saved_projects").insert({
    user_id: userId,
    project_id: projectId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function toggleUserFollow(followerId: string, followingId: string) {
  const client = await requireSupabase();
  const { data: existing, error: lookupError } = await client
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();

  if (lookupError) {
    if (isMissingRelationError(lookupError.message)) {
      throw new Error("La tabla user_follows aun no existe en Supabase. Ejecuta el bloque SQL de follows.");
    }
    throw new Error(lookupError.message);
  }

  if (existing) {
    const { error } = await client
      .from("user_follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);

    if (error) {
      throw new Error(error.message);
    }

    return false;
  }

  const { error } = await client.from("user_follows").insert({
    follower_id: followerId,
    following_id: followingId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function toggleProjectLike(userId: string, projectId: string) {
  const client = await requireSupabase();
  const { data: existing, error: lookupError } = await client
    .from("project_likes")
    .select("project_id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (lookupError) {
    if (isMissingRelationError(lookupError.message)) {
      throw new Error("La tabla project_likes aun no existe en Supabase. Ejecuta el bloque SQL de likes.");
    }
    throw new Error(lookupError.message);
  }

  if (existing) {
    const { error } = await client
      .from("project_likes")
      .delete()
      .eq("user_id", userId)
      .eq("project_id", projectId);

    if (error) {
      throw new Error(error.message);
    }

    return false;
  }

  const { error } = await client.from("project_likes").insert({
    user_id: userId,
    project_id: projectId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data: projectData } = await client
    .from("projects")
    .select("creator_id, title")
    .eq("id", projectId)
    .maybeSingle();

  if (projectData && projectData.creator_id && projectData.creator_id !== userId) {
    await createNotifications([
      {
        recipient_id: projectData.creator_id as string,
        actor_id: userId,
        project_id: projectId,
        type: "like",
        title: "le dio like a tu proyecto",
        body: `"${projectData.title as string}" recibio un nuevo like.`,
      },
    ]);
  }

  return true;
}

export async function listProjectsByCreator(creatorId: string) {
  if (!isSupabaseConfigured || !supabase) {
    return mockProjects.filter((project) => project.creator.id === creatorId);
  }

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProjectRow[]).map(mapProject);
}

export async function listProjectsByIds(projectIds: string[]) {
  if (projectIds.length === 0) {
    return [];
  }

  if (!isSupabaseConfigured || !supabase) {
    return mockProjects.filter((project) => projectIds.includes(project.id));
  }

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .in("id", projectIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProjectRow[]).map(mapProject);
}

export async function createProject(userId: string, input: ProjectInput) {
  const client = await requireSupabase();
  const imagePath = await uploadToBucket("project-images", userId, input.imageFile);
  const { data: imagePublicData } = client.storage.from("project-images").getPublicUrl(imagePath);

  let projectFilePath: string | null = null;
  if (input.projectFile) {
    projectFilePath = await uploadToBucket("project-files", userId, input.projectFile);
  }

  const { data, error } = await client
    .from("projects")
    .insert({
      creator_id: userId,
      title: input.title,
      description: input.description,
      image_url: imagePublicData.publicUrl,
      category: input.category,
      tags: input.tags,
      project_file_name: input.projectFile?.name ?? null,
      project_file_size: input.projectFile
        ? `${(input.projectFile.size / (1024 * 1024)).toFixed(2)} MB`
        : null,
      project_file_type: input.projectFile?.type || null,
      project_file_path: projectFilePath,
      download_allowed: input.projectFile ? input.allowDownload : false,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const projectId = (data as { id: string }).id;
  const createdProject = await getProject(projectId);
  invalidateProjectsCache();

  const { data: followers } = await client
    .from("user_follows")
    .select("follower_id")
    .eq("following_id", userId);

  const followerNotifications =
    followers?.map((row) => ({
      recipient_id: row.follower_id as string,
      actor_id: userId,
      project_id: projectId,
      type: "new_project",
      title: "publico un proyecto nuevo",
      body: `"${createdProject?.title ?? input.title}" ya esta disponible.`,
    })) ?? [];

  await createNotifications(followerNotifications);

  return createdProject;
}

export async function updateProject(
  projectId: string,
  userId: string,
  input: ProjectUpdateInput,
) {
  if (!isSupabaseConfigured || !supabase) {
    const existing = mockProjects.find((project) => project.id === projectId);
    if (!existing) {
      throw new Error("Project not found.");
    }

    return {
      ...existing,
      title: input.title,
      description: input.description,
      category: input.category,
      tags: input.tags,
      projectFile: existing.projectFile
        ? {
            ...existing.projectFile,
            downloadAllowed: input.allowDownload,
          }
        : undefined,
    };
  }

  const client = await requireSupabase();
  const { error } = await client
    .from("projects")
    .update({
      title: input.title,
      description: input.description,
      category: input.category,
      tags: input.tags,
      download_allowed: input.allowDownload,
    })
    .eq("id", projectId)
    .eq("creator_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  invalidateProjectsCache();
  return getProject(projectId);
}

export async function deleteProject(projectId: string, userId: string, project?: Project | null) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const client = await requireSupabase();
  const projectFilePath = project?.projectFile?.filePath ?? null;
  const imagePath = extractStoragePathFromPublicUrl(project?.image, "project-images");

  if (projectFilePath) {
    void client.storage.from("project-files").remove([projectFilePath]);
  }

  if (imagePath) {
    void client.storage.from("project-images").remove([imagePath]);
  }

  const { error } = await client
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("creator_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  invalidateProjectsCache();
}

export async function getProjectDownloadUrl(filePath: string) {
  const client = await requireSupabase();
  const { data, error } = await client.storage
    .from("project-files")
    .createSignedUrl(filePath, 60);

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("not found")) {
      throw new Error("No se encontro el archivo en Storage.");
    }
    if (message.includes("row-level security") || message.includes("permission")) {
      throw new Error("Storage no permite descargar este archivo todavia. Ejecuta el bloque SQL de project-files.");
    }
    throw new Error(error.message);
  }

  return data.signedUrl;
}
