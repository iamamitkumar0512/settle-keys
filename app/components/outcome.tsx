import { txUrl, type Outcome } from "@/lib/near";

export function OutcomeCard({ title, outcome, verb = "done" }: { title: string; outcome: Outcome; verb?: string }) {
  return (
    <div className={`well flex flex-col gap-1 ${outcome.ok ? "" : "border-late"}`}>
      <p className="font-medium">{title}</p>
      {outcome.ok ? (
        <p className="text-paid">{verb}: yes</p>
      ) : (
        <p className="text-late">refused: {outcome.reason}</p>
      )}
      {outcome.hash && (
        <a href={txUrl(outcome.hash)} target="_blank" rel="noreferrer" className="figure text-[13px] text-accent-text">
          {outcome.hash}
        </a>
      )}
    </div>
  );
}
