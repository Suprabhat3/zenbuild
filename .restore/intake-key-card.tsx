"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

export interface IntakeKeyInfo {
  token: string;
  rotatedAt: Date;
}

export function IntakeKeyCard({
  initialKey,
  endpoint,
  canManage,
}: {
  initialKey: IntakeKeyInfo | null;
  endpoint: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [token, setToken] = useState(initialKey?.token ?? null);

  const rotate = api.intakeKey.rotate.useMutation({
    onSuccess: (res) => {
      setToken(res.token);
      setRevealedSecret(res.secret);
      toast.success("Intake key generated. Copy the secret now — it won't be shown again.");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied.`);
  }

  const example = `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-Intake-Key: ${token ?? "<token>"}" \\
  -H "X-Intake-Signature: $SIGNATURE" \\
  -d "$BODY"

# $SIGNATURE = HMAC-SHA256 of the exact request body, keyed by your secret:
#   SIGNATURE=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" />
          Intake webhook
        </CardTitle>
        <CardDescription>
          Send feature requests from email, tickets, or calls by POSTing a signed
          payload to your workspace endpoint. Requests are signed with HMAC-SHA256
          using your secret and land as new feature requests.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Endpoint</Label>
          <div className="flex gap-2">
            <Input value={endpoint} readOnly className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy endpoint"
              onClick={() => copy(endpoint, "Endpoint")}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </div>

        {token ? (
          <div className="space-y-2">
            <Label>Key token (X-Intake-Key)</Label>
            <div className="flex gap-2">
              <Input value={token} readOnly className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy token"
                onClick={() => copy(token, "Token")}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No intake key yet.{" "}
            {canManage
              ? "Generate one to start receiving requests."
              : "Ask an owner or admin to generate one."}
          </p>
        )}

        {revealedSecret && (
          <Alert>
            <AlertTitle>Signing secret (shown once)</AlertTitle>
            <AlertDescription className="space-y-2">
              <div className="flex w-full gap-2">
                <Input
                  value={revealedSecret}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy secret"
                  onClick={() => copy(revealedSecret, "Secret")}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <span className="text-muted-foreground text-xs">
                Store this securely. Rotating again invalidates it.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {token && (
          <div className="space-y-2">
            <Label>Example request</Label>
            <pre className="bg-muted/40 overflow-auto rounded-md p-3 text-xs">
              {example}
            </pre>
          </div>
        )}
      </CardContent>
      {canManage && (
        <CardFooter className="justify-end">
          <Button
            type="button"
            variant={token ? "outline" : "default"}
            className="gap-1.5"
            onClick={() => {
              if (
                token &&
                !confirm("Rotating invalidates the current secret. Continue?")
              ) {
                return;
              }
              rotate.mutate();
            }}
            disabled={rotate.isPending}
          >
            <RefreshCw className="size-4" />
            {rotate.isPending
              ? "Generating…"
              : token
                ? "Rotate key"
                : "Generate key"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
