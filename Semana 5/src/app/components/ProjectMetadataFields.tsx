import { Plus, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { getCategories, getSubcategories } from "../lib/projectHubApi";
import { useLanguage } from "../context/LanguageContext";
import { getCategoryLabel, getSubcategoryLabel } from "../utils/mockData";

type ProjectMetadataFieldsProps = {
  category: string;
  subcategory: string;
  tags: string[];
  tagInput: string;
  onCategoryChange: (value: string) => void;
  onSubcategoryChange: (value: string) => void;
  onTagInputChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (value: string) => void;
};

export function ProjectMetadataFields({
  category,
  subcategory,
  tags,
  tagInput,
  onCategoryChange,
  onSubcategoryChange,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
}: ProjectMetadataFieldsProps) {
  const { t, language } = useLanguage();
  const rootCategories = getCategories().filter((item) => item !== "All");
  const subcategories = category ? getSubcategories(category) : [];

  return (
    <>
      <div className="space-y-4">
        <div>
          <label className="block mb-3 text-sm font-medium text-gray-900">
            {t("projectMeta_category")}
          </label>
          <div className="flex flex-wrap gap-3">
            {rootCategories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onCategoryChange(item)}
                className={`px-5 py-2.5 rounded-full transition-all ${
                  category === item
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                }`}
              >
                {getCategoryLabel(item, language)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block mb-3 text-sm font-medium text-gray-900">
            {t("projectMeta_subcategory")}
          </label>
          <div className="flex flex-wrap gap-3">
            {subcategories.length > 0 ? (
              subcategories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onSubcategoryChange(item)}
                  className={`px-4 py-2 rounded-full transition-all ${
                    subcategory === item
                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                      : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                  }`}
                >
                  {getSubcategoryLabel(item, language)}
                </button>
              ))
            ) : (
              <p className="text-sm text-gray-500">{t("projectMeta_chooseCategoryFirst")}</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="block mb-2 text-sm font-medium text-gray-900">
          {t("projectMeta_tags")}
        </label>
        <div className="flex gap-3">
          <Input
            type="text"
            value={tagInput}
            onChange={(e) => onTagInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddTag();
              }
            }}
            placeholder={t("projectMeta_tagPlaceholder")}
            className="h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
          <Button
            type="button"
            onClick={onAddTag}
            className="h-12 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 text-white"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm text-purple-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  className="rounded-full p-0.5 hover:bg-purple-100"
                  aria-label={`Eliminar tag ${tag}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 mt-2">
          {t("projectMeta_tagHelp")}
        </p>
      </div>
    </>
  );
}
