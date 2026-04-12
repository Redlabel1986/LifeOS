// ============================================================================
// @lifeos/db — seed
// ----------------------------------------------------------------------------
// Seeds the database with:
//   * System categories (all 4 locales)
//   * Starter merchants with regex patterns for auto-detection
//
// Idempotent: safe to re-run.
// ============================================================================

import { PrismaClient, CategoryKind } from "../src/generated/client/index.js";

const prisma = new PrismaClient();

interface SystemCategory {
  slug: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  taxDeductible: boolean;
  translations: { de: string; en: string; fr: string; ar: string };
}

const SYSTEM_CATEGORIES: SystemCategory[] = [
  // Income
  {
    slug: "salary",
    kind: CategoryKind.INCOME,
    icon: "briefcase",
    color: "#22c55e",
    taxDeductible: false,
    translations: {
      de: "Gehalt",
      en: "Salary",
      fr: "Salaire",
      ar: "راتب",
    },
  },
  {
    slug: "freelance",
    kind: CategoryKind.INCOME,
    icon: "laptop",
    color: "#10b981",
    taxDeductible: false,
    translations: {
      de: "Freiberuflich",
      en: "Freelance",
      fr: "Indépendant",
      ar: "عمل حر",
    },
  },
  {
    slug: "investments",
    kind: CategoryKind.INCOME,
    icon: "trending-up",
    color: "#059669",
    taxDeductible: false,
    translations: {
      de: "Kapitalerträge",
      en: "Investments",
      fr: "Investissements",
      ar: "استثمارات",
    },
  },
  {
    slug: "refunds",
    kind: CategoryKind.INCOME,
    icon: "undo",
    color: "#14b8a6",
    taxDeductible: false,
    translations: {
      de: "Erstattungen",
      en: "Refunds",
      fr: "Remboursements",
      ar: "استرداد",
    },
  },
  // Expense — essentials
  {
    slug: "groceries",
    kind: CategoryKind.EXPENSE,
    icon: "shopping-cart",
    color: "#f59e0b",
    taxDeductible: false,
    translations: {
      de: "Lebensmittel",
      en: "Groceries",
      fr: "Alimentation",
      ar: "بقالة",
    },
  },
  {
    slug: "rent",
    kind: CategoryKind.EXPENSE,
    icon: "home",
    color: "#ef4444",
    taxDeductible: false,
    translations: {
      de: "Miete",
      en: "Rent",
      fr: "Loyer",
      ar: "إيجار",
    },
  },
  {
    slug: "utilities",
    kind: CategoryKind.EXPENSE,
    icon: "zap",
    color: "#f97316",
    taxDeductible: false,
    translations: {
      de: "Nebenkosten",
      en: "Utilities",
      fr: "Charges",
      ar: "مرافق",
    },
  },
  {
    slug: "insurance",
    kind: CategoryKind.EXPENSE,
    icon: "shield",
    color: "#8b5cf6",
    taxDeductible: true,
    translations: {
      de: "Versicherung",
      en: "Insurance",
      fr: "Assurance",
      ar: "تأمين",
    },
  },
  {
    slug: "transport",
    kind: CategoryKind.EXPENSE,
    icon: "car",
    color: "#3b82f6",
    taxDeductible: false,
    translations: {
      de: "Verkehr",
      en: "Transport",
      fr: "Transport",
      ar: "مواصلات",
    },
  },
  {
    slug: "health",
    kind: CategoryKind.EXPENSE,
    icon: "heart",
    color: "#ec4899",
    taxDeductible: true,
    translations: {
      de: "Gesundheit",
      en: "Health",
      fr: "Santé",
      ar: "صحة",
    },
  },
  // Expense — lifestyle
  {
    slug: "dining",
    kind: CategoryKind.EXPENSE,
    icon: "utensils",
    color: "#eab308",
    taxDeductible: false,
    translations: {
      de: "Restaurants",
      en: "Dining out",
      fr: "Restaurants",
      ar: "مطاعم",
    },
  },
  {
    slug: "entertainment",
    kind: CategoryKind.EXPENSE,
    icon: "film",
    color: "#a855f7",
    taxDeductible: false,
    translations: {
      de: "Unterhaltung",
      en: "Entertainment",
      fr: "Loisirs",
      ar: "ترفيه",
    },
  },
  {
    slug: "subscriptions",
    kind: CategoryKind.EXPENSE,
    icon: "repeat",
    color: "#6366f1",
    taxDeductible: false,
    translations: {
      de: "Abonnements",
      en: "Subscriptions",
      fr: "Abonnements",
      ar: "اشتراكات",
    },
  },
  {
    slug: "shopping",
    kind: CategoryKind.EXPENSE,
    icon: "shopping-bag",
    color: "#d946ef",
    taxDeductible: false,
    translations: {
      de: "Einkäufe",
      en: "Shopping",
      fr: "Achats",
      ar: "تسوق",
    },
  },
  {
    slug: "education",
    kind: CategoryKind.EXPENSE,
    icon: "book",
    color: "#0ea5e9",
    taxDeductible: true,
    translations: {
      de: "Bildung",
      en: "Education",
      fr: "Éducation",
      ar: "تعليم",
    },
  },
  {
    slug: "travel",
    kind: CategoryKind.EXPENSE,
    icon: "plane",
    color: "#06b6d4",
    taxDeductible: false,
    translations: {
      de: "Reisen",
      en: "Travel",
      fr: "Voyages",
      ar: "سفر",
    },
  },
  {
    slug: "taxes",
    kind: CategoryKind.EXPENSE,
    icon: "file-text",
    color: "#64748b",
    taxDeductible: false,
    translations: {
      de: "Steuern",
      en: "Taxes",
      fr: "Impôts",
      ar: "ضرائب",
    },
  },
  {
    slug: "other",
    kind: CategoryKind.EXPENSE,
    icon: "more-horizontal",
    color: "#94a3b8",
    taxDeductible: false,
    translations: {
      de: "Sonstiges",
      en: "Other",
      fr: "Autre",
      ar: "أخرى",
    },
  },
];

