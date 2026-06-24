import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PrdContent {
  title: string;
  problemStatement: string;
  goals: string[];
  nonGoals: string[];
  userStories: { as: string; want: string; soThat: string }[];
  acceptanceCriteria: string[];
  edgeCases: string[];
  successMetrics: string[];
}

/** Renders a structured PRD. Editing/approval arrive in Phase 5. */
export function PrdView({
  content,
  version,
  approvedAt,
}: {
  content: PrdContent;
  version: number;
  approvedAt: Date | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <FileText className="size-4 text-primary" />
          Product requirements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="app-prd-sheet">
          <span className="app-prd-tab">PRD · v{version}</span>
          <div className="flex flex-wrap items-start justify-between gap-3 pt-2">
            <h2 className="font-(family-name:--font-display) text-2xl font-normal tracking-tight">
              {content.title || "Product requirements"}
            </h2>
            <div className="flex flex-wrap gap-2">
              {approvedAt ? (
                <Badge>Approved</Badge>
              ) : (
                <Badge variant="secondary">Draft</Badge>
              )}
            </div>
          </div>

          <div className="app-prd-section">
            <h3 className="app-prd-section-label">Problem statement</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-(--zb-ink-soft)">
              {content.problemStatement}
            </p>
          </div>

          <Bullets title="Goals" items={content.goals} />
          <Bullets title="Non-goals" items={content.nonGoals} />

          <div className="app-prd-section">
            <h3 className="app-prd-section-label">User stories</h3>
            <ul className="app-prd-list grid gap-2">
              {content.userStories.map((s, i) => (
                <li key={i}>
                  As a {s.as}, I want {s.want}, so that {s.soThat}.
                </li>
              ))}
            </ul>
          </div>

          <Bullets title="Acceptance criteria" items={content.acceptanceCriteria} />
          <Bullets title="Edge cases" items={content.edgeCases} />
          <Bullets title="Success metrics" items={content.successMetrics} />
        </div>
      </CardContent>
    </Card>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="app-prd-section">
      <h3 className="app-prd-section-label">{title}</h3>
      {items.length ? (
        <ul className="app-prd-list grid gap-2">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">None.</p>
      )}
    </div>
  );
}
