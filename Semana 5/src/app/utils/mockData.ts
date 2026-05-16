// Mock data for ProjectHub
import type { Language } from "../lib/i18n";

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  email?: string;
  bio?: string;
  location?: string;
  website?: string;
  joinedAt?: string;
  followers?: number;
  following?: number;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  image: string;
  creator: User;
  category: string;
  tags: string[];
  likes: number;
  saves: number;
  isLiked?: boolean;
  isSaved?: boolean;
  createdAt: Date;
  views?: number;
  projectFile?: {
    name: string;
    size: string;
    type: string;
    downloadAllowed: boolean;
    filePath?: string;
  };
}

export interface Comment {
  id: string;
  user: User;
  content: string;
  createdAt: Date;
  likes: number;
}

export const projectCategoryGroups = {
  "Diseno": [
    "Logos",
    "Branding",
    "Fondos",
    "Ilustraciones",
    "Recursos graficos",
  ],
  "Mockups": [
    "Aplicacion movil",
    "Sitio web",
    "Landing page",
    "Dashboard",
    "Redes sociales",
  ],
  "Proyectos": [
    "Aplicacion web",
    "Pagina web",
    "Aplicacion movil",
    "App de escritorio",
    "E-commerce",
    "SaaS",
    "Portfolio",
  ],
} as const;

const categoryLabels: Record<ProjectCategory, Record<Language, string>> = {
  Diseno: { es: "Diseño", en: "Design" },
  Mockups: { es: "Mockups", en: "Mockups" },
  Proyectos: { es: "Proyectos", en: "Projects" },
};

const subcategoryLabels: Record<string, Record<Language, string>> = {
  Logos: { es: "Logos", en: "Logos" },
  Branding: { es: "Branding", en: "Branding" },
  Fondos: { es: "Fondos", en: "Backgrounds" },
  Ilustraciones: { es: "Ilustraciones", en: "Illustrations" },
  "Recursos graficos": { es: "Recursos graficos", en: "Graphic assets" },
  "Aplicacion movil": { es: "Aplicacion movil", en: "Mobile app" },
  "Sitio web": { es: "Sitio web", en: "Website" },
  "Landing page": { es: "Landing page", en: "Landing page" },
  Dashboard: { es: "Dashboard", en: "Dashboard" },
  "Redes sociales": { es: "Redes sociales", en: "Social media" },
  "Aplicacion web": { es: "Aplicacion web", en: "Web application" },
  "Pagina web": { es: "Pagina web", en: "Web page" },
  "App de escritorio": { es: "App de escritorio", en: "Desktop app" },
  "E-commerce": { es: "E-commerce", en: "E-commerce" },
  SaaS: { es: "SaaS", en: "SaaS" },
  Portfolio: { es: "Portfolio", en: "Portfolio" },
};

export type ProjectCategory = keyof typeof projectCategoryGroups;

export function formatProjectCategory(category: string, subcategory?: string) {
  return subcategory ? `${category} / ${subcategory}` : category;
}

export function parseProjectCategory(value: string) {
  const [category, subcategory] = value.split(" / ").map((part) => part.trim());
  return {
    category: category || value,
    subcategory: subcategory || "",
  };
}

export function getSubcategoriesForCategory(category: string) {
  return projectCategoryGroups[category as ProjectCategory] ?? [];
}

export function normalizeProjectTags(tags: string[]) {
  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, values) => values.findIndex((value) => value.toLowerCase() === tag.toLowerCase()) === index);
}

export function getCategoryLabel(category: string, language: Language) {
  return categoryLabels[category as ProjectCategory]?.[language] ?? category;
}

export function getSubcategoryLabel(subcategory: string, language: Language) {
  return subcategoryLabels[subcategory]?.[language] ?? subcategory;
}

export function getProjectCategoryDisplay(value: string, language: Language) {
  const parsed = parseProjectCategory(value);
  const category = getCategoryLabel(parsed.category, language);
  const subcategory = parsed.subcategory ? getSubcategoryLabel(parsed.subcategory, language) : "";
  return subcategory ? `${category} / ${subcategory}` : category;
}

export const currentUser: User = {
  id: "current-user",
  name: "Sarah Anderson",
  username: "sarahdesigns",
  avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
  email: "sarah@example.com",
  bio: "Product Designer & Creative Developer. Building beautiful digital experiences.",
  location: "San Francisco, CA",
  website: "https://sarahdesigns.com",
  joinedAt: "2024-03-01T00:00:00.000Z",
  followers: 2840,
  following: 483,
};

export const categories = [
  "All",
  ...Object.keys(projectCategoryGroups),
];

export const mockUsers: User[] = [
  {
    id: "1",
    name: "Alex Chen",
    username: "alexcreates",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
  },
  {
    id: "2",
    name: "Maria Garcia",
    username: "mariag",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop",
  },
  {
    id: "3",
    name: "James Wilson",
    username: "jwilson",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop",
  },
  {
    id: "4",
    name: "Emma Thompson",
    username: "emmadt",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop",
  },
  {
    id: "5",
    name: "David Kim",
    username: "davidk",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop",
  },
];

