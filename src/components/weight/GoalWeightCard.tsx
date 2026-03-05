"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";

interface Props {
  startWeight: number | null;
  currentWeight: number | null;
  goalWeight: number | null;
  onGoalSet: (goal: number) => void;
}

export function GoalWeightCard({ startWeight, currentWeight, goalWeight, onGoalSet }: Props) {
  const [editing, setEditing] = useState(!goalWeight);
  const [input, setInput] = useState(goalWeight ? String(goalWeight) : "");

  function handleSave() {
    const val = parseFloat(input);
    if (val > 0) {
      onGoalSet(val);
      setEditing(false);
    }
  }

  const pct =
    startWeight && currentWeight && goalWeight && startWeight !== goalWeight
      ? Math.min(
          100,
          Math.max(
            0,
            ((startWeight - currentWeight) / (startWeight - goalWeight)) * 100
          )
        )
      : null;

  const lbsLeft =
    currentWeight && goalWeight ? currentWeight - goalWeight : null;

  return (
    <Card className="gap-2">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-green-600" />
          Goal Weight
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {editing ? (
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Target lbs"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              step="0.1"
              min="1"
            />
            <Button onClick={handleSave} size="sm">Set</Button>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-bold">{goalWeight} <span className="text-lg font-normal text-muted-foreground">lbs</span></p>
                {lbsLeft !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lbsLeft > 0
                      ? `${lbsLeft.toFixed(1)} lbs to go`
                      : lbsLeft < 0
                      ? `${Math.abs(lbsLeft).toFixed(1)} lbs below goal `
                      : "Goal reached! "}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-xs">
                Edit
              </Button>
            </div>
            {pct !== null && (
              <div className="space-y-1">
                <Progress value={pct} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">{pct.toFixed(0)}% of the way there</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}


