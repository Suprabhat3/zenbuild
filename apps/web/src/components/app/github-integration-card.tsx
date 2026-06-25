"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { ExternalLink, GitFork as Github, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, type RouterOutputs } from "@/trpc/react";

type GithubStatus = RouterOutputs["github"]["status"];

export function GithubIntegrationCard({
  initialStatus,
  canManage,
}: {
  initialStatus: GithubStatus;
  canManage: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const handled = useRef(false);

  const statusQuery = api.github.status.useQuery(undefined, {
    initialData: initialStatus,
    refetchOnMount: false,
  });
  const status = statusQuery.data ?? initialStatus;

  // Turn the callback redirect (?github=connected|requested|error) into a toast,
  // then strip the param so a refresh doesn't re-fire it.
  useEffect(() => {
    if (handled.current) return;
    const outcome = params.get("github");
    if (!outcome) return;
    handled.current = true;

    if (outcome === "connected") toast.success("GitHub App connected.");
    else if (outcome === "requested")
      toast.message("Install requested — an org owner must approve it on GitHub.");
    else if (outcome === "error")
      toast.error(params.get("reason") ?? "GitHub install failed.");

    router.replace("/settings/integrations");
  }, [params, router]);

  const installUrl = api.github.installUrl.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e) => toast.error(e.message),
  });

  const hasInstalls = status.installations.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="size-4 text-primary" />
          GitHub
        </CardTitle>
        <CardDescription>
          Install the ZenBuild GitHub App to connect repositories, ingest pull
          requests, and let the coding & review agents work against real code.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!status.configured && (
          <div className="text-muted-foreground rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-sm">
            The GitHub App isn&apos;t configured on this deployment yet. Set the{" "}
            <code className="font-mono text-xs">GITHUB_APP_*</code> environment
            variables to enable the integration.
          </div>
        )}

        {status.configured && !hasInstalls && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            No installations yet.{" "}
            {canManage
              ? "Install the app on your GitHub account or organization to get started."
              : "Ask an owner or admin to install the GitHub App."}
          </p>
        )}

        {hasInstalls && (
          <ul className="divide-border divide-y rounded-lg border border-border">
            {status.installations.map((inst) => (
              <li
                key={inst.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Github className="size-4 shrink-0" />
                    <span className="truncate">{inst.accountLogin}</span>
                    <span className="text-muted-foreground text-xs font-normal">
                      {inst.accountType}
                    </span>
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {inst.repositoryCount}{" "}
                    {inst.repositoryCount === 1 ? "repo" : "repos"} connected
                  </p>
                </div>
                <a
                  href={inst.manageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                >
                  Manage on GitHub
                  <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {status.configured && canManage && (
        <CardFooter className="justify-end">
          <Button
            type="button"
            variant={hasInstalls ? "outline" : "default"}
            className="gap-1.5"
            disabled={installUrl.isPending}
            onClick={() => installUrl.mutate()}
          >
            {installUrl.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plug className="size-4" />
            )}
            {hasInstalls ? "Add another account" : "Install GitHub App"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
