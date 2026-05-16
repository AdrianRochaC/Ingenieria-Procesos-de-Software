import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { ProjectCard } from "../components/ProjectCard";
import type { Project } from "../utils/mockData";
import { Button } from "../components/ui/button";
import { Settings, MapPin, Link as LinkIcon, Calendar, Bookmark, LogIn } from "lucide-react";
import Masonry from "react-responsive-masonry";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { deleteProject, listProjectsByCreator, listProjectsByIds, updateProject } from "../lib/projectHubApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { ProjectMetadataFields } from "../components/ProjectMetadataFields";
import { formatProjectCategory, normalizeProjectTags, parseProjectCategory } from "../utils/mockData";
import { useLanguage } from "../context/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

export function ProfilePage() {
  const navigate = useNavigate();
  const { isLoggedIn, savedIds, user, saveProfile } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"published" | "saved">("published");
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [editAllowDownload, setEditAllowDownload] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.name);
    setUsername(user.username);
    setBio(user.bio || "");
    setLocation(user.location || "");
    setWebsite(user.website || "");
  }, [user]);

  useEffect(() => {
    let mounted = true;

    async function loadProfileData() {
      if (!user) {
        if (mounted) {
          setMyProjects([]);
          setSavedProjects([]);
          setIsLoading(false);
        }
        return;
      }

      try {
        const [published, saved] = await Promise.all([
          listProjectsByCreator(user.id),
          listProjectsByIds(Array.from(savedIds)),
        ]);

        if (!mounted) return;

        setMyProjects(published);
        setSavedProjects(saved);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    setIsLoading(true);
    loadProfileData();

    return () => {
      mounted = false;
    };
  }, [savedIds, user]);

  const displayProjects = activeTab === "published" ? myProjects : savedProjects;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingProfile(true);
      await saveProfile({
        fullName,
        username,
        bio,
        location,
        website,
      });
      toast.success(t("profile_updated"));
      setIsEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("profile_updateError"));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const openProject = (project: Project) => {
    if (user?.id === project.creator.id) {
      navigate(`/project/${project.id}/manage`);
      return;
    }

    navigate(`/project/${project.id}`);
  };

  const openEditProjectDialog = (project: Project) => {
    const parsedCategory = parseProjectCategory(project.category);
    setProjectToEdit(project);
    setEditTitle(project.title);
    setEditDescription(project.description);
    setEditCategory(parsedCategory.category);
    setEditSubcategory(parsedCategory.subcategory);
    setEditTags(project.tags);
    setEditTagInput("");
    setEditAllowDownload(project.projectFile?.downloadAllowed ?? false);
  };

  const handleAddEditTag = () => {
    const nextTag = editTagInput.trim();
    if (!nextTag) return;
    setEditTags((prev) => normalizeProjectTags([...prev, nextTag]));
    setEditTagInput("");
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete || !user) return;

    try {
      setIsDeletingProject(true);
      await deleteProject(projectToDelete.id, user.id, projectToDelete);
      setMyProjects((prev) => prev.filter((project) => project.id !== projectToDelete.id));
      setSavedProjects((prev) => prev.filter((project) => project.id !== projectToDelete.id));
      setProjectToDelete(null);
      toast.success(t("home_projectDeleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("home_deleteProjectError"));
    } finally {
      setIsDeletingProject(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToEdit || !user) return;
    if (!editCategory.trim() || !editSubcategory.trim()) {
      toast.error(t("home_selectCategorySubcategory"));
      return;
    }

    try {
      setIsSavingProject(true);
      const updated = await updateProject(projectToEdit.id, user.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: formatProjectCategory(editCategory.trim(), editSubcategory.trim()),
        tags: editTags,
        allowDownload: editAllowDownload,
      });

      setMyProjects((prev) => prev.map((project) => (project.id === updated.id ? updated : project)));
      setSavedProjects((prev) => prev.map((project) => (project.id === updated.id ? updated : project)));
      setProjectToEdit(null);
      toast.success(t("home_projectUpdated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("home_updateProjectError"));
    } finally {
      setIsSavingProject(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
        <Navbar />
        <div className="pt-32 flex flex-col items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-sm"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mx-auto mb-6">
              <LogIn className="w-9 h-9 text-purple-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{t("profile_signInTitle")}</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              {t("profile_signInDesc")}
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full px-8 h-11"
            >
              {t("common_signIn")}
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <Navbar />

      <div className="pt-20 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-white rounded-3xl p-8 sm:p-12 mb-8 border border-gray-200 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold shadow-xl border-4 border-white">
                  {user?.name[0] ?? "U"}
                </div>

                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-1">{user?.name}</h1>
                  <p className="text-gray-600 mb-3">@{user?.username}</p>
                  <p className="text-gray-700 max-w-2xl">{user?.bio || t("profile_bioFallback")}</p>
                </div>

                <Button
                  onClick={() => setIsEditOpen(true)}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-full px-6"
                >
                  <Settings className="w-4 h-4" />
                  <span>{t("profile_editProfile")}</span>
                </Button>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{user?.location || t("profile_addLocation")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  <a
                    href={user?.website || "#"}
                    target={user?.website ? "_blank" : undefined}
                    rel={user?.website ? "noreferrer noopener" : undefined}
                    className="text-blue-600 hover:underline"
                  >
                    {user?.website?.replace(/^https?:\/\//, "") || t("profile_addWebsite")}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {t("profile_joined")}{" "}
                    {user?.joinedAt
                      ? new Date(user.joinedAt).toLocaleDateString(language === "es" ? "es-CO" : "en-US", {
                          month: "long",
                          year: "numeric",
                        })
                      : t("profile_recently")}
                  </span>
                </div>
              </div>

              <div className="flex gap-8">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {user?.followers?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-sm text-gray-600">{t("profile_followers")}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {user?.following?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-sm text-gray-600">{t("profile_following")}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{myProjects.length}</div>
                  <div className="text-sm text-gray-600">{t("profile_projectsCount")}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{savedIds.size}</div>
                  <div className="text-sm text-gray-600">{t("profile_savedCount")}</div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex gap-4 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab("published")}
                  className={`px-6 py-3 font-medium transition-all relative ${
                    activeTab === "published"
                      ? "text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {t("profile_publishedTab")}
                  {activeTab === "published" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("saved")}
                  className={`px-6 py-3 font-medium transition-all relative flex items-center gap-2 ${
                    activeTab === "saved" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  {t("profile_savedTab")}
                  {savedIds.size > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-600 rounded-full px-2 py-0.5">
                      {savedIds.size}
                    </span>
                  )}
                  {activeTab === "saved" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600" />
                  )}
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-200">
                <p className="text-gray-500">{t("profile_loadingProjects")}</p>
              </div>
            ) : displayProjects.length > 0 ? (
              <Masonry columnsCount={3} gutter="24px" className="profile-masonry">
                {displayProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    ownerMode={user?.id === project.creator.id}
                    onEdit={() => openEditProjectDialog(project)}
                    onDelete={() => setProjectToDelete(project)}
                    onClick={() => openProject(project)}
                  />
                ))}
              </Masonry>
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-200">
                {activeTab === "published" ? (
                  <>
                    <p className="text-gray-500 mb-4">{t("profile_noProjects")}</p>
                    <Button
                      onClick={() => navigate("/upload")}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full px-6"
                    >
                      {t("profile_uploadFirst")}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                      <Bookmark className="w-7 h-7 text-blue-400" />
                    </div>
                    <p className="text-gray-700 font-medium mb-2">{t("profile_noSavedProjects")}</p>
                    <p className="text-sm text-gray-500 mb-6 max-w-xs">
                      {t("profile_savedHelp")}
                    </p>
                    <Button
                      onClick={() => navigate("/home")}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full px-6"
                    >
                      {t("profile_exploreProjects")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .profile-masonry {
            column-count: 2 !important;
          }
        }
        @media (max-width: 640px) {
          .profile-masonry {
            column-count: 1 !important;
          }
        }
      `}</style>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("profile_editDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("profile_editDialogDesc")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">{t("profile_fullName")}</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">{t("profile_username")}</label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">{t("profile_bio")}</label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder={t("profile_bioPlaceholder")}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">{t("profile_location")}</label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("profile_locationPlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">{t("profile_website")}</label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder={t("profile_websitePlaceholder")}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="rounded-full"
              >
                {t("common_cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSavingProfile}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full"
              >
                {isSavingProfile ? `${t("common_saveChanges")}...` : t("common_saveChanges")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(projectToEdit)} onOpenChange={(open) => !open && setProjectToEdit(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("home_editProject")}</DialogTitle>
            <DialogDescription>
              {t("profile_editProjectDesc")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateProject} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-700 mb-2">{t("upload_titleLabel")}</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">{t("upload_descriptionLabel")}</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={5} required />
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

            {projectToEdit?.projectFile && (
              <label className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editAllowDownload}
                  onChange={(e) => setEditAllowDownload(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {t("detail_allowDownloads")}
              </label>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProjectToEdit(null)} className="rounded-full">
                {t("common_cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSavingProject || !editCategory || !editSubcategory}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full"
              >
                {isSavingProject ? `${t("common_saveChanges")}...` : t("common_saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(projectToDelete)} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("home_deleteProject")}</AlertDialogTitle>
            <AlertDescription>
              {t("home_deleteProjectDesc", { title: projectToDelete?.title ?? "" })}
            </AlertDescription>
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
    </div>
  );
}
