export interface WeightEntry {
  id: number;
  logged_at: string;
  weight_lbs: number;
  time_of_day: "morning" | "evening" | null;
  note?: string;
  created_at: string;
}

export interface FoodLogEntry {
  id: number;
  logged_at: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack" | null;
  display_order?: number;
  food_name: string;
  serving_size?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  source: "manual" | "ai_chat" | "recipe";
  recipe_id?: number;
  created_at: string;
}

export interface Recipe {
  id: number;
  name: string;
  description?: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  ingredients?: string;
  instructions?: string;
  image_url?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "model";
  content: string;
  food_log_id?: number;
  created_at: string;
}

export interface UserProfile {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  profile_image_url?: string;
  account_type?: "regular" | "personal_trainer" | "admin";
  dietary_restrictions?: string[];
  calorie_goal?: number;
  protein_goal_g?: number;
  carbs_goal_g?: number;
  fat_goal_g?: number;
  fiber_goal_g?: number;
  sodium_goal_mg?: number;
  height_in?: number;
  goal_weight_lbs?: number;
  onboarding_completed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WaterLogEntry {
  id: number;
  logged_at: string;
  ounces: number;
  source: string;
  created_at: string;
}

export interface DailyMacroTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
}
