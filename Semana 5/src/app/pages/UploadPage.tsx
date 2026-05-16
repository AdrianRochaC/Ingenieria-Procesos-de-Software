import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Upload, X, Image as ImageIcon, FileUp, File, LogIn } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { createProject } from "../lib/projectHubApi";
import { isSupabaseConfigured } from "../lib/supabase";
import { ProjectMetadataFields } from "../components/ProjectMetadataFields";
import { formatProjectCategory, normalizeProjectTags } from "../utils/mockData";
import { useLanguage } from "../context/LanguageContext";

export function UploadPage() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [allowDownload, setAllowDownload] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag) return;
    setTags((prev) => normalizeProjectTags([...prev, nextTag]));
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProjectFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProjectFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !coverImage) {
      toast.error(t("upload_needSignInImage"));
      return;
    }

    try {
      setIsSubmitting(true);

      if (!isSupabaseConfigured) {
        toast(t("upload_supabaseMissing"), {
          duration: 4000,
        });
        return;
      }

      const created = await createProject(user.id, {
        title,
        description,
        category: formatProjectCategory(selectedCategory, selectedSubcategory),
        tags,
        allowDownload,
        imageFile: coverImage,
        projectFile,
      });

      toast.success(t("upload_published"), {
        description: created ? `"${created.title}" is now live on ProjectHub` : `"${title}" is now live on ProjectHub`,
        duration: 4000,
      });
      navigate("/home");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to publish the project.");
    } finally {
      setIsSubmitting(false);
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
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{t("upload_signInTitle")}</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              {t("upload_signInDesc")}
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

      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("upload_title")}</h1>
              <p className="text-gray-600">{t("upload_subtitle")}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
                <label className="block mb-4 text-sm font-medium text-gray-900">
                  {t("upload_projectImage")}
                </label>

                {!selectedFile ? (
                  <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gradient-to-br from-gray-50 to-blue-50/30 hover:border-blue-400 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                        <Upload className="w-8 h-8 text-blue-600" />
                      </div>
                      <p className="mb-2 text-sm text-gray-700">
                        <span className="font-semibold">{t("upload_clickUpload")}</span> {t("upload_orDrag")}
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageSelect}
                    />
                  </label>
                ) : (
                  <div className="relative">
                    <img
                      src={selectedFile}
                      alt="Preview"
                      className="w-full h-96 object-cover rounded-2xl"
                    />
                    <button
                      type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setCoverImage(null);
                    }}
                      className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-700" />
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm space-y-6">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-900">
                    {t("upload_titleLabel")}
                  </label>
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("upload_titlePlaceholder")}
                    className="h-12 bg-gray-50 border-gray-200 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-900">
                    {t("upload_descriptionLabel")}
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("upload_descriptionPlaceholder")}
                    className="resize-none bg-gray-50 border-gray-200 rounded-xl"
                    rows={5}
                    required
                  />
                </div>

                <ProjectMetadataFields
                  category={selectedCategory}
                  subcategory={selectedSubcategory}
                  tags={tags}
                  tagInput={tagInput}
                  onCategoryChange={(value) => {
                    setSelectedCategory(value);
                    setSelectedSubcategory("");
                  }}
                  onSubcategoryChange={setSelectedSubcategory}
                  onTagInputChange={setTagInput}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                />

                <div>
                  <label className="block mb-3 text-sm font-medium text-gray-900">
                    {t("upload_filesLabel")}
                  </label>

                  {!projectFile ? (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:border-blue-400 transition-all group">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-200 transition-colors">
                          <FileUp className="w-6 h-6 text-purple-600" />
                        </div>
                        <p className="text-sm text-gray-700 mb-1">
                          {t("upload_filesDesc")}
                        </p>
                        <p className="text-xs text-gray-500">{t("upload_filesSubdesc")}</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleProjectFileSelect}
                      />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <File className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{projectFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(projectFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProjectFile(null)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  )}

                  {projectFile && (
                    <div className="mt-4 flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <input
                        type="checkbox"
                        id="allowDownload"
                        checked={allowDownload}
                        onChange={(e) => setAllowDownload(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="allowDownload" className="text-sm text-gray-700">
                        {t("upload_allowDownloads")}
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  onClick={() => navigate(-1)}
                  variant="outline"
                  className="px-8 h-12 rounded-full border-gray-300"
                >
                  {t("upload_cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={!selectedFile || !title || !description || !selectedCategory || !selectedSubcategory}
                  aria-busy={isSubmitting}
                  className="px-8 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <ImageIcon className="w-5 h-5" />
                  <span>{isSubmitting ? t("upload_publishing") : t("upload_publish")}</span>
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
