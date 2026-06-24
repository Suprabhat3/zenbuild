"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  Eye,
  FileText,
  History,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PrdView } from "@/components/app/prd-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import type { FeatureRequestStatus } from "@/lib/feature-request";

interface UserStory {
  as: string;
  want: string;
  soThat: string;
}

export interface PrdContent {
  title: string;
  problemStatement: string;
  goals: string[];
  nonGoals: string[];
  userStories: UserStory[];
  acceptanceCriteria: string[];
  edgeCases: string[];
  successMetrics: string[];
}

type SectionKey = keyof PrdContent;
type ListSectionKey =
  | "goals"
  | "nonGoals"
  | "acceptanceCriteria"
  | "edgeCases"
  | "successMetrics";

const SECTION_LABELS: Record<SectionKey, string> = {
  title: "Title",
  problemStatement: "Problem statement",
  goals: "Goals",
  nonGoals: "Non-goals",
  userStories: "User stories",
  acceptanceCriteria: "Acceptance criteria",
  edgeCases: "Edge cases",
  successMetrics: "Success metrics",
};

const textareaClass =
  "border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:opacity-50";

function clone(content: PrdContent): PrdContent {
  return {
    ...content,
    goals: [...content.goals],
    nonGoals: [...content.nonGoals],
    userStories: content.userStories.map((s) => ({ ...s })),
    acceptanceCriteria: [...content.acceptanceCriteria],
    edgeCases: [...content.edgeCases],
    successMetrics: [...content.successMetrics],
  };
}

