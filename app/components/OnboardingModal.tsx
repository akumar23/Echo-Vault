"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";

import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { SettingsUpdate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const URL_PLACEHOLDER = "http://host.docker.internal:11434";

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function OnboardingModal() {
  const { user, loading: authLoading } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const { toast } = useToast();

  const [generationUrl, setGenerationUrl] = useState("");
  const [generationToken, setGenerationToken] = useState("");
  const [generationModel, setGenerationModel] = useState("");
  const [embeddingUrl, setEmbeddingUrl] = useState("");
  const [embeddingToken, setEmbeddingToken] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [error, setError] = useState("");

  const shouldShow =
    !authLoading &&
    !settingsLoading &&
    !!user &&
    !!settings &&
    !settings.onboarding_completed;

  if (!shouldShow) return null;

  const handleSkip = () => {
    updateMutation.mutate(
      { onboarding_completed: true },
      {
        onSuccess: () => {
          toast({
            message: "Using default LLM settings. You can change this anytime in Settings.",
            type: "info",
          });
        },
      },
    );
  };

  const handleSave = () => {
    if (!isValidUrl(generationUrl) || !isValidUrl(embeddingUrl)) {
      setError("Please enter valid http:// or https:// URLs.");
      return;
    }
    setError("");

    const update: SettingsUpdate = {
      onboarding_completed: true,
      generation_url: generationUrl || null,
      generation_model: generationModel || null,
      embedding_url: embeddingUrl || null,
      embedding_model: embeddingModel || null,
    };
    if (generationToken) update.generation_api_token = generationToken;
    if (embeddingToken) update.embedding_api_token = embeddingToken;

    updateMutation.mutate(update, {
      onSuccess: () => {
        toast({ message: "LLM settings saved!", type: "success" });
      },
      onError: () => {
        setError("Could not save settings. Please try again.");
      },
    });
  };

  return (
    <Dialog open onOpenChange={() => { /* dismiss only via skip/save */ }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium">Welcome to EchoVault</span>
          </div>
          <DialogTitle>Configure your LLM (optional)</DialogTitle>
          <DialogDescription>
            EchoVault uses an LLM for reflections, mood analysis, and semantic
            search. Point it at local Ollama, OpenAI, or any compatible API —
            or skip and use the server defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Text Generation
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="onboard-gen-url">API URL</Label>
              <Input
                id="onboard-gen-url"
                type="url"
                value={generationUrl}
                onChange={(e) => setGenerationUrl(e.target.value)}
                placeholder={URL_PLACEHOLDER}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="onboard-gen-token">API Token</Label>
                <Input
                  id="onboard-gen-token"
                  type="password"
                  value={generationToken}
                  onChange={(e) => setGenerationToken(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onboard-gen-model">Model</Label>
                <Input
                  id="onboard-gen-model"
                  value={generationModel}
                  onChange={(e) => setGenerationModel(e.target.value)}
                  placeholder="llama3.1:8b"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">
              Embeddings
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="onboard-emb-url">API URL</Label>
              <Input
                id="onboard-emb-url"
                type="url"
                value={embeddingUrl}
                onChange={(e) => setEmbeddingUrl(e.target.value)}
                placeholder={URL_PLACEHOLDER}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="onboard-emb-token">API Token</Label>
                <Input
                  id="onboard-emb-token"
                  type="password"
                  value={embeddingToken}
                  onChange={(e) => setEmbeddingToken(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onboard-emb-model">Model</Label>
                <Input
                  id="onboard-emb-model"
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  placeholder="mxbai-embed-large"
                />
              </div>
            </div>
          </section>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Need help? See{" "}
            <Link
              href="/settings"
              className="underline underline-offset-2 hover:text-foreground"
            >
              full Settings
            </Link>{" "}
            for advanced options.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={updateMutation.isPending}
          >
            Skip — use defaults
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & continue"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
