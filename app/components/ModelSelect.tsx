"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, RefreshCw } from "lucide-react";

import { useLLMModels } from "@/hooks/useLLMModels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function isHttpUrl(value: string): boolean {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

interface ModelSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  url: string;
  apiToken: string;
  urlValid: boolean;
  tokenSet?: boolean;
  serviceType?: "generation" | "embedding";
  placeholder?: string;
}

export function ModelSelect({
  id,
  value,
  onChange,
  url,
  apiToken,
  urlValid,
  tokenSet = false,
  serviceType = "generation",
  placeholder = "llama3.1:8b, gpt-4o-mini, …",
}: ModelSelectProps) {
  const [filter, setFilter] = useState("");
  const canFetch = urlValid && isHttpUrl(url);
  const { data, isFetching, isError, refetch } = useLLMModels(
    url,
    apiToken,
    canFetch,
    tokenSet,
    serviceType,
  );

  const models = useMemo(
    () => (data?.ok ? data.models : []),
    [data],
  );
  const providerMessage = data?.message;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return models;
    return models.filter((model) => model.toLowerCase().includes(q));
  }, [models, filter]);

  const hint = !canFetch
    ? "Fix the API URL to load models from this endpoint."
    : isFetching
      ? "Loading models from this endpoint…"
      : isError
        ? "Couldn't reach EchoVault to list models. Enter a name manually."
        : data && !data.ok
          ? `${data.message} You can still type a name.`
          : models.length > 0
            ? `${providerMessage} Pick one or type a custom name.`
            : "Leave empty to use the default model.";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          className="flex-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <DropdownMenu
          onOpenChange={(open) => {
            if (!open) setFilter("");
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Choose from available models"
              aria-label="Choose from available models"
              disabled={!canFetch}
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between gap-2 font-normal">
              <span className="text-muted-foreground">
                {isFetching
                  ? "Loading models…"
                  : models.length > 0
                    ? serviceType === "embedding"
                      ? "Embedding models on this endpoint"
                      : "Models on this endpoint"
                    : "No models listed"}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void refetch();
                }}
              >
                <RefreshCw
                  className={cn("h-3 w-3", isFetching && "animate-spin")}
                />
                Refresh
              </button>
            </DropdownMenuLabel>
            {models.length > 8 && (
              <div className="px-1.5 pb-1.5">
                <Input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter models…"
                  className="h-8"
                  onKeyDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <DropdownMenuSeparator />
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                {isFetching
                  ? "Fetching…"
                  : models.length > 0
                    ? "No models match that filter."
                    : (providerMessage ??
                      "Enter a model name in the field.")}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {filtered.map((model) => {
                  const selected = model === value;
                  return (
                    <DropdownMenuItem
                      key={model}
                      onSelect={() => onChange(model)}
                      className="justify-between"
                    >
                      <span className="truncate font-mono text-xs">
                        {model}
                      </span>
                      {selected && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
