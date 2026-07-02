"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/trpc/react";
import type { FeatureRequestStatus } from "@/lib/feature-request";

type Decision = "ASK" | "EDUCATE" | "PROCEED";

export interface ClarificationMessageView {
  id: string;
  role: "AGENT" | "USER";
  content: string;
  metadata: { decision?: Decision; questions?: string[] } | null;
  createdAt: Date;
}

const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING"]);

export function DiscoveryPanel({
  featureRequestId,
  status,
  messages,
  hasPrd,
}: {
  featureRequestId: string;
  status: FeatureRequestStatus;
  messages: ClarificationMessageView[];
  hasPrd: boolean;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  // Echo the user's answer into the chat immediately — the agent should feel
  // like a conversation partner, not a form submission.
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  // While a run is active we poll; once it settles we refresh server data once.
  const [polling, setPolling] = useState(false);
  const wasActive = useRef(false);

  const runQuery = api.workflowRun.latest.useQuery(
    { featureRequestId },
    { refetchInterval: polling ? 1500 : false },
  );

  const run = runQuery.data;
  const runActive = run ? ACTIVE_STATUSES.has(run.status) : false;

  // Start polling whenever we observe an active run.
  useEffect(() => {
    if (runActive) {
      setPolling(true);
      wasActive.current = true;
    }
  }, [runActive]);

  // When an active run settles, pull fresh server data (new messages / PRD) once.
  useEffect(() => {
    if (polling && wasActive.current && run && !runActive) {
      wasActive.current = false;
      setPolling(false);
      setPendingAnswer(null);
      if (run.status === "FAILED") {
        toast.error(run.error ?? "The workflow failed.");
      }
      router.refresh();
    }
  }, [polling, run, runActive, router]);

  function onTriggered(workflowRunId: string) {
    void workflowRunId;
    setPolling(true);
    wasActive.current = true;
    void runQuery.refetch();
  }

  const start = api.clarification.start.useMutation({
    onSuccess: (r) => onTriggered(r.workflowRunId),
    onError: (e) => toast.error(e.message),
  });
  const answerMut = api.clarification.answer.useMutation({
    onSuccess: (r) => {
      setAnswer("");
      onTriggered(r.workflowRunId);
    },
    onError: (e) => {
      setPendingAnswer(null);
      toast.error(e.message);
    },
  });
  const generatePrd = api.prd.generate.useMutation({
    onSuccess: (r) => onTriggered(r.workflowRunId),
    onError: (e) => toast.error(e.message),
  });

  const busy =
    polling ||
    runActive ||
    start.isPending ||
    answerMut.isPending ||
    generatePrd.isPending;

  // The latest run failed and nothing new is in flight: say so, persistently.
  // A transient toast is not enough — the user must see why nothing happened.
  const failed = !busy && run?.status === "FAILED";

  const lastAgent = [...messages].reverse().find((m) => m.role === "AGENT");
  const decision = lastAgent?.metadata?.decision;
  const awaitingAnswer = decision === "ASK";
  const canGeneratePrd =
    !hasPrd &&
    (status === "CLARIFYING" || status === "PRD_DRAFTED") &&
    (decision === "PROCEED" || decision === "EDUCATE" || decision === "ASK");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          Product discovery
        </CardTitle>
        <CardDescription>
          The AI product agent clarifies missing context, flags duplicates, and
          drafts a PRD.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {failed && (
          <Alert variant="destructive">
            <AlertTitle>The last discovery run didn't complete</AlertTitle>
            <AlertDescription>
              {run?.error ??
                "The workflow failed. Try again — if it keeps happening, the background worker may be offline."}
            </AlertDescription>
          </Alert>
        )}

        {messages.length === 0 && !busy ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm leading-relaxed">
              No discovery yet. Let the agent analyze this request — it will ask
              follow-up questions, flag it as a possible duplicate, or proceed to
              a PRD.
            </p>
            <Button
              className="gap-1.5"
              disabled={busy}
              onClick={() => start.mutate({ featureRequestId })}
            >
              <Sparkles className="size-4" />
              Start product discovery
            </Button>
          </div>
        ) : (
          <ul className="app-chat">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`app-chat-msg ${m.role === "AGENT" ? "is-agent" : "is-user"}`}
              >
                <span className="app-chat-avatar">
                  {m.role === "AGENT" ? (
                    <Bot className="size-3.5" />
                  ) : (
                    <User className="size-3.5" />
                  )}
                </span>
                <div className="app-chat-bubble space-y-1.5">
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === "AGENT" &&
                    m.metadata?.decision === "ASK" &&
                    (m.metadata.questions?.length ?? 0) > 0 && (
                      <ul className="app-prd-list space-y-1">
                        {m.metadata.questions!.map((q, i) => (
                          <li key={i} className="text-muted-foreground">
                            {q}
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
              </li>
            ))}

            {pendingAnswer && busy && (
              <li className="app-chat-msg is-user">
                <span className="app-chat-avatar">
                  <User className="size-3.5" />
                </span>
                <div className="app-chat-bubble">
                  <p className="whitespace-pre-wrap">{pendingAnswer}</p>
                </div>
              </li>
            )}

            {busy && (
              <li className="app-chat-msg is-agent" aria-live="polite">
                <span className="app-chat-avatar">
                  <Bot className="size-3.5" />
                </span>
                <div className="app-chat-bubble">
                  <span className="app-typing" aria-hidden>
                    <span className="app-typing-dot" />
                    <span className="app-typing-dot" />
                    <span className="app-typing-dot" />
                  </span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {run?.step ?? "The agent is thinking…"}
                    {typeof run?.progress === "number" &&
                      run.progress > 0 &&
                      ` · ${run.progress}%`}
                  </span>
                </div>
              </li>
            )}
          </ul>
        )}

        {decision === "EDUCATE" && !busy && (
          <Alert>
            <AlertTitle>The agent suggests reviewing this request</AlertTitle>
            <AlertDescription>
              It may already be possible or duplicate existing work. You can still
              proceed to a PRD if you want to build it.
            </AlertDescription>
          </Alert>
        )}

        {awaitingAnswer && !busy && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPendingAnswer(answer.trim());
              answerMut.mutate({ featureRequestId, content: answer.trim() });
            }}
          >
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Answer the agent's questions to refine the request…"
              rows={3}
              disabled={busy}
              className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:opacity-50"
            />
            <div className="flex flex-wrap justify-end gap-2">
              {canGeneratePrd && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => generatePrd.mutate({ featureRequestId })}
                >
                  <Sparkles className="size-4" />
                  Skip & generate PRD
                </Button>
              )}
              <Button type="submit" className="gap-1.5" disabled={busy || !answer.trim()}>
                <Send className="size-4" />
                Send answer
              </Button>
            </div>
          </form>
        )}

        {!awaitingAnswer && canGeneratePrd && !busy && (
          <Button
            className="gap-1.5"
            disabled={busy}
            onClick={() => generatePrd.mutate({ featureRequestId })}
          >
            <Sparkles className="size-4" />
            {decision === "PROCEED" ? "Generate PRD" : "Generate PRD anyway"}
          </Button>
        )}

        {hasPrd && !busy && (status === "CLARIFYING" || status === "PRD_DRAFTED") && (
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={() => generatePrd.mutate({ featureRequestId })}
          >
            <Sparkles className="size-4" />
            Regenerate PRD
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
