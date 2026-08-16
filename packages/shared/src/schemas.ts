import { z } from "zod";

export const workStatuses = ["draft", "published", "archived"] as const;
export const publicationTypes = [
  "book",
  "novella",
  "short-story",
  "poem",
  "essay",
  "magazine",
  "anthology",
  "other",
] as const;
export const contentVisibilities = ["external-only", "full"] as const;

const optionalUrl = z
  .union([z.string().url(), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || undefined);

const workBaseSchema = z.object({
  id: z.string().min(1).max(64),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(180),
  status: z.enum(workStatuses),
  publicationType: z.enum(publicationTypes),
  publishedAt: z.string().datetime({ offset: true }).optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  wordCount: z.number().int().nonnegative().max(10_000_000).optional(),
  readingTimeMinutes: z.number().int().positive().max(100_000).optional(),
  blurb: z.string().trim().min(1).max(4_000),
  storyContent: z.string().max(1_000_000).optional(),
  contentVisibility: z.enum(contentVisibilities),
  publisherName: z.string().trim().max(180).optional(),
  primaryExternalUrl: optionalUrl,
  purchaseUrl: optionalUrl,
  socialPostUrl: optionalUrl,
  socialProvider: z
    .enum(["facebook", "instagram", "threads", "x", "other"])
    .optional(),
  socialEmbedEnabled: z.boolean().default(false),
  genres: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  featured: z.boolean().default(false),
});

function validateVisibility(
  work: Record<string, unknown>,
  context: z.RefinementCtx,
) {
  if (work.contentVisibility === "external-only" && !work.primaryExternalUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["primaryExternalUrl"],
      message: "Publication URL is required for link-only work.",
    });
  }
  if (work.contentVisibility === "full" && !work.storyContent) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["storyContent"],
      message: "Story content is required when visibility is full.",
    });
  }
  if (work.status === "published" && !work.publishedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publishedAt"],
      message: "Publication date is required for published work.",
    });
  }
}

export const workSchema = workBaseSchema.superRefine(validateVisibility);

const workInputBaseSchema = workBaseSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const workInputSchema =
  workInputBaseSchema.superRefine(validateVisibility);

export const workPatchSchema = workInputBaseSchema.partial();

export const publicSettingsSchema = z.object({
  authorName: z.string().trim().min(1).max(160),
  introduction: z.string().trim().max(2_000),
  biography: z.string().max(20_000),
  profileImageUrl: optionalUrl,
  announcement: z.string().trim().max(500).optional(),
  socialLinks: z.record(z.string().url()).default({}),
  themeSettings: z.record(z.string()).default({}),
  contactLink: optionalUrl,
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(512),
});

export const commentInputSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  body: z
    .string()
    .trim()
    .min(1)
    .max(300, "Comments must be 300 characters or fewer."),
  website: z.string().max(0).optional(),
  turnstileToken: z.string().max(2_048).optional(),
});

export const commentModerationSchema = z.object({
  moderationStatus: z.enum(["pending", "approved", "rejected"]),
});

export type Work = z.infer<typeof workSchema>;
export type WorkInput = z.infer<typeof workInputSchema>;
export type WorkPatch = z.infer<typeof workPatchSchema>;
export type PublicSettings = z.infer<typeof publicSettingsSchema>;
export type CommentInput = z.infer<typeof commentInputSchema>;
