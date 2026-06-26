"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ExternalLink,
  GitBranch,
  GitPullRequest,
  GitFork as Github,
  Loader2,
  Lock,
  Plus,
  ScanSearch,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type RouterOutputs } from "@/trpc/react";

export type ConnectedRepo = RouterOutputs["github"]["repositories"][number];

export function RepoConnectCard({
  projectId,
  initialRepos,
  canManage,
}: {
  projectId: string;
  initialRepos: ConnectedRepo[];
  canManage: boolean;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);

  const reposQuery = api.github.repositories.useQuery(
    { projectId },
    { initialData: initialRepos, refetchOnMount: false },
  );
  const repos = reposQuery.data ?? initialRepos;

  const disconnect = api.github.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Repository disconnected.");
      void utils.github.repositories.invalidate({ projectId });
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const analyze = api.coding.analyzeRepo.useMutation({
    onSuccess: () => {
      toast.success("Analyzing repository — grounding the coding agent.");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Github className="size-4 text-primary" />
            Repositories
          </CardTitle>
          <CardDescription>
            Connect GitHub repositories so pull requests flow into the review
            pipeline.
          </CardDescription>
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" />
            Connect
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {repos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No repositories connected yet.
            {canManage ? " Connect one to start tracking PRs." : ""}
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-lg border border-border">
            {repos.map((repo) => (
              <li
                key={repo.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium"
                  >
                    <span className="truncate">{repo.fullName}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <GitBranch className="size-3" />
                      {repo.defaultBranch}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <GitPullRequest className="size-3" />
                      {repo.pullRequestCount}{" "}
                      {repo.pullRequestCount === 1 ? "PR" : "PRs"}
                    </span>
                    {repo.private && (
                      <span className="inline-flex items-center gap-1">
                        <Lock className="size-3" />
                        Private
                      </span>
                    )}
                    <span
                      className="inline-flex items-center gap-1"
                      title="Repository analysis grounds the AI coding agent."
                    >
                      <ScanSearch className="size-3" />
                      {repo.analyzedAt ? "Analyzed" : "Analysis pending"}
                    </span>
                    {!repo.connected && (
                      <span className="text-destructive">Installation removed</span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Re-analyze ${repo.fullName}`}
                      title="Re-analyze repository"
                      className="text-muted-foreground hover:text-foreground"
                      disabled={analyze.isPending || !repo.connected}
                      onClick={() => analyze.mutate({ repositoryId: repo.id })}
                    >
                      {analyze.isPending && analyze.variables?.repositoryId === repo.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ScanSearch className="size-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Disconnect ${repo.fullName}`}
                      className="text-muted-foreground hover:text-destructive"
                      disabled={disconnect.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            `Disconnect ${repo.fullName}? Tracked PRs for this repo will be removed.`,
                          )
                        ) {
                          disconnect.mutate({ repositoryId: repo.id });
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {dialogOpen && (
        <ConnectRepoDialog
          projectId={projectId}
          onClose={() => setDialogOpen(false)}
          onConnected={() => {
            setDialogOpen(false);
            void utils.github.repositories.invalidate({ projectId });
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

function ConnectRepoDialog({
  projectId,
  onClose,
  onConnected,
}: {
  projectId: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [selected, setSelected] = useState<string>("");

  const statusQuery = api.github.status.useQuery();
  const available = api.github.listAvailableRepos.useQuery(undefined, {
    // Only hit GitHub once we know an installation exists.
    enabled: (statusQuery.data?.installations.length ?? 0) > 0,
  });

  const connect = api.github.connect.useMutation({
    onSuccess: (res) => {
      toast.success(`Connected ${res.fullName}. Backfilling open PRs…`);
      onConnected();
    },
    onError: (e) => toast.error(e.message),
  });

  const noInstall =
    statusQuery.data != null && statusQuery.data.installations.length === 0;
  const repos = available.data?.repos ?? [];
  const loading = statusQuery.isLoading || available.isLoading;

  function submit() {
    if (!selected) return;
    const [installationId, githubIdStr] = selected.split("|");
    if (!installationId || !githubIdStr) return;
    connect.mutate({
      installationId,
      projectId,
      githubId: Number(githubIdStr),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect a repository</DialogTitle>
          <DialogDescription>
            Pick a repository the ZenBuild GitHub App can access. Its open pull
            requests are imported automatically.
          </DialogDescription>
        </DialogHeader>

        {noInstall ? (
          <div className="text-muted-foreground rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-sm">
            No GitHub App installation found. Install it first from{" "}
            <Link href="/settings/integrations" className="text-primary underline">
              Settings → Integrations
            </Link>
            .
          </div>
        ) : loading ? (
          <div className="text-muted-foreground flex items-center gap-2 px-1 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading repositories…
          </div>
        ) : repos.length === 0 ? (
          <p className="text-muted-foreground px-1 py-4 text-sm">
            No new repositories available. They may already be connected, or you
            can grant the app access to more repos on GitHub.
          </p>
        ) : (
          <div className="py-1">
            <Select value={selected} onValueChange={(v) => setSelected(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select a repository" />
              </SelectTrigger>
              <SelectContent>
                {repos.map((r) => (
                  <SelectItem
                    key={`${r.installationDbId}|${r.githubId}`}
                    value={`${r.installationDbId}|${r.githubId}`}
                  >
                    {r.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={connect.isPending}>
            Cancel
          </Button>
          <Button
            className="gap-1.5"
            disabled={!selected || connect.isPending || noInstall}
            onClick={submit}
          >
            {connect.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Github className="size-4" />
            )}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
