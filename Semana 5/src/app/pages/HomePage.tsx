import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { ProjectCard } from "../components/ProjectCard";
import type { Project } from "../utils/mockData";
import Masonry from "react-responsive-masonry";
import { motion } from "motion/react";
import { TrendingUp } from "lucide-react";
import { deleteProject, getCategories, listProjects, updateProject } from "../lib/projectHubApi";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { ProjectMetadataFields } from "../components/ProjectMetadataFields";
import { formatProjectCategory, getCategoryLabel, normalizeProjectTags, parseProjectCategory } from "../utils/mockData";
import { useLanguage } from "../context/LanguageContext";
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

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
    let mounted = true;
    listProjects()
      .then((items) => {
        if (mounted) {
          setProjects(items);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const visibleProjects = user
    ? projects.filter((project) => project.creator.id !== user.id)
    : projects;

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredProjects = visibleProjects.filter((project) => {
    const parsedCategory = parseProjectCategory(project.category);
    const matchesCategory =
      selectedCategory === "All" || parsedCategory.category === selectedCategory;

    const matchesSearch =
      normalizedQuery.length === 0 ||
      project.title.toLowerCase().includes(normalizedQuery) ||
      project.creator.name.toLowerCase().includes(normalizedQuery) ||
      project.creator.username.toLowerCase().includes(normalizedQuery) ||
      parsedCategory.subcategory.toLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });

  const openProject = (project: Project) => {
    if (user?.id === project.creator.id) {
      navigate(`/project/${project.id}/manage`);
      return;
    }

    navigate(`/project/${project.id}`);
  };

  const openEditDialog = (project: Project) => {
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
      setIsDeleting(true);
      await deleteProject(projectToDelete.id, user.id, projectToDelete);
      setProjects((prev) => prev.filter((project) => project.id !== projectToDelete.id));
      setProjectToDelete(null);
      toast.success(t("home_projectDeleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("home_deleteProjectError"));
    } finally {
      setIsDeleting(false);
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

      setProjects((prev) => prev.map((project) => (project.id === updated.id ? updated : project)));
      setProjectToEdit(null);
      toast.success(t("home_projectUpdated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("home_updateProjectError"));
    } finally {
      setIsSavingProject(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              <h1 className="text-2xl font-semibold text-gray-900">{t("home_discoverTitle")}</h1>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {getCategories().map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-5 py-2.5 rounded-full whitespace-nowrap transition-all ${
                    selectedCategory === category
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-purple-200"
                      : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                  }`}
                >
                  {category === "All" ? t("common_all") : getCategoryLabel(category, language)}
                </button>
              ))}
            </div>
          </motion.div>

          {isLoading ? (
            <div className="text-center py-20">
              <p className="text-gray-500">{t("common_loading")}</p>
            </div>
          ) : (
            <Masonry columnsCount={4} gutter="24px" className="masonry-grid">
              {filteredProjects.map((project) => {
                const isOwner = user?.id === project.creator.id;

                return (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    ownerMode={isOwner}
                    onEdit={() => openEditDialog(project)}
                    onDelete={() => setProjectToDelete(project)}
                    onClick={() => openProject(project)}
                  />
                );
              })}
            </Masonry>
          )}

          {filteredProjects.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-500">
                {searchQuery.trim()
                  ? t("home_noSearchResults")
                  : t("home_noCategoryResults")}
              </p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(projectToDelete)} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("home_deleteProject")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("home_deleteProjectDesc", { title: projectToDelete?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="rounded-full bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? `${t("common_delete")}...` : t("common_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(projectToEdit)} onOpenChange={(open) => !open && setProjectToEdit(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("home_editProject")}</DialogTitle>
            <DialogDescription>
              {t("home_editProjectDesc")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateProject} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-gray-700">{t("upload_titleLabel")}</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-700">{t("upload_descriptionLabel")}</label>
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
                className="rounded-full bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSavingProject ? `${t("common_saveChanges")}...` : t("common_saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @media (max-width: 1280px) {
          .masonry-grid {
            column-count: 3 !important;
          }
        }
        @media (max-width: 1024px) {
          .masonry-grid {
            column-count: 2 !important;
          }
        }
        @media (max-width: 640px) {
          .masonry-grid {
            column-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
