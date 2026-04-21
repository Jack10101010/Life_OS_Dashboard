import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  ControlsPanelShell,
  PanelActionRow,
  PanelFieldRow,
  PanelRowLabel,
  PanelSection,
  PanelSectionTitle,
} from "../layout/LayoutPrimitives";
import { Button, IconButton } from "../ui/Button";

interface VisionCardProps {
  imageUrl: string;
  text: string;
  notes?: string;
  canUploadImage?: boolean;
  hasImage?: boolean;
  onUploadImage?: () => void;
  onRemoveImage?: () => void;
  onTextChange?: (value: string) => void;
  imageClassName?: string;
  imageFit?: "cover" | "contain";
  imageBrightness?: number;
  imageSaturation?: number;
  imageOpacityClassName?: string;
  imageOverlayBackground?: string;
  onImageBrightnessChange?: (value: number) => void;
}

export default function VisionCard({
  imageUrl,
  text,
  notes,
  canUploadImage = false,
  hasImage = false,
  onUploadImage,
  onRemoveImage,
  onTextChange,
  imageClassName = "h-44",
  imageFit = "cover",
  imageBrightness = 0.7,
  imageSaturation = 0.8,
  imageOpacityClassName = "opacity-60",
  imageOverlayBackground = "linear-gradient(180deg, transparent 0%, rgba(10,11,15,0.6) 100%)",
  onImageBrightnessChange,
}: VisionCardProps) {
  const [actionsOpen, setActionsOpen] = React.useState(false);
  const [textEditing, setTextEditing] = React.useState(false);
  const [textDraft, setTextDraft] = React.useState(text);
  const textEditorRef = React.useRef<HTMLTextAreaElement | null>(null);
  const panelRef = React.useRef<HTMLElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const hasImageActions = Boolean(onUploadImage || onRemoveImage || onTextChange || (hasImage && onImageBrightnessChange));

  React.useEffect(() => {
    if (!textEditing) {
      setTextDraft(text);
    }
  }, [text, textEditing]);

  React.useEffect(() => {
    if (!textEditing) return;
    const editor = textEditorRef.current;
    if (!editor) return;
    const caretPosition = editor.value.length;
    editor.focus();
    editor.setSelectionRange(caretPosition, caretPosition);
  }, [textEditing]);

  const startTextEdit = () => {
    setTextDraft(text);
    setActionsOpen(false);
    setTextEditing(true);
  };

  const saveTextEdit = () => {
    onTextChange?.(textDraft.trim());
    setTextEditing(false);
  };

  const cancelTextEdit = () => {
    setTextDraft(text);
    setTextEditing(false);
  };

  React.useEffect(() => {
    if (!actionsOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setActionsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionsOpen]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
          Vision
        </h2>
        {hasImageActions && (
          <div className="relative">
            <IconButton
              ref={triggerRef}
              icon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => setActionsOpen((current) => !current)}
              variant="muted"
              size="sm"
              ariaLabel="Open vision image controls"
              aria-expanded={actionsOpen}
            />
            {actionsOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-[260px] max-w-[calc(100vw-32px)]">
                <ControlsPanelShell
                  ref={panelRef}
                  emphasis="strong"
                  scrollable
                >
                  <PanelSection>
                    <PanelSectionTitle>Image</PanelSectionTitle>
                    {!hasImage ? (
                      <PanelActionRow
                        as="button"
                        type="button"
                        onClick={() => {
                          onUploadImage?.();
                          setActionsOpen(false);
                        }}
                        disabled={!canUploadImage || !onUploadImage}
                      >
                        <PanelRowLabel>Add image</PanelRowLabel>
                      </PanelActionRow>
                    ) : (
                      <>
                        <PanelActionRow
                          as="button"
                          type="button"
                          onClick={() => {
                            onUploadImage?.();
                            setActionsOpen(false);
                          }}
                          disabled={!canUploadImage || !onUploadImage}
                        >
                          <PanelRowLabel>Change image</PanelRowLabel>
                        </PanelActionRow>
                        <PanelActionRow
                          as="button"
                          type="button"
                          onClick={() => {
                            onRemoveImage?.();
                            setActionsOpen(false);
                          }}
                          disabled={!onRemoveImage}
                        >
                          <PanelRowLabel>Remove image</PanelRowLabel>
                        </PanelActionRow>
                      </>
                    )}
                  </PanelSection>
                  {onTextChange && (
                    <PanelSection>
                      <PanelSectionTitle>Text</PanelSectionTitle>
                      <PanelActionRow
                        as="button"
                        type="button"
                        onClick={startTextEdit}
                      >
                        <PanelRowLabel>Edit why</PanelRowLabel>
                      </PanelActionRow>
                    </PanelSection>
                  )}
                {hasImage && onImageBrightnessChange && (
                  <PanelSection>
                    <PanelSectionTitle>Display</PanelSectionTitle>
                    <PanelFieldRow>
                      <PanelRowLabel
                        as="label"
                        htmlFor="atoms-vision-brightness"
                      >
                        Brightness
                      </PanelRowLabel>
                      <span className="text-[10px] tabular-nums text-slate-500">
                        {imageBrightness.toFixed(2)}
                      </span>
                    </PanelFieldRow>
                    <input
                      id="atoms-vision-brightness"
                      type="range"
                      min="0.45"
                      max="1"
                      step="0.01"
                      value={imageBrightness}
                      onChange={(event) => onImageBrightnessChange(Number(event.target.value))}
                      className="mt-2 block w-full accent-indigo-400"
                    />
                  </PanelSection>
                )}
                </ControlsPanelShell>
              </div>
            )}
          </div>
        )}
      </div>

      {hasImage ? (
        <>
          {/* Image with darkened overlay */}
          <div className="relative rounded-xl overflow-hidden mb-5">
            <img
              src={imageUrl}
              alt="Goal vision"
              className={`w-full ${imageClassName} ${imageFit === "contain" ? "object-contain" : "object-cover"} ${imageOpacityClassName}`}
              style={{
                filter: `brightness(${imageBrightness}) saturate(${imageSaturation})`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: imageOverlayBackground,
              }}
            />
          </div>

          {/* Vision text — reflective, generous spacing */}
          {textEditing ? (
            <div className="mb-5">
              <textarea
                ref={textEditorRef}
                value={textDraft}
                onChange={(event) => setTextDraft(event.target.value)}
                className="min-h-[104px] w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-sm leading-relaxed text-slate-300 outline-none transition focus:border-emerald-400/20 focus:bg-white/[0.035]"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <Button type="button" variant="panel-link" onClick={cancelTextEdit}>
                  Cancel
                </Button>
                <Button type="button" variant="panel-link" onClick={saveTextEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-5">
              <p className="line-clamp-5 text-sm text-slate-400 leading-relaxed italic">
                {text}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="relative mb-5 flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl border border-white/[0.045] bg-[radial-gradient(circle_at_50%_45%,rgba(16,185,129,0.025),rgba(255,255,255,0.012)_44%,rgba(255,255,255,0.006)_100%)] px-8 py-10 text-center">
          {textEditing ? (
            <div className="w-full max-w-[32rem]">
              <textarea
                ref={textEditorRef}
                value={textDraft}
                onChange={(event) => setTextDraft(event.target.value)}
                className="min-h-[160px] w-full resize-none rounded-xl border border-white/[0.06] bg-black/10 px-4 py-3 text-center text-[18px] font-medium leading-8 text-slate-200/88 outline-none transition focus:border-emerald-400/20 focus:bg-black/15"
              />
              <div className="mt-3 flex items-center justify-center gap-2">
                <Button type="button" variant="panel-link" onClick={cancelTextEdit}>
                  Cancel
                </Button>
                <Button type="button" variant="panel-link" onClick={saveTextEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="line-clamp-5 max-w-[32rem] text-[18px] font-medium leading-8 text-slate-200/88 italic">
              {text}
            </p>
          )}
        </div>
      )}

      {/* Optional notes — minimal, tucked beneath */}
      {notes && (
        <div className="mt-auto pt-4 border-t border-[#1A1D26]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
            Notes
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">{notes}</p>
        </div>
      )}

    </div>
  );
}
