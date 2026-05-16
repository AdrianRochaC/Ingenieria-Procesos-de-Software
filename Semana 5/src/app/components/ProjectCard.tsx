import { Heart, Bookmark, Pencil, Trash2 } from "lucide-react";
import type { Project } from "../utils/mockData";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { useLanguage } from "../context/LanguageContext";

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  ownerMode?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ProjectCard({
  project,
  onClick,
  ownerMode = false,
  onEdit,
  onDelete,
}: ProjectCardProps) {
  const { isLoggedIn, isSaved, toggleSave, isLiked, toggleLike } = useAuth();
  const { t } = useLanguage();
  const [likes, setLikes] = useState(project.likes);

  useEffect(() => {
    setLikes(project.likes);
  }, [project.likes]);

  const liked = isLiked(project.id);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      toast(t("detail_signInLikeProjects"), { duration: 2500 });
      return;
    }

    try {
      const nextLiked = await toggleLike(project.id);
      setLikes((prev) => (nextLiked ? prev + 1 : Math.max(prev - 1, 0)));
      toast(nextLiked ? t("detail_addedLike") : t("detail_removedLike"), { duration: 2000 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("detail_projectUpdateError"));
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      toast(t("detail_signInSaveProjects"), { duration: 2500 });
      return;
    }

    try {
      const saved = await toggleSave(project.id);
      toast(saved ? t("detail_savedCollection") : t("detail_removedCollection"), { duration: 2000 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("detail_projectUpdateError"));
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className="group cursor-pointer break-inside-avoid mb-6"
    >
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-border/50">
        <div className="relative overflow-hidden">
          <img
            src={project.image}
            alt={project.title}
            className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {ownerMode ? (
              <>
                <button
                  onClick={handleEdit}
                  className="p-2.5 bg-white/95 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-lg"
                  title={t("common_edit")}
                >
                  <Pencil className="w-4 h-4 text-gray-700" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2.5 bg-white/95 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-lg"
                  title={t("common_delete")}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleLike}
                  className="p-2.5 bg-white/95 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-lg"
                >
                  <Heart
                    className={`w-4 h-4 transition-colors ${
                      liked ? "fill-red-500 text-red-500" : "text-gray-700"
                    }`}
                  />
                </button>
                <button
                  onClick={handleSave}
                  className="p-2.5 bg-white/95 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-lg"
                >
                  <Bookmark
                    className={`w-4 h-4 transition-colors ${
                      isSaved(project.id) ? "fill-blue-600 text-blue-600" : "text-gray-700"
                    }`}
                  />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-medium text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {project.title}
          </h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={project.creator.avatar} alt={project.creator.name} />
                <AvatarFallback>{project.creator.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-gray-600">{project.creator.name}</span>
            </div>

            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Heart className="w-4 h-4" />
              <span>{likes.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
