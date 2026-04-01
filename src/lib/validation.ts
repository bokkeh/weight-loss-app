import { z } from "zod";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format");

const nonNegativeNumber = (label: string, max: number) =>
  z
    .coerce
    .number()
    .refine((value) => Number.isFinite(value), `${label} must be a valid number`)
    .min(0, `${label} cannot be negative`)
    .max(max, `${label} is too large`);

const nullableTrimmedString = (label: string, max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .refine((value) => value == null || value.length <= max, `${label} is too long`);

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const foodLogSourceSchema = z.enum(["manual", "ai_chat", "recipe"]);
export const weightTimeOfDaySchema = z.enum(["morning", "evening"]);

export const createFoodLogSchema = z.object({
  logged_at: isoDateSchema.optional(),
  meal_type: mealTypeSchema.nullable().optional(),
  food_name: z.string().trim().min(1, "Food name is required").max(120, "Food name is too long"),
  serving_size: nullableTrimmedString("Serving size", 120),
  calories: nonNegativeNumber("Calories", 10000).optional().default(0),
  protein_g: nonNegativeNumber("Protein", 1000).optional().default(0),
  carbs_g: nonNegativeNumber("Carbs", 1000).optional().default(0),
  fat_g: nonNegativeNumber("Fat", 1000).optional().default(0),
  fiber_g: nonNegativeNumber("Fiber", 1000).optional().default(0),
  sugar_g: nonNegativeNumber("Sugar", 1000).optional().default(0),
  sodium_mg: nonNegativeNumber("Sodium", 20000).optional().default(0),
  source: foodLogSourceSchema.optional().default("manual"),
  recipe_id: z.coerce.number().int().positive().nullable().optional(),
});

export const updateFoodLogSchema = z
  .object({
    food_name: z.string().trim().min(1, "Food name is required").max(120, "Food name is too long").optional(),
    serving_size: nullableTrimmedString("Serving size", 120).optional(),
    meal_type: mealTypeSchema.nullable().optional(),
    display_order: z.coerce.number().finite().nullable().optional(),
    calories: nonNegativeNumber("Calories", 10000).optional(),
    protein_g: nonNegativeNumber("Protein", 1000).optional(),
    carbs_g: nonNegativeNumber("Carbs", 1000).optional(),
    fat_g: nonNegativeNumber("Fat", 1000).optional(),
    fiber_g: nonNegativeNumber("Fiber", 1000).optional(),
    sugar_g: nonNegativeNumber("Sugar", 1000).optional(),
    sodium_mg: nonNegativeNumber("Sodium", 20000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const createWaterLogSchema = z.object({
  logged_at: isoDateSchema.optional(),
  ounces: z.coerce.number().finite().min(1, "Water ounces must be at least 1").max(256, "Water ounces are too large").optional().default(8),
  source: z.string().trim().min(1, "Source is required").max(64, "Source is too long").optional().default("sodium_widget"),
});

export const deleteByIdSchema = z.object({
  id: z.coerce.number().int().positive("A valid id is required"),
});

export const createWeightEntrySchema = z.object({
  logged_at: isoDateSchema.optional(),
  weight_lbs: z.coerce.number().finite().min(1, "Weight must be greater than 0").max(1400, "Weight is too large"),
  time_of_day: weightTimeOfDaySchema.nullable().optional(),
  note: nullableTrimmedString("Note", 500),
});

export const updateProfileSchema = z.object({
  first_name: nullableTrimmedString("First name", 80),
  last_name: nullableTrimmedString("Last name", 80),
  email: z.union([z.string().trim().email("Email must be valid"), z.null(), z.undefined()]).transform((value) => value ?? null),
  phone: nullableTrimmedString("Phone", 40),
  dietary_restrictions: z
    .union([z.array(z.string()), z.null(), z.undefined()])
    .transform((value) =>
      Array.isArray(value)
        ? value.map((item) => item.trim()).filter(Boolean).slice(0, 20)
        : null
    ),
  profile_image_url: nullableTrimmedString("Profile image URL", 500),
  calorie_goal: nonNegativeNumber("Calorie goal", 10000).nullable().optional(),
  protein_goal_g: nonNegativeNumber("Protein goal", 1000).nullable().optional(),
  carbs_goal_g: nonNegativeNumber("Carbs goal", 1000).nullable().optional(),
  fat_goal_g: nonNegativeNumber("Fat goal", 1000).nullable().optional(),
  fiber_goal_g: nonNegativeNumber("Fiber goal", 1000).nullable().optional(),
  sugar_goal_g: nonNegativeNumber("Sugar goal", 1000).nullable().optional(),
  sodium_goal_mg: nonNegativeNumber("Sodium goal", 20000).nullable().optional(),
  height_in: nonNegativeNumber("Height", 120).nullable().optional(),
  goal_weight_lbs: nonNegativeNumber("Goal weight", 1400).nullable().optional(),
  onboarding_completed: z.boolean().optional(),
});

export const chatImageSchema = z.object({
  imageBase64: z.string().trim().min(1, "Image data is required"),
  mimeType: z.string().trim().min(1, "Image type is required").max(100, "Image type is too long"),
});

export const chatRequestSchema = z.object({
  message: z.string().trim().max(4000, "Message is too long").optional(),
  images: z.array(chatImageSchema).max(4, "You can upload up to 4 images").optional(),
});

export const foodEstimateSchema = z.object({
  text: z.string().trim().max(4000, "Description is too long").optional(),
  imageBase64: z.string().trim().optional(),
  mimeType: z.string().trim().max(100, "Image type is too long").optional(),
  images: z.array(chatImageSchema).max(4, "You can upload up to 4 images").optional(),
  logged_at: isoDateSchema.optional(),
});