export const mockProjects: Project[] = [
  {
    id: "1",
    title: "Modern Banking App Redesign",
    description: "A fresh take on mobile banking with focus on user experience and accessibility. Clean interface with intuitive navigation.",
    image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=1000&fit=crop",
    creator: mockUsers[0],
    category: formatProjectCategory("Mockups", "Aplicacion movil"),
    tags: ["UI Design", "Mobile", "Fintech"],
    likes: 1247,
    saves: 523,
    createdAt: new Date("2026-05-10"),
    views: 8432,
    projectFile: {
      name: "banking-app-design.fig",
      size: "24.5 MB",
      type: "Figma",
      downloadAllowed: true,
    },
  },
  {
    id: "2",
    title: "Minimalist Portfolio Website",
    description: "Clean and elegant portfolio showcasing creative work with smooth animations and transitions.",
    image: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800&h=600&fit=crop",
    creator: mockUsers[1],
    category: formatProjectCategory("Proyectos", "Pagina web"),
    tags: ["Portfolio", "Minimal", "Animation"],
    likes: 892,
    saves: 341,
    createdAt: new Date("2026-05-09"),
    views: 5234,
    projectFile: {
      name: "portfolio-template.zip",
      size: "12.8 MB",
      type: "HTML/CSS/JS",
      downloadAllowed: false,
    },
  },
  {
    id: "3",
    title: "Eco-Friendly Brand Identity",
    description: "Complete brand identity for sustainable fashion startup. Natural colors, organic shapes.",
    image: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&h=800&fit=crop",
    creator: mockUsers[2],
    category: formatProjectCategory("Diseno", "Branding"),
    tags: ["Branding", "Identity", "Sustainability"],
    likes: 1456,
    saves: 687,
    createdAt: new Date("2026-05-08"),
    views: 9821,
  },
  {
    id: "4",
    title: "Abstract 3D Composition",
    description: "Experimental 3D artwork exploring form, light, and color. Created with Blender and Cinema 4D.",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=700&h=900&fit=crop",
    creator: mockUsers[3],
    category: formatProjectCategory("Diseno", "Recursos graficos"),
    tags: ["3D", "Abstract", "Digital Art"],
    likes: 2103,
    saves: 934,
    createdAt: new Date("2026-05-12"),
    views: 12453,
  },
  {
    id: "5",
    title: "Food Delivery App UI Kit",
    description: "Complete UI kit for food delivery applications. 50+ screens with components and design system.",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=1000&fit=crop",
    creator: mockUsers[4],
    category: formatProjectCategory("Mockups", "Aplicacion movil"),
    tags: ["UI Kit", "Mobile", "Food"],
    likes: 1834,
    saves: 1203,
    createdAt: new Date("2026-05-11"),
    views: 15632,
    projectFile: {
      name: "food-delivery-ui-kit.sketch",
      size: "45.2 MB",
      type: "Sketch",
      downloadAllowed: true,
    },
  },
  {
    id: "6",
    title: "Vintage Typography Poster",
    description: "Classic typographic design with vintage aesthetics and modern execution.",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=900&fit=crop",
    creator: mockUsers[0],
    category: formatProjectCategory("Diseno", "Logos"),
    tags: ["Typography", "Poster", "Vintage"],
    likes: 723,
    saves: 412,
    createdAt: new Date("2026-05-07"),
    views: 4521,
  },
  {
    id: "7",
    title: "Dashboard Analytics Interface",
    description: "Modern analytics dashboard with real-time data visualization and clean metrics display.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&h=600&fit=crop",
    creator: mockUsers[1],
    category: formatProjectCategory("Mockups", "Dashboard"),
    tags: ["Dashboard", "Analytics", "UI"],
    likes: 1523,
    saves: 824,
    createdAt: new Date("2026-05-06"),
    views: 10234,
  },
  {
    id: "8",
    title: "Illustration Series: Nature",
    description: "Beautiful hand-drawn illustrations celebrating nature and wildlife. Digital art meets traditional techniques.",
    image: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=700&h=1000&fit=crop",
    creator: mockUsers[3],
    category: formatProjectCategory("Diseno", "Ilustraciones"),
    tags: ["Illustration", "Nature", "Digital Art"],
    likes: 1672,
    saves: 891,
    createdAt: new Date("2026-05-05"),
    views: 8934,
  },
  {
    id: "9",
    title: "E-commerce Mobile Experience",
    description: "Seamless shopping experience with smooth checkout flow and personalized recommendations.",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=1000&fit=crop",
    creator: mockUsers[2],
    category: formatProjectCategory("Proyectos", "Aplicacion movil"),
    tags: ["E-commerce", "Mobile", "UX"],
    likes: 1345,
    saves: 723,
    createdAt: new Date("2026-05-04"),
    views: 7821,
  },
  {
    id: "10",
    title: "Animated Logo Concepts",
    description: "Dynamic logo animations for tech startup. Multiple variations exploring motion and brand personality.",
    image: "https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800&h=600&fit=crop",
    creator: mockUsers[4],
    category: formatProjectCategory("Diseno", "Branding"),
    tags: ["Animation", "Logo", "Motion"],
    likes: 1089,
    saves: 534,
    createdAt: new Date("2026-05-03"),
    views: 6432,
  },
];

export const mockComments: Comment[] = [
  {
    id: "1",
    user: mockUsers[1],
    content: "This is absolutely stunning! The color palette is perfect and the typography choices are spot on. Would love to see more work like this!",
    createdAt: new Date("2026-05-12T10:30:00"),
    likes: 12,
  },
  {
    id: "2",
    user: mockUsers[2],
    content: "Really clean execution. The attention to detail in the micro-interactions is impressive.",
    createdAt: new Date("2026-05-12T14:20:00"),
    likes: 8,
  },
  {
    id: "3",
    user: mockUsers[3],
    content: "Love the modern approach while keeping it accessible. Great work! 🎨",
    createdAt: new Date("2026-05-12T16:45:00"),
    likes: 15,
  },
  {
    id: "4",
    user: mockUsers[0],
    content: "This is exactly the kind of design inspiration I needed today. Thank you for sharing!",
    createdAt: new Date("2026-05-13T09:15:00"),
    likes: 6,
  },
];