interface SystemMerchant {
  name: string;
  displayName: string;
  website?: string;
  countryCode?: string;
  patterns: string[];
  defaultCategorySlug: string;
}

const SYSTEM_MERCHANTS: SystemMerchant[] = [
  {
    name: "rewe",
    displayName: "REWE",
    website: "https://www.rewe.de",
    countryCode: "DE",
    patterns: ["REWE", "Rewe Markt"],
    defaultCategorySlug: "groceries",
  },
  {
    name: "lidl",
    displayName: "Lidl",
    website: "https://www.lidl.de",
    countryCode: "DE",
    patterns: ["LIDL", "Lidl Dienstleistung"],
    defaultCategorySlug: "groceries",
  },
  {
    name: "aldi",
    displayName: "ALDI",
    countryCode: "DE",
    patterns: ["ALDI", "ALDI SUED", "ALDI NORD"],
    defaultCategorySlug: "groceries",
  },
  {
    name: "edeka",
    displayName: "EDEKA",
    countryCode: "DE",
    patterns: ["EDEKA"],
    defaultCategorySlug: "groceries",
  },
  {
    name: "dm",
    displayName: "dm-drogerie markt",
    countryCode: "DE",
    patterns: ["dm-drogerie", "dm filiale"],
    defaultCategorySlug: "shopping",
  },
  {
    name: "netflix",
    displayName: "Netflix",
    website: "https://www.netflix.com",
    patterns: ["NETFLIX", "Netflix.com"],
    defaultCategorySlug: "subscriptions",
  },
  {
    name: "spotify",
    displayName: "Spotify",
    website: "https://www.spotify.com",
    patterns: ["SPOTIFY", "Spotify AB"],
    defaultCategorySlug: "subscriptions",
  },
  {
    name: "amazon",
    displayName: "Amazon",
    website: "https://www.amazon.de",
    patterns: ["AMAZON", "AMZN"],
    defaultCategorySlug: "shopping",
  },
  {
    name: "apple",
    displayName: "Apple",
    website: "https://www.apple.com",
    patterns: ["APPLE.COM", "APPLE STORE"],
    defaultCategorySlug: "shopping",
  },
  {
    name: "deutsche-bahn",
    displayName: "Deutsche Bahn",
    website: "https://www.bahn.de",
    countryCode: "DE",
    patterns: ["DB Vertrieb", "DB Bahn", "DEUTSCHE BAHN"],
    defaultCategorySlug: "transport",
  },
  {
    name: "ikea",
    displayName: "IKEA",
    website: "https://www.ikea.com",
    patterns: ["IKEA"],
    defaultCategorySlug: "shopping",
  },
  {
    name: "wolt",
    displayName: "Wolt",
    website: "https://wolt.com",
    countryCode: "DE",
    patterns: ["WOLT", "Wolt"],
    defaultCategorySlug: "groceries",
  },
  {
    name: "wow",
    displayName: "WOW (Sky)",
    website: "https://wowtv.de",
    countryCode: "DE",
    patterns: ["\\bWOW\\b", "WOW STREAMING", "Sky Deutschland"],
    defaultCategorySlug: "subscriptions",
  },
  {
    name: "block-house",
    displayName: "Block House",
    website: "https://www.block-house.de",
    countryCode: "DE",
    patterns: ["BLOCK\\s*HOUSE", "BLOCKHOUSE"],
    defaultCategorySlug: "dining",
  },
  {
    name: "lieferando",
    displayName: "Lieferando",
    website: "https://www.lieferando.de",
    countryCode: "DE",
    patterns: ["LIEFERANDO", "JUST EAT"],
    defaultCategorySlug: "dining",
  },
  {
    name: "uber-eats",
    displayName: "Uber Eats",
    patterns: ["UBER\\s*EATS"],
    defaultCategorySlug: "dining",
  },
  {
    name: "disney-plus",
    displayName: "Disney+",
    patterns: ["DISNEY\\s*PLUS", "DISNEY\\+", "DISNEYPLUS"],
    defaultCategorySlug: "subscriptions",
  },
  {
    name: "kaufland",
    displayName: "Kaufland",
    countryCode: "DE",
    patterns: ["KAUFLAND"],
    defaultCategorySlug: "groceries",
  },
  {
    name: "penny",
    displayName: "Penny",
    countryCode: "DE",
    patterns: ["\\bPENNY\\b", "PENNY MARKT"],
    defaultCategorySlug: "groceries",
  },
  {
    name: "netto",
    displayName: "Netto",
    countryCode: "DE",
    patterns: ["NETTO MARKEN", "NETTO MARKT"],
    defaultCategorySlug: "groceries",
  },
];

