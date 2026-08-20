"use client";

import type { ChatStatus } from "ai";
import type { LucideIcon } from "lucide-react";
import {
  BrainIcon,
  Film,
  Gauge,
  Globe,
  Image as ImageIcon,
  Mic,
  Sparkle,
  Zap,
  XIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
import {
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
} from "@/components/ai-elements/prompt-input";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { Composer, type ComposerMessage } from "@/components/chat/composer";
import { ChatComposerModelPicker } from "@/components/chat/chat-composer-model-picker";
import { useAvailableModels } from "@/hooks/use-available-models";
import {
  isReasoningEffort,
  OPENAI_FAST_MODE_MULTIPLIER,
  OPENAI_PRO_MODE_MULTIPLIER,
  type ModelDefinition,
  type ReasoningEffort,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenuCheckboxItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type { ComposerMessage };

export type ModelOption = ModelDefinition;

type ToolChipProps = {
  icon: LucideIcon;
  label: string;
  onRemove: () => void;
};

function ToolChip({ icon: Icon, label, onRemove }: ToolChipProps) {
  const t = useExtracted();

  return (
    <Button
      variant="ghost"
      className="group flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      onClick={onRemove}
      aria-label={t("Remove {label}", { label })}
    >
      <Icon className="size-3.5 group-hover:hidden" aria-hidden="true" />
      <XIcon className="size-3.5 hidden group-hover:block" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}

export interface ChatComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (
    message: ComposerMessage,
    options: {
      model: string;
      webSearch: boolean;
      videoMode: boolean;
      imageMode: boolean;
      reasoningEffort: ReasoningEffort;
      proMode: boolean;
      fastMode: boolean;
      deepResearch: boolean;
    },
  ) => void;
  onStop?: () => void;
  placeholder?: string;
  className?: string;
  status?: ChatStatus;
  isSubmitDisabled?: boolean;
  model: string;
  onModelChange: (model: string) => void;
  webSearch: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  videoMode: boolean;
  onVideoModeChange: (enabled: boolean) => void;
  imageMode: boolean;
  onImageModeChange: (enabled: boolean) => void;
  reasoningEffort: ReasoningEffort;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
  proMode: boolean;
  onProModeChange: (enabled: boolean) => void;
  fastMode: boolean;
  onFastModeChange: (enabled: boolean) => void;
  deepResearch: boolean;
  onDeepResearchChange: (enabled: boolean) => void;
  showByokBadge?: boolean;
}

export function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  placeholder,
  className,
  status,
  isSubmitDisabled,
  model,
  onModelChange,
  webSearch,
  onWebSearchChange,
  videoMode,
  onVideoModeChange,
  imageMode,
  onImageModeChange,
  reasoningEffort,
  onReasoningEffortChange,
  proMode,
  onProModeChange,
  fastMode,
  onFastModeChange,
  deepResearch,
  onDeepResearchChange,
  showByokBadge = false,
}: ChatComposerProps) {
  const t = useExtracted();
  const { availableModels } = useAvailableModels();
  const selectedModel = availableModels.find((m) => m.value === model);
  const supportedEfforts = selectedModel?.efforts ?? false;
  const supportsReasoningEffort = supportedEfforts !== false;
  const supportsProMode = Boolean(selectedModel?.supportsProMode);
  const supportsFastMode = Boolean(selectedModel?.supportsFastMode);
  const getReasoningEffortLabel = (effort: ReasoningEffort) => {
    switch (effort) {
      case "none":
        return t("None");
      case "minimal":
        return t("Minimal");
      case "low":
        return t("Low");
      case "medium":
        return t("Medium");
      case "high":
        return t("High");
      case "xhigh":
        return t("X-High");
      case "max":
        return t("Max");
      default:
        return effort;
    }
  };

  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFocusComposer = () => {
      const textarea = composerRef.current?.querySelector<HTMLTextAreaElement>(
        'textarea[name="message"]',
      );
      textarea?.focus();
    };
    window.addEventListener("deni:focus-composer", handleFocusComposer);
    return () => window.removeEventListener("deni:focus-composer", handleFocusComposer);
  }, []);

  const reasoningEffortLabel = getReasoningEffortLabel(reasoningEffort);

  const handleVideoToggle = (enabled: boolean) => {
    onVideoModeChange(enabled);
    if (enabled) {
      onWebSearchChange(false);
      onImageModeChange(false);
    }
  };

  const handleImageToggle = (enabled: boolean) => {
    onImageModeChange(enabled);
    if (enabled) {
      onWebSearchChange(false);
      onVideoModeChange(false);
    }
  };

  const handleSearchToggle = (enabled: boolean) => {
    onWebSearchChange(enabled);
    if (enabled) {
      onVideoModeChange(false);
      onImageModeChange(false);
    }
    if (!enabled) {
      onDeepResearchChange(false);
    }
  };

  const handleResearchToggle = (enabled: boolean) => {
    onDeepResearchChange(enabled);
    if (enabled) {
      onWebSearchChange(true);
      onVideoModeChange(false);
      onImageModeChange(false);
    }
  };

  const handleSubmit = (message: ComposerMessage) => {
    onSubmit(message, {
      model,
      webSearch,
      videoMode,
      imageMode,
      reasoningEffort,
      proMode: supportsProMode && proMode,
      fastMode: supportsFastMode && fastMode,
      deepResearch,
    });
  };

  const proModeTitle = t(
    "Pro mode uses deeper multi-pass reasoning ({multiplier}× premium usage)",
    {
      multiplier: String(OPENAI_PRO_MODE_MULTIPLIER),
    },
  );
  const fastModeTitle = t(
    "Fast mode uses priority processing for lower latency ({multiplier}× usage)",
    {
      multiplier: String(OPENAI_FAST_MODE_MULTIPLIER),
    },
  );

  const renderReasoningEffortSelector = (triggerClassName?: string) => (
    <PromptInputSelect
      value={reasoningEffort}
      onValueChange={(value) => {
        if (isReasoningEffort(value)) {
          onReasoningEffortChange(value);
        }
      }}
      disabled={!supportsReasoningEffort}
    >
      <PromptInputSelectTrigger className={cn(triggerClassName)}>
        <PromptInputSelectValue>
          <BrainIcon className="size-4" aria-hidden="true" />
          {reasoningEffortLabel}
        </PromptInputSelectValue>
      </PromptInputSelectTrigger>
      <PromptInputSelectContent>
        {supportedEfforts !== false &&
          supportedEfforts.map((effort) => (
            <PromptInputSelectItem key={effort} value={effort}>
              {getReasoningEffortLabel(effort)}
            </PromptInputSelectItem>
          ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  );

  const resolvedPlaceholder =
    placeholder ??
    (videoMode
      ? t("Describe the video scene, style, motion, and lighting.")
      : imageMode
        ? t("Describe the image you want to generate.")
        : undefined);

  return (
    <div ref={composerRef}>
      <Composer
        onSubmit={handleSubmit}
        onStop={onStop}
        className={className}
        globalDrop
        multiple
        placeholder={resolvedPlaceholder}
        headerClassName="py-0.5!"
        value={value}
        onValueChange={onValueChange}
        status={status}
        isSubmitDisabled={isSubmitDisabled}
        actionMenuItems={
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={videoMode}
              onCheckedChange={(checked) => handleVideoToggle(Boolean(checked))}
            >
              <Film className="size-4" aria-hidden="true" />
              {t("Video")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={imageMode}
              onCheckedChange={(checked) => handleImageToggle(Boolean(checked))}
            >
              <ImageIcon className="size-4" aria-hidden="true" />
              {t("Image")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={webSearch}
              onCheckedChange={(checked) => handleSearchToggle(Boolean(checked))}
            >
              <Globe className="size-4" aria-hidden="true" />
              {t("Search")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={deepResearch}
              onCheckedChange={(checked) => handleResearchToggle(Boolean(checked))}
            >
              <Sparkle className="size-4" aria-hidden="true" />
              {t("Deep Research")}
            </DropdownMenuCheckboxItem>
            {supportsFastMode && (
              <DropdownMenuCheckboxItem
                checked={fastMode}
                onCheckedChange={(checked) => onFastModeChange(Boolean(checked))}
              >
                <Gauge className="size-4" aria-hidden="true" />
                {t("Fast")}
              </DropdownMenuCheckboxItem>
            )}
            {supportsProMode && (
              <DropdownMenuCheckboxItem
                checked={proMode}
                onCheckedChange={(checked) => onProModeChange(Boolean(checked))}
              >
                <Zap className="size-4" aria-hidden="true" />
                {t("Pro")}
              </DropdownMenuCheckboxItem>
            )}
            <div className="px-2 py-1.5 md:hidden">
              {renderReasoningEffortSelector("w-full justify-between")}
            </div>
          </>
        }
        tools={
          <>
            {videoMode && (
              <ToolChip icon={Film} label={t("Video")} onRemove={() => handleVideoToggle(false)} />
            )}
            {imageMode && (
              <ToolChip
                icon={ImageIcon}
                label={t("Image")}
                onRemove={() => handleImageToggle(false)}
              />
            )}
            {webSearch && (
              <ToolChip
                icon={Globe}
                label={t("Search")}
                onRemove={() => handleSearchToggle(false)}
              />
            )}
            {deepResearch && (
              <ToolChip
                icon={Sparkle}
                label={t("Deep Research")}
                onRemove={() => handleResearchToggle(false)}
              />
            )}
            <SpeechInput
              size="icon-sm"
              variant="ghost"
              className="size-8 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t("Voice input")}
              title={t("Voice input")}
              onTranscriptionChange={(transcript) => {
                const nextValue = value.trim() ? `${value.trim()} ${transcript}` : transcript;
                onValueChange(nextValue.trim());
              }}
            >
              <Mic className="size-4" />
            </SpeechInput>

            <ChatComposerModelPicker
              model={model}
              onModelChange={onModelChange}
              availableModels={availableModels}
              selectedModel={selectedModel}
              showByokBadge={showByokBadge}
            />

            <div className="hidden md:flex md:items-center md:gap-1">
              {renderReasoningEffortSelector()}
              {supportsFastMode && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={fastMode ? "secondary" : "ghost"}
                        size="icon-sm"
                        className={cn(
                          "size-8",
                          fastMode
                            ? "bg-sky-500/15 text-sky-700 hover:bg-sky-500/20 dark:text-sky-400"
                            : "text-muted-foreground",
                        )}
                        aria-pressed={fastMode}
                        aria-label={t("Fast")}
                        onClick={() => onFastModeChange(!fastMode)}
                      >
                        <Gauge className="size-3.5" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{fastModeTitle}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {supportsProMode && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={proMode ? "secondary" : "ghost"}
                        size="icon-sm"
                        className={cn(
                          "size-8",
                          proMode
                            ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                            : "text-muted-foreground",
                        )}
                        aria-pressed={proMode}
                        aria-label={t("Pro")}
                        onClick={() => onProModeChange(!proMode)}
                      >
                        <Zap className="size-3.5" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{proModeTitle}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </>
        }
      />
    </div>
  );
}
