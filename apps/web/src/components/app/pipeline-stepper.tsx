import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";

import {
  NEXT_ACTION,
  PIPELINE_STAGES,
  STATUS_STAGE_INDEX,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { Button } from "@/components/ui/button";

/**
 * Horizontal delivery-pipeline stepper with the request's single "next
 * action" surfaced as the primary CTA. This is the orientation device for the
 * whole feature workspace: the user always knows where the request is and
 * what to do next.
 */
export function PipelineStepper({
  featureRequestId,
  status,
}: {
  featureRequestId: string;
  status: FeatureRequestStatus;
}) {
  const currentIndex = STATUS_STAGE_INDEX[status];
  const shipped = status === "SHIPPED";
  const terminal = status === "REJECTED" || status === "DECLINED_DUPLICATE";
  const action = NEXT_ACTION[status];

  return (
    <div className="space-y-3">
      <ol className="app-stepper" aria-label="Delivery pipeline">
        {PIPELINE_STAGES.map((stage, i) => {
          const done = shipped || i < currentIndex;
          const current = !shipped && !terminal && i === currentIndex;
          const failed = terminal && i === currentIndex;
          return (
            <li
              key={stage.key}
              className={[
                "app-stepper-step",
                done ? "is-done" : "",
                current ? "is-current" : "",
                failed ? "is-terminal" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={current ? "step" : undefined}
            >
              <span className="app-stepper-dot">
                {done ? (
                  <Check className="size-3.5" aria-hidden />
                ) : failed ? (
                  <X className="size-3.5" aria-hidden />
                ) : (
                  i + 1
                )}
              </span>
              <span className="app-stepper-label">{stage.label}</span>
            </li>
          );
        })}
      </ol>

      {action ? (
        <div className="app-next-action">
          <p className="app-next-action-hint">
            <strong>Next up:</strong> {action.hint}
          </p>
          <Button size="sm" render={<Link href={action.href(featureRequestId)} />}>
            {action.label}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      ) : shipped ? (
        <div className="app-next-action">
          <p className="app-next-action-hint">
            <strong>Shipped.</strong> This feature completed the full delivery
            loop — nothing left to do here.
          </p>
        </div>
      ) : terminal ? (
        <div className="app-next-action">
          <p className="app-next-action-hint">
            <strong>
              {status === "REJECTED" ? "Rejected." : "Closed as duplicate."}
            </strong>{" "}
            This request left the pipeline and won't move forward.
          </p>
        </div>
      ) : null}
    </div>
  );
}
