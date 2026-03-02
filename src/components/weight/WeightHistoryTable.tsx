"use client";

import { Trash2, Sunrise, Sunset, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WeightEntry } from "@/types";

interface Props {
  entries: WeightEntry[];
  onDelete: (id: number) => void;
}

interface DayGroup {
  date: string;
  morning: WeightEntry | null;
  evening: WeightEntry | null;
  other: WeightEntry[];
}

function groupByDay(entries: WeightEntry[]): DayGroup[] {
  const map: Record<string, DayGroup> = {};
  for (const e of entries) {
    if (!map[e.logged_at]) {
      map[e.logged_at] = { date: e.logged_at, morning: null, evening: null, other: [] };
    }
    if (e.time_of_day === "morning") map[e.logged_at].morning = e;
    else if (e.time_of_day === "evening") map[e.logged_at].evening = e;
    else map[e.logged_at].other.push(e);
  }
  return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
}

function WeightCell({
  entry,
  onDelete,
}: {
  entry: WeightEntry | null;
  onDelete: (id: number) => void;
}) {
  if (!entry) {
    return (
      <TableCell className="text-center">
        <Minus className="h-3.5 w-3.5 text-muted-foreground/30 mx-auto" />
      </TableCell>
    );
  }
  return (
    <TableCell>
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-sm">{Number(entry.weight_lbs).toFixed(1)}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => onDelete(entry.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </TableCell>
  );
}

export function WeightHistoryTable({ entries, onDelete }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm py-8">
        No entries yet.
      </p>
    );
  }

  const groups = groupByDay(entries);

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>
              <span className="flex items-center gap-1.5">
                <Sunrise className="h-3.5 w-3.5 text-yellow-500" />
                Morning
              </span>
            </TableHead>
            <TableHead>
              <span className="flex items-center gap-1.5">
                <Sunset className="h-3.5 w-3.5 text-orange-500" />
                Evening
              </span>
            </TableHead>
            <TableHead className="text-right hidden sm:table-cell text-muted-foreground">
              Avg
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => {
            const vals = [g.morning, g.evening, ...g.other]
              .filter(Boolean)
              .map((e) => Number(e!.weight_lbs));
            const avg = vals.length > 1 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

            return (
              <TableRow key={g.date}>
                <TableCell className="font-medium text-sm whitespace-nowrap">
                  {new Date(g.date + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
                <WeightCell entry={g.morning} onDelete={onDelete} />
                <WeightCell entry={g.evening} onDelete={onDelete} />
                <TableCell className="text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                  {avg !== null ? avg.toFixed(1) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
