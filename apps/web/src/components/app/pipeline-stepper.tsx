"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

import {
  PIPELINE_STAGES,
  STATUS_STAGE_INDEX,
  TERMINAL_STATUSES,
  type FeatureRequestStatus,
} from "@/lib/feature-request";

/**
 * The pipeline stepper IS the workspace navigation: each stage node links to
 * its stage route under /requests/[id]/. One element answers both "where is
 * this request?" (done / current / future) and "which surface am I viewing?"
 * (the underlined node). Terminal statuses render calm progress — the layout
 * shows the "Closed" banner; there is no red ✗ on an arbitrary stage.
 */
export function PipelineStepper({
  featureRequestId,
  status,
}: {
  featureRequestId: string;
  status: FeatureRequestStatus;
}) {
  const pathname = usePathname();
  const currentIndex = STATUS_STAGE_INDEX[status];
  const shipped = status === "SHIPPED";
  const closed = TERMINAL_STATUSES.includes(status) && !shipped;

  return (
    <nav aria-label="Delivery pipeline">
      <ol className="app-stepper">
        {PIPELINE_STAGES.map((stage, i) => {
          const done = shipped || i < currentIndex;
          const current = !shipped && !closed && i === currentIndex;
          const future = !done && !current;
          const href = stage.slug
            ? `/requests/${featureRequestId}/${stage.slug}`
            : null;
          const viewing =
            href !== null &&
            (pathname === href || pathname.startsWith(`${href}/`));

          const stepClass = [
            "app-stepper-step",
            done ? "is-done" : "",
            current ? "is-current" : "",
            future ? "is-future" : "",
            viewing ? "is-viewing" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const body = (
            <>
              <span className="app-stepper-dot">
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className="app-stepper-label">{stage.label}</span>
            </>
          );

          return (
            <li key={stage.key} className={stepClass}>
              {href ? (
                <Link
                  href={href}
                  className="app-stepper-link"
                  aria-current={viewing ? "page" : undefined}
                >
                  {body}
                </Link>
              ) : (
                <span className="app-stepper-link">{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
