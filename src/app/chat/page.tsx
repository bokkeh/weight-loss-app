"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodLogConfirmCard } from "@/components/chat/FoodLogConfirmCard";
import { ChatMessage, FoodLogEntry } from "@/types";
import { Send, Trash2, Bot, User, Mic, MicOff, ImagePlus, Volume2, VolumeX, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface UIMessage {
  id: number | string;
  role: "user" | "model";
  content: string;
  foodLogged?: FoodLogEntry;
  imagesPreview?: string[];
}

interface UploadImage {
  imageBase64: string;
  mimeType: string;
  previewUrl: string;
  name: string;
}

interface SpeechRecognitionLike {
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<UploadImage[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  function markdownToSpeechText(markdown: string) {
    return markdown
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      .replace(/[#>*_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stopSpeaking() {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
  }

  function speakText(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(markdownToSpeechText(text));
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/chat");
        const history: ChatMessage[] = await res.json();
        setMessages(
          history.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }))
        );
      } finally {
        setLoadingHistory(false);
      }
    }
    loadHistory().catch(() => undefined);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopSpeaking();
      setAttachedImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
        return prev;
      });
    };
  }, []);

  async function fileToUploadImage(file: File): Promise<UploadImage> {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result ?? "");
        const [, encoded = ""] = value.split(",");
        resolve(encoded);
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
    return {
      imageBase64: base64,
      mimeType: file.type || "image/jpeg",
      previewUrl: URL.createObjectURL(file),
      name: file.name,
    };
  }

  async function handleImagePick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const imageFiles = files.filter((f) => f.type.startsWith("image/")).slice(0, 4);
    const nextUploads = await Promise.all(imageFiles.map((f) => fileToUploadImage(f)));
    setAttachedImages((prev) => [...prev, ...nextUploads].slice(0, 4));
    event.target.value = "";
  }

  function removeImageAt(index: number) {
    setAttachedImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function stopVoiceInput() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function startVoiceInput() {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    if (!recognitionRef.current) {
      const recognition = new Ctor();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i += 1) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript.trim());
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }

    setIsListening(true);
    recognitionRef.current.start();
  }

  async function handleSend() {
    const text = input.trim();
    if ((!text && attachedImages.length === 0) || sending) return;

    const imagePayload = attachedImages.map((img) => ({
      imageBase64: img.imageBase64,
      mimeType: img.mimeType,
    }));

    const userMsg: UIMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text || `Shared ${attachedImages.length} image${attachedImages.length > 1 ? "s" : ""} for analysis.`,
      imagesPreview: attachedImages.map((img) => img.previewUrl),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedImages([]);
    setSending(true);
    stopVoiceInput();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, images: imagePayload }),
      });

      const data = await res.json();

      const modelMsg: UIMessage = {
        id: `temp-model-${Date.now()}`,
        role: "model",
        content: data.reply,
        foodLogged: data.foodLogged ?? undefined,
      };

      setMessages((prev) => [...prev, modelMsg]);
      if (voiceReplies && modelMsg.content) {
        speakText(modelMsg.content);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "model",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      attachedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setSending(false);
    }
  }

  async function handleClear() {
    if (!confirm("Clear all chat history?")) return;
    await fetch("/api/chat", { method: "DELETE" });
    setMessages([]);
    stopSpeaking();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend().catch(() => undefined);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">AI Nutrition Coach</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ask nutrition questions, upload food photos, or use voice chat to log meals and get coaching.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setVoiceReplies((prev) => !prev);
              if (voiceReplies) stopSpeaking();
            }}
          >
            {voiceReplies ? <Volume2 className="h-4 w-4 mr-1" /> : <VolumeX className="h-4 w-4 mr-1" />}
            {voiceReplies ? "Voice On" : "Voice Off"}
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingHistory ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className={`h-16 ${i % 2 === 0 ? "w-3/4" : "w-2/3 ml-auto"}`} />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground space-y-3">
              <Bot className="h-12 w-12 opacity-30" />
              <div>
                <p className="font-medium">Your AI Nutrition Coach</p>
                <p className="text-sm mt-1">
                  Try: "What should I eat to hit 150g of protein today?", upload a food photo, or tap the mic to talk.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  }`}
                >
                  {msg.role === "model" ? (
                    <>
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.foodLogged && <FoodLogConfirmCard entry={msg.foodLogged} />}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.imagesPreview && msg.imagesPreview.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {msg.imagesPreview.map((src, idx) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${msg.id}-img-${idx}`}
                              src={src}
                              alt={`Upload ${idx + 1}`}
                              className="h-16 w-16 rounded-md object-cover border border-border/60"
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t p-3">
          <div className="p-[1.5px] rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-500 shadow-[0_0_18px_rgba(167,139,250,0.45)]">
            <div className="bg-background rounded-[10px] px-2 py-1.5">
              {attachedImages.length > 0 ? (
                <div className="flex flex-wrap gap-2 px-1 pb-2">
                  {attachedImages.map((img, idx) => (
                    <div key={`${img.name}-${idx}`} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.previewUrl} alt={img.name} className="h-14 w-14 rounded-md object-cover border" />
                      <button
                        type="button"
                        onClick={() => removeImageAt(idx)}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border flex items-center justify-center"
                        aria-label={`Remove ${img.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImagePick}
                />
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="How can I help?"
                  className="resize-none min-h-[44px] max-h-32 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                  rows={1}
                  disabled={sending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 self-end mb-0.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || attachedImages.length >= 4}
                  aria-label="Upload image"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={isListening ? "secondary" : "ghost"}
                  size="icon"
                  className="shrink-0 self-end mb-0.5"
                  onClick={isListening ? stopVoiceInput : startVoiceInput}
                  disabled={sending}
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={() => handleSend().catch(() => undefined)}
                  disabled={(!input.trim() && attachedImages.length === 0) || sending}
                  size="icon"
                  className="shrink-0 self-end mb-0.5"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