export function PrdEditor({
  featureRequestId,
  content,
  version,
  approvedAt,
  status,
  canApprove,
}: {
  featureRequestId: string;
  content: PrdContent;
  version: number;
  approvedAt: Date | null;
  status: FeatureRequestStatus;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState<PrdContent>(() => clone(content));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [regenSection, setRegenSection] = useState<SectionKey | null>(null);
  const [regenInstruction, setRegenInstruction] = useState("");

  // Editing is only possible before approval and while the request is still in
  // the draft stage; later lifecycle states (TASKS_READY, …) lock the PRD.
  const editable = !approvedAt && status === "PRD_DRAFTED";

  const save = api.prd.update.useMutation({
    onSuccess: () => {
      toast.success("PRD saved.");
      setMode("view");
      setPreview(false);
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const regenerate = api.prd.regenerateSection.useMutation({
    onSuccess: (r) => {
      setDraft((d) => ({ ...d, [r.section]: r.value }) as PrdContent);
      setRegenSection(null);
      setRegenInstruction("");
      toast.success(`${SECTION_LABELS[r.section as SectionKey]} regenerated.`);
    },
    onError: (e) => toast.error(e.message),
  });

  const approve = api.prd.approve.useMutation({
    onSuccess: () => {
      toast.success("PRD approved. Planning is unlocked.");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const busy = save.isPending || regenerate.isPending || approve.isPending;

  function startEdit() {
    setDraft(clone(content));
    setMode("edit");
    setPreview(false);
  }
  function cancelEdit() {
    setMode("view");
    setPreview(false);
    setRegenSection(null);
  }

  function runRegen(section: SectionKey) {
    regenerate.mutate({
      featureRequestId,
      section,
      instruction: regenInstruction.trim() || undefined,
    });
  }

  // ---- View mode -----------------------------------------------------------
  if (mode === "view") {
    return (
      <div className="space-y-4">
        <PrdView content={content} version={version} approvedAt={approvedAt} />

        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <Button className="gap-1.5" onClick={startEdit} disabled={busy}>
              <Pencil className="size-4" />
              Edit PRD
            </Button>
          )}
          {canApprove && editable && (
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={busy}
              onClick={() => approve.mutate({ featureRequestId })}
            >
              {approve.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Approve PRD
            </Button>
          )}
          <Button
            variant="ghost"
            className="gap-1.5"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="size-4" />
            Version history
          </Button>
        </div>

        {approvedAt && (
          <Alert>
            <Check className="size-4" />
            <AlertTitle>PRD approved</AlertTitle>
            <AlertDescription>
              This PRD is locked. Planning (task generation) is unlocked for this
              request.
            </AlertDescription>
          </Alert>
        )}
        {!editable && !approvedAt && (
          <p className="text-muted-foreground text-sm">
            This PRD can no longer be edited at the request’s current stage.
          </p>
        )}

        <VersionHistoryDialog
          featureRequestId={featureRequestId}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          canRestore={editable}
          onRestored={() => {
            setHistoryOpen(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  // ---- Edit mode -----------------------------------------------------------
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Edit PRD
            <Badge variant="secondary">Draft · v{version}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={preview ? "outline" : "ghost"}
              className="gap-1.5"
              onClick={() => setPreview((p) => !p)}
            >
              <Eye className="size-4" />
              {preview ? "Back to editing" : "Preview"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {preview ? (
          <PrdView content={draft} version={version} approvedAt={null} />
        ) : (
          <div className="space-y-5">
            <FieldSection
              label={SECTION_LABELS.title}
              section="title"
              regenSection={regenSection}
              setRegenSection={setRegenSection}
              regenInstruction={regenInstruction}
              setRegenInstruction={setRegenInstruction}
              onRegen={runRegen}
              regenerating={regenerate.isPending}
              busy={busy}
            >
              <Input
                value={draft.title}
                disabled={busy}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </FieldSection>

            <FieldSection
              label={SECTION_LABELS.problemStatement}
              section="problemStatement"
              regenSection={regenSection}
              setRegenSection={setRegenSection}
              regenInstruction={regenInstruction}
              setRegenInstruction={setRegenInstruction}
              onRegen={runRegen}
              regenerating={regenerate.isPending}
              busy={busy}
            >
              <textarea
                value={draft.problemStatement}
                rows={4}
                disabled={busy}
                className={textareaClass}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, problemStatement: e.target.value }))
                }
              />
            </FieldSection>

            {(["goals", "nonGoals"] as ListSectionKey[]).map((key) => (
              <FieldSection
                key={key}
                label={SECTION_LABELS[key]}
                section={key}
                regenSection={regenSection}
                setRegenSection={setRegenSection}
                regenInstruction={regenInstruction}
                setRegenInstruction={setRegenInstruction}
                onRegen={runRegen}
                regenerating={regenerate.isPending}
                busy={busy}
              >
                <ListEditor
                  items={draft[key]}
                  disabled={busy}
                  onChange={(items) =>
                    setDraft((d) => ({ ...d, [key]: items }) as PrdContent)
                  }
                />
              </FieldSection>
            ))}

            <FieldSection
              label={SECTION_LABELS.userStories}
              section="userStories"
              regenSection={regenSection}
              setRegenSection={setRegenSection}
              regenInstruction={regenInstruction}
              setRegenInstruction={setRegenInstruction}
              onRegen={runRegen}
              regenerating={regenerate.isPending}
              busy={busy}
            >
              <StoryEditor
                stories={draft.userStories}
                disabled={busy}
                onChange={(userStories) =>
                  setDraft((d) => ({ ...d, userStories }))
                }
              />
            </FieldSection>

            {(
              ["acceptanceCriteria", "edgeCases", "successMetrics"] as ListSectionKey[]
            ).map((key) => (
              <FieldSection
                key={key}
                label={SECTION_LABELS[key]}
                section={key}
                regenSection={regenSection}
                setRegenSection={setRegenSection}
                regenInstruction={regenInstruction}
                setRegenInstruction={setRegenInstruction}
                onRegen={runRegen}
                regenerating={regenerate.isPending}
                busy={busy}
              >
                <ListEditor
                  items={draft[key]}
                  disabled={busy}
                  onChange={(items) =>
                    setDraft((d) => ({ ...d, [key]: items }) as PrdContent)
                  }
                />
              </FieldSection>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={cancelEdit} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="gap-1.5"
            disabled={busy}
            onClick={() => save.mutate({ featureRequestId, content: draft })}
          >
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Save new version
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FieldSection({
  label,
  section,
  children,
  regenSection,
  setRegenSection,
  regenInstruction,
  setRegenInstruction,
  onRegen,
  regenerating,
  busy,
}: {
  label: string;
  section: SectionKey;
  children: React.ReactNode;
  regenSection: SectionKey | null;
  setRegenSection: (s: SectionKey | null) => void;
  regenInstruction: string;
  setRegenInstruction: (s: string) => void;
  onRegen: (s: SectionKey) => void;
  regenerating: boolean;
  busy: boolean;
}) {
  const open = regenSection === section;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="app-prd-section-label mb-0!">{label}</h3>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-xs"
          disabled={busy}
          onClick={() => {
            setRegenInstruction("");
            setRegenSection(open ? null : section);
          }}
        >
          <Sparkles className="size-3.5" />
          Regenerate
        </Button>
      </div>

      {open && (
        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <textarea
            value={regenInstruction}
            rows={2}
            disabled={busy}
            placeholder="Optional: how should this section change? (e.g. “make goals more measurable”)"
            className={textareaClass}
            onChange={(e) => setRegenInstruction(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setRegenSection(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => onRegen(section)}
            >
              {regenerating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Regenerate with AI
            </Button>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

function ListEditor({
  items,
  disabled,
  onChange,
}: {
  items: string[];
  disabled: boolean;
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea
            value={item}
            rows={1}
            disabled={disabled}
            className={textareaClass}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="mt-0.5 shrink-0 text-muted-foreground"
            disabled={disabled}
            aria-label="Remove item"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={disabled}
        onClick={() => onChange([...items, ""])}
      >
        <Plus className="size-4" />
        Add item
      </Button>
    </div>
  );
}

function StoryEditor({
  stories,
  disabled,
  onChange,
}: {
  stories: UserStory[];
  disabled: boolean;
  onChange: (stories: UserStory[]) => void;
}) {
  function update(i: number, patch: Partial<UserStory>) {
    const next = stories.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next);
  }
  return (
    <div className="space-y-3">
      {stories.map((s, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-border bg-card p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Story {i + 1}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground"
              disabled={disabled}
              aria-label="Remove story"
              onClick={() => onChange(stories.filter((_, idx) => idx !== i))}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={s.as}
              placeholder="As a… (role)"
              disabled={disabled}
              onChange={(e) => update(i, { as: e.target.value })}
            />
            <Input
              value={s.want}
              placeholder="I want… (goal)"
              disabled={disabled}
              onChange={(e) => update(i, { want: e.target.value })}
            />
            <Input
              value={s.soThat}
              placeholder="So that… (benefit)"
              disabled={disabled}
              onChange={(e) => update(i, { soThat: e.target.value })}
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={disabled}
        onClick={() => onChange([...stories, { as: "", want: "", soThat: "" }])}
      >
        <Plus className="size-4" />
        Add story
      </Button>
    </div>
  );
}

function VersionHistoryDialog({
  featureRequestId,
  open,
  onOpenChange,
  canRestore,
  onRestored,
}: {
  featureRequestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRestore: boolean;
  onRestored: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const versionsQuery = api.prd.versions.useQuery(
    { featureRequestId },
    { enabled: open },
  );
  const restore = api.prd.restoreVersion.useMutation({
    onSuccess: () => {
      toast.success("Version restored as a new revision.");
      onRestored();
    },
    onError: (e) => toast.error(e.message),
  });

  const versions = versionsQuery.data ?? [];
  const active = versions.find((v) => v.version === selected) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border p-6 pb-4">
          <DialogTitle>PRD version history</DialogTitle>
          <DialogDescription>
            Every save and AI regeneration creates a new version. Restore copies a
            version forward as the latest revision.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] grid-cols-[16rem_1fr] divide-x divide-border overflow-hidden">
          <ul className="overflow-y-auto p-2">
            {versionsQuery.isLoading && (
              <li className="text-muted-foreground p-3 text-sm">Loading…</li>
            )}
            {!versionsQuery.isLoading && versions.length === 0 && (
              <li className="text-muted-foreground p-3 text-sm">
                No versions yet.
              </li>
            )}
            {versions.map((v) => (
              <li key={v.version}>
                <button
                  type="button"
                  onClick={() => setSelected(v.version)}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    selected === v.version ? "bg-muted" : ""
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    v{v.version}
                    {v.isCurrent && (
                      <Badge variant="secondary" className="text-[0.625rem]">
                        Current
                      </Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(v.createdAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="overflow-y-auto p-4">
            {active ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Version {active.version}</span>
                  {canRestore && !active.isCurrent && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={restore.isPending}
                      onClick={() =>
                        restore.mutate({ featureRequestId, version: active.version })
                      }
                    >
                      {restore.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      Restore
                    </Button>
                  )}
                </div>
                <pre className="app-code max-h-[44vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
                  {active.markdown}
                </pre>
              </div>
            ) : (
              <p className="text-muted-foreground p-4 text-sm">
                Select a version to preview it.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
