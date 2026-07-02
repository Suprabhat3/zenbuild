/**
 * Stage-surface skeleton. Scoped inside the request workspace so switching
 * stage tabs keeps the header, stepper, and banner in place while the next
 * surface loads.
 */
export default function StageLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading stage">
      <div className="app-panel animate-pulse">
        <div className="app-panel-body space-y-3 pt-6">
          <div className="bg-muted h-5 w-1/3 rounded-md" />
          <div className="bg-muted h-4 w-2/3 rounded-md" />
          <div className="bg-muted h-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}
