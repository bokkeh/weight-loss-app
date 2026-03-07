"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { shareOrCopy } from "@/lib/shareUtils";
import { Check, CheckCircle2, Circle, GripVertical, ListChecks, Pencil, Share2, Sparkles, Star, Trash2, X } from "lucide-react";

interface GroceryItem {
  id: number;
  name: string;
  quantity: string | null;
  liked: boolean;
  category?: GroceryGroupKey | null;
  sort_order?: number;
  checked: boolean;
  source: string;
  recipe_id?: number | null;
  created_at: string;
}

type GroceryGroupKey = "liked" | "fruits" | "veggies" | "breads" | "meats" | "dairy" | "spices_sauces" | "misc";

const GROUP_LABELS: Record<GroceryGroupKey, string> = {
  liked: "Liked Items",
  fruits: "Fruits",
  veggies: "Veggies",
  breads: "Breads",
  meats: "Meats",
  dairy: "Dairy",
  spices_sauces: "Spices/Sauces",
  misc: "Miscellaneous",
};

const EDITABLE_CATEGORY_KEYS: GroceryGroupKey[] = [
  "fruits",
  "veggies",
  "breads",
  "meats",
  "dairy",
  "spices_sauces",
  "misc",
];

function inferGroup(name: string): GroceryGroupKey {
  const value = name.toLowerCase();
  if (/\b(apple|banana|berry|berries|orange|grape|melon|pear|peach|plum|pineapple|mango|avocado|fruit)\b/.test(value)) return "fruits";
  if (/\b(spinach|lettuce|kale|broccoli|carrot|pepper|onion|tomato|cucumber|zucchini|cauliflower|celery|vegetable|veggie)\b/.test(value)) return "veggies";
  if (/\b(bread|bagel|bun|roll|tortilla|pita|sourdough|baguette|toast)\b/.test(value)) return "breads";
  if (/\b(chicken|turkey|beef|steak|pork|ham|sausage|bacon|salmon|tuna|fish|shrimp|meat)\b/.test(value)) return "meats";
  if (/\b(milk|cheese|yogurt|butter|cream|cottage|egg|eggs|dairy)\b/.test(value)) return "dairy";
  if (/\b(spice|spices|salt|pepper|paprika|cumin|garlic powder|onion powder|oregano|basil|sauce|ketchup|mustard|mayo|soy|hot sauce|salsa|vinaigrette)\b/.test(value)) return "spices_sauces";
  return "misc";
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  const raw = await res.text().catch(() => "");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function checklistText(items: GroceryItem[]) {
  const lines = ["Grocery List", ""];
  for (const item of items) {
    lines.push(`${item.checked ? "[x]" : "[ ]"} ${item.name}${item.quantity ? ` (${item.quantity})` : ""}`);
  }
  return lines.join("\n");
}

async function buildChecklistImage(items: GroceryItem[]): Promise<File> {
  const width = 1080;
  const rowHeight = 56;
  const paddedCount = Math.max(items.length, 8);
  const height = 260 + paddedCount * rowHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not render checklist image.");

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f3faf7");
  gradient.addColorStop(1, "#ecf7ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 56px Arial";
  ctx.fillText("Grocery Checklist", 60, 100);
  ctx.fillStyle = "#475569";
  ctx.font = "400 28px Arial";
  ctx.fillText(new Date().toLocaleDateString(), 60, 145);

  let y = 210;
  for (const item of items) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(40, y - 32, width - 80, 44);
    ctx.fillStyle = item.checked ? "#16a34a" : "#0f172a";
    ctx.font = "600 28px Arial";
    const prefix = item.checked ? "✓" : "○";
    const text = `${prefix} ${item.name}${item.quantity ? ` (${item.quantity})` : ""}`;
    ctx.fillText(text, 60, y);
    y += rowHeight;
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Failed to build checklist image.");
  return new File([blob], "grocery-list.png", { type: "image/png" });
}

export default function GroceryPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [shareDone, setShareDone] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [quantityDraft, setQuantityDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState<GroceryGroupKey>("misc");
  const [quantitySavingId, setQuantitySavingId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<GroceryGroupKey | null>(null);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch("/api/grocery");
      const data = await readJsonSafe<GroceryItem[]>(res);
      setItems(res.ok && Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems().catch(() => undefined);
  }, []);

  async function addManualItem() {
    const name = manualName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity: manualQty.trim() || null }),
      });
      const created = await readJsonSafe<GroceryItem>(res);
      if (res.ok && created) {
        setItems((prev) => [created, ...prev]);
        setManualName("");
        setManualQty("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function addFromAi() {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    setAiLoading(true);
    try {
      const parseRes = await fetch("/api/grocery/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const parsed = await readJsonSafe<{ items?: Array<{ name: string; quantity?: string }> }>(parseRes);
      const payload = (parsed?.items ?? []).filter((i) => i.name?.trim());
      if (!parseRes.ok || payload.length === 0) return;

      const createRes = await fetch("/api/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const created = await readJsonSafe<GroceryItem[]>(createRes);
      if (createRes.ok && Array.isArray(created)) {
        setItems((prev) => [...created, ...prev]);
        setAiPrompt("");
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function toggleItem(item: GroceryItem) {
    const res = await fetch(`/api/grocery/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: !item.checked }),
    });
    const updated = await readJsonSafe<GroceryItem>(res);
    if (res.ok && updated) {
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    }
  }

  async function toggleLiked(item: GroceryItem) {
    const res = await fetch(`/api/grocery/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liked: !item.liked }),
    });
    const updated = await readJsonSafe<GroceryItem>(res);
    if (res.ok && updated) {
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    }
  }

  async function moveItemToGroup(item: GroceryItem, group: GroceryGroupKey) {
    const payload =
      group === "liked"
        ? { liked: true, category: null }
        : { liked: false, category: group };
    const res = await fetch(`/api/grocery/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const updated = await readJsonSafe<GroceryItem>(res);
    if (res.ok && updated) {
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    }
  }

  async function deleteItem(id: number) {
    await fetch(`/api/grocery/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function startEditQuantity(item: GroceryItem) {
    setEditingId(item.id);
    setQuantityDraft(item.quantity ?? "");
    const currentCategory = item.liked ? "misc" : item.category ?? inferGroup(item.name);
    setCategoryDraft(currentCategory);
  }

  function cancelEditQuantity() {
    setEditingId(null);
    setQuantityDraft("");
  }

  async function saveQuantity(item: GroceryItem) {
    setQuantitySavingId(item.id);
    try {
      const res = await fetch(`/api/grocery/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: quantityDraft.trim(),
          category: categoryDraft,
          liked: item.liked && categoryDraft === "misc",
        }),
      });
      const updated = await readJsonSafe<GroceryItem>(res);
      if (res.ok && updated) {
        setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
        cancelEditQuantity();
      }
    } finally {
      setQuantitySavingId(null);
    }
  }

  async function swapItemOrder(source: GroceryItem, target: GroceryItem) {
    const sourceOrder = Number.isFinite(source.sort_order) ? Number(source.sort_order) : source.id;
    const targetOrder = Number.isFinite(target.sort_order) ? Number(target.sort_order) : target.id;
    if (sourceOrder === targetOrder) return;

    const [aRes, bRes] = await Promise.all([
      fetch(`/api/grocery/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: targetOrder }),
      }),
      fetch(`/api/grocery/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: sourceOrder }),
      }),
    ]);
    const [aUpdated, bUpdated] = await Promise.all([
      readJsonSafe<GroceryItem>(aRes),
      readJsonSafe<GroceryItem>(bRes),
    ]);
    if (aRes.ok && bRes.ok && aUpdated && bUpdated) {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id === aUpdated.id) return aUpdated;
          if (it.id === bUpdated.id) return bUpdated;
          return it;
        })
      );
    }
  }

  async function shareList() {
    const sorted = [...items].sort((a, b) => {
      if (Number(a.checked) !== Number(b.checked)) return Number(a.checked) - Number(b.checked);
      const aOrder = Number.isFinite(a.sort_order) ? Number(a.sort_order) : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(b.sort_order) ? Number(b.sort_order) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    const file = await buildChecklistImage(sorted);
    const nav = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean };

    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({
        title: "Grocery List",
        text: "My grocery checklist",
        files: [file],
      });
    } else {
      await shareOrCopy(checklistText(sorted), "Grocery List");
    }
    setShareDone(true);
    setTimeout(() => setShareDone(false), 2000);
  }

  const remaining = useMemo(() => items.filter((i) => !i.checked).length, [items]);
  const groupedItems = useMemo(() => {
    const groups: Record<GroceryGroupKey, GroceryItem[]> = {
      liked: [],
      fruits: [],
      veggies: [],
      breads: [],
      meats: [],
      dairy: [],
      spices_sauces: [],
      misc: [],
    };
    const sorted = [...items].sort((a, b) => Number(a.checked) - Number(b.checked));
    for (const item of sorted) {
      if (item.liked) {
        groups.liked.push(item);
      } else {
        const explicit = item.category && groups[item.category] ? item.category : null;
        groups[explicit ?? inferGroup(item.name)].push(item);
      }
    }
    return groups;
  }, [items]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Grocery List</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {remaining} item{remaining === 1 ? "" : "s"} left to grab
          </p>
        </div>
        <Button onClick={shareList} disabled={items.length === 0} className="gap-1.5">
          {shareDone ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          {shareDone ? "Shared" : "Share"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Add</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-[1fr_180px_auto] gap-2">
            <Input placeholder="Add item (e.g., eggs)" value={manualName} onChange={(e) => setManualName(e.target.value)} />
            <Input placeholder="Quantity (optional)" value={manualQty} onChange={(e) => setManualQty(e.target.value)} />
            <Button type="button" onClick={addManualItem} disabled={saving}>
              Add
            </Button>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-violet-500" />
              AI Quick Add
            </p>
            <Textarea
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Example: add everything for high-protein tacos, veggies for the week, and snacks for two kids."
            />
            <Button type="button" variant="outline" onClick={addFromAi} disabled={aiLoading}>
              {aiLoading ? "Thinking..." : "Generate and Add"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none bg-transparent">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading grocery items...</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-60" />
              Add your first grocery item or use AI Quick Add.
            </div>
          ) : (
            <div className="space-y-4">
              {groupedItems.liked.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Favorites</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {groupedItems.liked.map((fav) => (
                        <div key={`fav-${fav.id}`} className="shrink-0 rounded-lg border px-3 py-2 min-w-56 bg-background">
                          <p className="text-sm font-medium truncate">{fav.name}</p>
                          <p className="text-xs text-muted-foreground">{fav.quantity || "No quantity"}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs"
                            onClick={async () => {
                              const res = await fetch("/api/grocery", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: fav.name, quantity: fav.quantity }),
                              });
                              const created = await readJsonSafe<GroceryItem>(res);
                              if (res.ok && created) {
                                setItems((prev) => [created, ...prev]);
                              }
                            }}
                          >
                            Add Again
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {(Object.keys(GROUP_LABELS) as GroceryGroupKey[]).map((groupKey) => {
                const group = groupedItems[groupKey];
                if (group.length === 0) return null;
                return (
                  <div
                    key={groupKey}
                    className={`space-y-2 rounded-xl p-1 transition-colors ${
                      dragOverGroup === groupKey ? "bg-muted/40" : ""
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverGroup !== groupKey) setDragOverGroup(groupKey);
                    }}
                    onDragLeave={() => {
                      if (dragOverGroup === groupKey) setDragOverGroup(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = Number(e.dataTransfer.getData("text/plain") || draggingId);
                      const item = items.find((it) => it.id === id);
                      if (item) {
                        moveItemToGroup(item, groupKey).catch(() => undefined);
                      }
                      setDragOverGroup(null);
                      setDraggingId(null);
                    }}
                  >
                    <div className="px-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {GROUP_LABELS[groupKey]} ({group.length})
                      </p>
                    </div>
                    {group.map((item) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggingId(item.id);
                          e.dataTransfer.setData("text/plain", String(item.id));
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const sourceId = Number(e.dataTransfer.getData("text/plain") || draggingId);
                          const source = items.find((it) => it.id === sourceId);
                          if (!source || source.id === item.id) return;
                          const sourceGroup = source.liked ? "liked" : source.category ?? inferGroup(source.name);
                          if (sourceGroup === groupKey) {
                            swapItemOrder(source, item).catch(() => undefined);
                          } else {
                            moveItemToGroup(source, groupKey).catch(() => undefined);
                          }
                          setDragOverGroup(null);
                          setDraggingId(null);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverGroup(null);
                        }}
                        className={`rounded-xl border p-3 flex items-center gap-3 ${
                          item.checked ? "bg-green-50/50 border-green-200" : "bg-white"
                        } ${draggingId === item.id ? "opacity-60" : ""}`}
                      >
                        <div className="text-muted-foreground/70 shrink-0" title="Drag to reorder or move">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <button type="button" onClick={() => toggleItem(item)} className="shrink-0">
                          {item.checked ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <Circle className="h-5 w-5 text-slate-500" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                            {item.name}
                          </p>
                          {editingId === item.id ? (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <Input
                                value={quantityDraft}
                                onChange={(e) => setQuantityDraft(e.target.value)}
                                placeholder="Quantity"
                                className="h-8 text-xs max-w-[180px]"
                              />
                              <Select value={categoryDraft} onValueChange={(v) => setCategoryDraft(v as GroceryGroupKey)}>
                                <SelectTrigger className="h-8 w-[170px] text-xs">
                                  <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {EDITABLE_CATEGORY_KEYS.map((key) => (
                                    <SelectItem key={key} value={key}>
                                      {GROUP_LABELS[key]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => saveQuantity(item)}
                                disabled={quantitySavingId === item.id}
                                aria-label="Save quantity"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={cancelEditQuantity}
                                aria-label="Cancel editing quantity"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <span>{item.quantity || "No quantity"} | {item.source}</span>
                              <button
                                type="button"
                                onClick={() => startEditQuantity(item)}
                                className="inline-flex items-center text-muted-foreground hover:text-foreground"
                                aria-label="Edit quantity"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleLiked(item)}
                          className={`${item.liked ? "text-amber-500" : "text-muted-foreground"} hover:text-amber-500`}
                          aria-label={item.liked ? "Unlike item" : "Like item"}
                          title={item.liked ? "Unlike item" : "Like item"}
                        >
                          <Star className={`h-4 w-4 ${item.liked ? "fill-current" : ""}`} />
                        </button>
                        <button type="button" onClick={() => deleteItem(item.id)} className="text-muted-foreground hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