async function seed(): Promise<void> {
  console.log("Seeding system categories...");
  let sortOrder = 0;
  for (const cat of SYSTEM_CATEGORIES) {
    // Composite unique with a nullable userId can't be used with upsert because
    // Postgres treats NULL as not-equal. findFirst + create/update instead.
    const existing = await prisma.category.findFirst({
      where: { userId: null, slug: cat.slug, isSystem: true },
    });
    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          translations: cat.translations,
          icon: cat.icon,
          color: cat.color,
          taxDeductible: cat.taxDeductible,
          kind: cat.kind,
          sortOrder: sortOrder++,
        },
      });
    } else {
      await prisma.category.create({
        data: {
          userId: null,
          isSystem: true,
          slug: cat.slug,
          kind: cat.kind,
          translations: cat.translations,
          icon: cat.icon,
          color: cat.color,
          taxDeductible: cat.taxDeductible,
          sortOrder: sortOrder++,
        },
      });
    }
  }

  console.log("Seeding system merchants...");
  for (const m of SYSTEM_MERCHANTS) {
    await prisma.merchant.upsert({
      where: { name: m.name },
      update: {
        displayName: m.displayName,
        website: m.website ?? null,
        countryCode: m.countryCode ?? null,
        patterns: m.patterns,
        defaultCategorySlug: m.defaultCategorySlug,
      },
      create: {
        name: m.name,
        displayName: m.displayName,
        website: m.website ?? null,
        countryCode: m.countryCode ?? null,
        patterns: m.patterns,
        defaultCategorySlug: m.defaultCategorySlug,
      },
    });
  }

  console.log(
    `Seeded ${SYSTEM_CATEGORIES.length} categories and ${SYSTEM_MERCHANTS.length} merchants`,
  );
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
