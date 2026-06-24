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
          <FileText className="size-4" />
          {content.title || "Product requirements"}
          <Badge variant="outline">v{version}</Badge>
          {approvedAt ? (
            <Badge>Approved</Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <Section title="Problem statement">
          <p className="whitespace-pre-wrap">{content.problemStatement}</p>
        </Section>
        <Bullets title="Goals" items={content.goals} />
        <Bullets title="Non-goals" items={content.nonGoals} />
        <Section title="User stories">
          <ul className="list-disc space-y-1 pl-5">
            {content.userStories.map((s, i) => (
              <li key={i}>
                As a {s.as}, I want {s.want}, so that {s.soThat}.
              </li>
            ))}
          </ul>
        </Section>
        <Bullets title="Acceptance criteria" items={content.acceptanceCriteria} />
        <Bullets title="Edge cases" items={content.edgeCases} />
        <Bullets title="Success metrics" items={content.successMetrics} />
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <Section title={title}>
      {items.length ? (
        <ul className="list-disc space-y-1 pl-5">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">None.</p>
      )}
    </Section>
  );
}
