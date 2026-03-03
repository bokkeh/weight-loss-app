import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Recipe } from "@/types";
import { ImageOff } from "lucide-react";

interface Props {
  recipe: Recipe;
  onClick: () => void;
}

export function RecipeCard({ recipe, onClick }: Props) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden group"
      onClick={onClick}
    >
      <div className="relative h-40 bg-muted">
        {recipe.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8 opacity-30" />
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <h3 className="font-semibold text-sm leading-tight mb-1 line-clamp-2">
          {recipe.name}
        </h3>
        <div className="flex gap-2 text-xs font-mono mb-2">
          <span className="text-orange-600 font-bold">
            {Number(recipe.calories).toFixed(0)} kcal
          </span>
          <span className="text-blue-600">P: {Number(recipe.protein_g).toFixed(0)}g</span>
          <span className="text-yellow-600">C: {Number(recipe.carbs_g).toFixed(0)}g</span>
        </div>
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recipe.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
