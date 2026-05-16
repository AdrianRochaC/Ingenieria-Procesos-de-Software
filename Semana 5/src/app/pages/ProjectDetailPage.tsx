import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import type { Comment, Project } from "../utils/mockData";
import { Heart, Bookmark, Share2, Eye, ArrowLeft, Send, Download, Lock, Edit3, Trash2, BarChart3 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { ProjectCard } from "../components/ProjectCard";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { ProjectMetadataFields } from "../components/ProjectMetadataFields";
import { formatProjectCategory, normalizeProjectTags, parseProjectCategory } from "../utils/mockData";
import { useLanguage } from "../context/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  createComment,
  deleteProject,
  getProject,
  getProjectDownloadUrl,
  getLikedCommentIds,
  listComments,
  listProjects,
  recordProjectView,
  toggleCommentLike,
  updateProject,
} from "../lib/projectHubApi";

export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, toggleSave, isSaved, user, toggleFollow, isFollowing, toggleLike, isLiked } = useAuth();
  const { t } = useLanguage();
  const [project, setProject] = useState<Project | null>(null);
  const [relatedProjects, setRelatedProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [likes, setLikes] = useState(0);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [editAllowDownload, setEditAllowDownload] = useState(false);
  const isManageView = location.pathname.endsWith("/manage");
  const recordedViewRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProjectData(projectId: string) {
      try {
        const [projectData, allProjects] = await Promise.all([getProject(projectId), listProjects()]);

        if (!mounted) return;

        setProject(projectData);
        setLikes(projectData?.likes ?? 0);
        setFollowerCount(projectData?.creator.followers ?? 0);
        setRelatedProjects(
          allProjects
            .filter((item) => {
              if (!projectData || item.id === projectData.id) {
                return false;
              }

              return parseProjectCategory(item.category).category === parseProjectCategory(projectData.category).category;
            })
            .slice(0, 4),
        );

        if (projectData) {
          const projectComments = await listComments(projectData.id);
          if (!mounted) return;
          setComments(projectComments);

          if (user?.id) {
            const likedIds = await getLikedCommentIds(
              user.id,
              projectComments.map((comment) => comment.id),
            );
            if (!mounted) return;
            setLikedCommentIds(new Set(likedIds));
          } else {
            setLikedCommentIds(new Set());
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("detail_projectNotFound"));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    if (id) {
      loadProjectData(id);
    } else {
      setIsLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [id, user?.id]);

  useEffect(() => {
    if (!project) return;
    const parsedCategory = parseProjectCategory(project.category);
    setEditTitle(project.title);
    setEditDescription(project.description);
    setEditCategory(parsedCategory.category);
    setEditSubcategory(parsedCategory.subcategory);
    setEditTags(project.tags);
    setEditTagInput("");
    setEditAllowDownload(project.projectFile?.downloadAllowed ?? false);
  }, [project]);

  const handleAddEditTag = () => {
    const nextTag = editTagInput.trim();
    if (!nextTag) return;
    setEditTags((prev) => normalizeProjectTags([...prev, nextTag]));
    setEditTagInput("");
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  useEffect(() => {
    if (!project || !isManageView) return;
    if (user?.id !== project.creator.id) {
      navigate(`/project/${project.id}`, { replace: true });
    }
  }, [isManageView, navigate, project, user?.id]);

  useEffect(() => {
    if (!project || isManageView) return;
    if (recordedViewRef.current === project.id) return;
    if (user?.id === project.creator.id) return;

    recordedViewRef.current = project.id;

    recordProjectView(project.id)
      .then(() => {
        setProject((prev) =>
          prev && prev.id === project.id
            ? {
                ...prev,
                views: (prev.views ?? 0) + 1,
              }
            : prev,
        );
      })
      .catch((error) => {
        recordedViewRef.current = null;
        console.error("Error recording project view", error);
      });
  }, [isManageView, project, user?.id]);

  const requireAuth = async (action: () => void | Promise<void>, label: string) => {
    if (!isLoggedIn) {
      toast(`Sign in to ${label}`, {
        action: { label: "Sign in", onClick: () => navigate("/login") },
        duration: 3000,
      });
      return;
    }

    await action();
  };

  const handleLike = () =>
    requireAuth(async () => {
      if (!project) return;
      const wasLiked = isLiked(project.id);
      const next = !wasLiked;
      setLikes((prev) => (next ? prev + 1 : Math.max(prev - 1, 0)));

      try {
        await toggleLike(project.id);
        toast(next ? t("detail_addedLike") : t("detail_removedLike"), { duration: 2000 });
      } catch (error) {
        setLikes((prev) => (wasLiked ? prev + 1 : Math.max(prev - 1, 0)));
        throw error;
      }
    }, t("detail_signInLikeProjects"));

  const handleSave = () =>
    requireAuth(async () => {
      if (!project) return;
      const nextSaved = await toggleSave(project.id);
      toast(nextSaved ? t("detail_savedCollection") : t("detail_removedCollection"), { duration: 2000 });
    }, t("detail_signInSaveProjects"));

  const handleFollow = () =>
    requireAuth(async () => {
      if (!project || !user) return;
      if (project.creator.id === user.id) {
        navigate(`/project/${project.id}/manage`);
        return;
      }
      const wasFollowing = isFollowing(project.creator.id);
      const nextFollowing = !wasFollowing;
      setFollowerCount((prev) => (nextFollowing ? prev + 1 : Math.max(prev - 1, 0)));

      try {
        await toggleFollow(project.creator.id);
        toast(nextFollowing ? "Ahora sigues a este creador." : "Has dejado de seguir a este creador.", {
          duration: 2000,
        });
      } catch (error) {
        setFollowerCount((prev) => (wasFollowing ? prev + 1 : Math.max(prev - 1, 0)));
        throw error;
      }
    }, t("detail_signInFollowCreators"));

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    toast.success(t("detail_linkCopied"), { duration: 2500 });
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    if (!isLoggedIn) {
      toast(t("detail_signInComment"), {
        action: { label: t("common_signIn"), onClick: () => navigate("/login") },
        duration: 3000,
      });
      return;
    }

    if (!comment.trim() || !user) {
      return;
    }

    try {
      const newComment = await createComment(project.id, user.id, comment.trim());
      setComments((prev) => [newComment, ...prev]);
      setComment("");
      toast.success(t("detail_commentPosted"), { duration: 2000 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("detail_commentError"));
    }
  };

  const handleCommentLike = async (targetComment: Comment) => {
    if (!isLoggedIn || !user) {
      toast(t("detail_signInLikeComments"), {
        action: { label: t("common_signIn"), onClick: () => navigate("/login") },
        duration: 3000,
      });
      return;
    }

    try {
      const wasLiked = likedCommentIds.has(targetComment.id);
      const liked = !wasLiked;

      setLikedCommentIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(targetComment.id);
        else next.delete(targetComment.id);
        return next;
      });
      setComments((prev) =>
        prev.map((commentItem) =>
          commentItem.id === targetComment.id
            ? {
                ...commentItem,
                likes: liked
                  ? commentItem.likes + 1
                  : Math.max(commentItem.likes - 1, 0),
              }
            : commentItem,
        ),
      );

      try {
        await toggleCommentLike(user.id, targetComment.id);
        toast(liked ? t("detail_commentLikeAdded") : t("detail_commentLikeRemoved"), {
          duration: 2000,
        });
      } catch (error) {
        setLikedCommentIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(targetComment.id);
          else next.delete(targetComment.id);
          return next;
        });
        setComments((prev) =>
          prev.map((commentItem) =>
            commentItem.id === targetComment.id
              ? {
                  ...commentItem,
                  likes: wasLiked
                    ? commentItem.likes + 1
                    : Math.max(commentItem.likes - 1, 0),
                }
              : commentItem,
          ),
        );
        throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("detail_commentLikeError"));
    }
  };

  const handleDownload = () =>
    requireAuth(() => {
      if (project?.projectFile?.downloadAllowed) {
        setShowDownloadDialog(true);
      } else {
        setShowPermissionDialog(true);
      }
    }, "download files");

  const confirmDownload = async () => {
    const filePath = project?.projectFile?.filePath;
    if (!filePath) {
      setShowDownloadDialog(false);
      toast.error(t("detail_fileMissing"));
      return;
    }

    try {
      const url = await getProjectDownloadUrl(filePath);
      window.open(url, "_blank", "noopener,noreferrer");
      setShowDownloadDialog(false);
      toast.success(t("detail_downloadStarted"), {
        description: project?.projectFile?.name,
        duration: 3000,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("detail_downloadError"));
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !user) return;
    if (!editCategory.trim() || !editSubcategory.trim()) {
      toast.error(t("home_selectCategorySubcategory"));
      return;
    }

    try {
      setIsSavingProject(true);
      const updated = await updateProject(project.id, user.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: formatProjectCategory(editCategory.trim(), editSubcategory.trim()),
        tags: editTags,
        allowDownload: editAllowDownload,
      });

      setProject(updated);
      setLikes(updated.likes);
      setShowEditDialog(false);
      toast.success(t("detail_projectUpdated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("detail_projectUpdateError"));
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project || !user) return;

    try {
      setIsDeletingProject(true);
      await deleteProject(project.id, user.id, project);
      setShowDeleteDialog(false);
      toast.success(t("detail_projectDeleted"));
      navigate("/profile");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("detail_projectDeleteError"));
    } finally {
      setIsDeletingProject(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t("detail_loadingProject")}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t("detail_projectNotFound")}</p>
      </div>
    );
  }

  const saved = isSaved(project.id);
  const liked = isLiked(project.id);
  const isOwner = user?.id === project.creator.id;
  const shouldShowOwnerDashboard = isOwner && isManageView;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>

            <div className="mb-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={project.creator.avatar} alt={project.creator.name} />
                    <AvatarFallback>{project.creator.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-gray-900">{project.creator.name}</h3>
                    <p className="text-sm text-gray-600">@{project.creator.username}</p>
                  </div>
                </div>

                <Button
                  onClick={handleFollow}
                  className={`rounded-full px-6 ${
                    isOwner
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : isFollowing(project.creator.id)
                        ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {isOwner
                    ? shouldShowOwnerDashboard
                      ? "Project Dashboard"
                      : "Open Dashboard"
                    : isFollowing(project.creator.id)
                      ? `Following (${followerCount})`
                      : `Follow (${followerCount})`}
                </Button>
              </div>

              <h1 className="text-4xl font-bold text-gray-900 mb-4">{project.title}</h1>
              <p className="text-lg text-gray-600 mb-6">{project.description}</p>

              {shouldShowOwnerDashboard && (
                <div className="mb-6 rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 to-purple-50 p-6">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Project Metrics</h2>
                      <p className="text-sm text-gray-600">
                        Esta es tu vista de gestion. Desde aqui puedes revisar rendimiento, comentarios y administrar el proyecto.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => setShowEditDialog(true)}
                        className="rounded-full bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Edit3 className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        onClick={() => setShowDeleteDialog(true)}
                        className="rounded-full bg-red-600 text-white hover:bg-red-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center gap-2 text-gray-500">
                        <Heart className="h-4 w-4" />
                        <span className="text-sm">Likes</span>
                      </div>
                      <p className="text-2xl font-semibold text-gray-900">{likes.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center gap-2 text-gray-500">
                        <Bookmark className="h-4 w-4" />
                        <span className="text-sm">Saves</span>
                      </div>
                      <p className="text-2xl font-semibold text-gray-900">{project.saves.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center gap-2 text-gray-500">
                        <Eye className="h-4 w-4" />
                        <span className="text-sm">Views</span>
                      </div>
                      <p className="text-2xl font-semibold text-gray-900">{(project.views ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center gap-2 text-gray-500">
                        <BarChart3 className="h-4 w-4" />
                        <span className="text-sm">Comments</span>
                      </div>
                      <p className="text-2xl font-semibold text-gray-900">{comments.length.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6 mb-6 flex-wrap">
                {!shouldShowOwnerDashboard && (
                  <>
                    <button
                      onClick={handleLike}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                        liked && isLoggedIn
                          ? "bg-red-50 text-red-600"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${liked && isLoggedIn ? "fill-red-600" : ""}`} />
                      <span>{likes.toLocaleString()}</span>
                    </button>

                    <button
                      onClick={handleSave}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                        saved && isLoggedIn
                          ? "bg-blue-50 text-blue-600"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <Bookmark className={`w-5 h-5 ${saved && isLoggedIn ? "fill-blue-600" : ""}`} />
                      <span>Save</span>
                    </button>
                  </>
                )}

                {project.projectFile && (
                  <button
                    onClick={handleDownload}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                      project.projectFile.downloadAllowed
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {project.projectFile.downloadAllowed ? (
                      <Download className="w-5 h-5" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                    <span>Download Project</span>
                  </button>
                )}

                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <Share2 className="w-5 h-5" />
                  <span>Share</span>
                </button>

                <div className="flex items-center gap-2 text-gray-600 ml-auto">
                  <Eye className="w-5 h-5" />
                  <span>{project.views?.toLocaleString()} views</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-8">
                {project.tags.map((tag) => (
                  <span key={tag} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl overflow-hidden shadow-2xl mb-12">
              <img src={project.image} alt={project.title} className="w-full object-cover" />
            </div>

            <div className="mb-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Comments ({comments.length})</h2>

              <form onSubmit={handleComment} className="mb-8">
                <div className="flex gap-4">
                  {isLoggedIn ? (
                    <div className="w-10 h-10 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {user?.name[0] ?? "U"}
                    </div>
                  ) : (
                    <div className="w-10 h-10 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1">
                    {isLoggedIn ? (
                      <>
                        <Textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Share your thoughts..."
                          className="resize-none border-gray-200 rounded-xl mb-3"
                          rows={3}
                        />
                        <Button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center gap-2"
                          disabled={!comment.trim()}
                        >
                          <Send className="w-4 h-4" />
                          <span>Post Comment</span>
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <p className="text-sm text-gray-600 flex-1">Sign in to join the conversation</p>
                        <Button
                          type="button"
                          onClick={() => navigate("/login")}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 text-sm"
                        >
                          Sign in
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </form>

              <div className="space-y-6">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-4">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src={c.user.avatar} alt={c.user.name} />
                      <AvatarFallback>{c.user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="bg-gray-50 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-900">{c.user.name}</span>
                          <span className="text-sm text-gray-500">
                            {new Date(c.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-gray-700">{c.content}</p>
                      </div>
                      <button
                        onClick={() => handleCommentLike(c)}
                        className={`mt-2 flex items-center gap-1 text-sm transition-colors ${
                          likedCommentIds.has(c.id)
                            ? "text-red-600"
                            : "text-gray-600 hover:text-red-600"
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${likedCommentIds.has(c.id) ? "fill-red-600" : ""}`} />
                        <span>{c.likes}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {relatedProjects.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Related Projects</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {relatedProjects.map((relatedProject) => (
                    <ProjectCard
                      key={relatedProject.id}
                      project={relatedProject}
                      ownerMode={user?.id === relatedProject.creator.id}
                      onEdit={() => navigate(`/project/${relatedProject.id}/manage`)}
                      onDelete={() => navigate(`/project/${relatedProject.id}/manage`)}
                      onClick={() =>
                        navigate(
                          user?.id === relatedProject.creator.id
                            ? `/project/${relatedProject.id}/manage`
                            : `/project/${relatedProject.id}`,
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar proyecto</DialogTitle>
            <DialogDescription>
              Cambia la informacion principal del proyecto. La portada y los archivos se mantienen igual.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateProject} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-gray-700">Titulo</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-700">Descripcion</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={5}
                required
              />
            </div>

            <ProjectMetadataFields
              category={editCategory}
              subcategory={editSubcategory}
              tags={editTags}
              tagInput={editTagInput}
              onCategoryChange={(value) => {
                setEditCategory(value);
                setEditSubcategory("");
              }}
              onSubcategoryChange={setEditSubcategory}
              onTagInputChange={setEditTagInput}
              onAddTag={handleAddEditTag}
              onRemoveTag={handleRemoveEditTag}
            />

            {project.projectFile && (
              <label className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editAllowDownload}
                  onChange={(e) => setEditAllowDownload(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Permitir descargas del archivo del proyecto
              </label>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)} className="rounded-full">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSavingProject || !editCategory || !editSubcategory}
                className="rounded-full bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSavingProject ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proyecto</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara el proyecto, sus comentarios, likes y saves asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="rounded-full bg-red-600 text-white hover:bg-red-700"
            >
              {isDeletingProject ? `${t("common_delete")}...` : t("common_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("detail_downloadDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("detail_downloadDialogDesc", { name: project.creator.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl border border-purple-200">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Download className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{project.projectFile?.name}</p>
                <p className="text-sm text-gray-600">
                  {project.projectFile?.type} • {project.projectFile?.size}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              {t("detail_downloadResponsibly")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadDialog(false)} className="rounded-full">
              {t("common_cancel")}
            </Button>
            <Button
              onClick={confirmDownload}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:shadow-lg"
            >
              <Download className="w-4 h-4 mr-2" />
              {t("common_download")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("detail_downloadNotAllowed")}</DialogTitle>
            <DialogDescription>
              {t("detail_downloadNotAllowedDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Lock className="w-6 h-6 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{project.projectFile?.name}</p>
                <p className="text-sm text-gray-600">
                  {project.projectFile?.type} • {project.projectFile?.size}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              {t("detail_downloadNotAllowedBody", { name: project.creator.name })}
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowPermissionDialog(false)}
              className="bg-gray-900 text-white rounded-full hover:bg-gray-800 w-full"
            >
              {t("detail_gotIt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
