import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { getBarFeed, createReport, estimateBusyness } from "@/lib/bardar.functions";
import { RadarBg } from "@/components/RadarBg";
import { CrowdBadge, CROWD_LABELS, crowdMeta } from "@/components/CrowdBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, Sparkles, Send, Loader2 } from "lucide-react";

const searchSchema = z.object({
  name: z.string().default("Bar"),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

export const Route = createFileRoute("/_authenticated/app/bar/$placeId")({
  validateSearch: searchSchema,
  head: ({ match }) => ({ meta: [{ title: `${match.search.name} · bardar` }] }),
  component: BarDetail,
});

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

function BarDetail() {
  const { placeId } = Route.useParams();
  const { name, lat, lng } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const feedFn = useServerFn(getBarFeed);
  const estimateFn = useServerFn(estimateBusyness);
  const reportFn = useServerFn(createReport);

  const feedQuery = useQuery({
    queryKey: ["feed", placeId],
    queryFn: () => feedFn({ data: { placeId } }),
    refetchInterval: 30_000,
  });

  const estimateQuery = useQuery({
    queryKey: ["estimate", placeId],
    queryFn: () => estimateFn({ data: { name } }),
    staleTime: 15 * 60 * 1000,
  });

  const [crowd, setCrowd] = useState<number | null>(null);
  const [wait, setWait] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const reports = feedQuery.data?.reports ?? [];
  const profiles = feedQuery.data?.profiles ?? {};

  const recent = reports.filter((r) => Date.now() - new Date(r.created_at).getTime() < 2 * 60 * 60 * 1000);
  const liveAvg = recent.length ? recent.reduce((a, b) => a + b.crowd_level, 0) / recent.length : null;
  const liveWait = (() => {
    const w = recent.map((r) => r.wait_minutes).filter((x): x is number => typeof x === "number");
    return w.length ? Math.round(w.reduce((a, b) => a + b, 0) / w.length) : null;
  })();

  async function submitReport() {
    if (!crowd) {
      toast.error("Pick a crowd level");
      return;
    }
    setSubmitting(true);
    try {
      await reportFn({
        data: {
          placeId,
          placeName: name,
          lat,
          lng,
          crowdLevel: crowd,
          waitMinutes: wait ? Number(wait) : null,
          note: note.trim() || undefined,
        },
      });
      toast.success("Report sent. Cheers!");
      setCrowd(null);
      setWait("");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["feed", placeId] });
      await qc.invalidateQueries({ queryKey: ["status"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send report");
    } finally {
      setSubmitting(false);
    }
  }

  const showingLive = liveAvg != null;
  const displayLevel = showingLive ? liveAvg : (estimateQuery.data?.crowdLevel ?? null);

  return (
    <RadarBg>
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-2 py-3">
          <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/app" })} aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="truncate text-base font-semibold">{name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-4 pb-32 pt-6">
        {/* Status card */}
        <section className="rounded-3xl border border-border/60 bg-card/80 p-6 text-center shadow-[var(--shadow-card)]">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {showingLive ? "Right now (live)" : "Typical for this time"}
          </div>
          <div className="mt-3 flex items-center justify-center">
            <CrowdBadge level={displayLevel} source={showingLive ? "live" : "estimate"} className="text-sm" />
          </div>
          <div className="mt-4 text-3xl font-bold tracking-tight">
            {crowdMeta(displayLevel).label}
          </div>
          {showingLive ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Based on {recent.length} report{recent.length === 1 ? "" : "s"} in the last 2 hours
              {liveWait != null && ` · ~${liveWait} min wait`}
            </p>
          ) : estimateQuery.data?.reasoning ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> {estimateQuery.data.reasoning}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No live reports yet. Be the first.</p>
          )}
        </section>

        {/* Report form */}
        <section className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-semibold">How busy is it?</h2>
          <p className="mt-1 text-xs text-muted-foreground">Quick report. Takes 5 seconds.</p>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((lvl) => {
              const m = crowdMeta(lvl);
              const active = crowd === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setCrowd(lvl)}
                  className={`rounded-2xl border px-1 py-3 text-center text-xs font-medium transition ${
                    active
                      ? "border-primary bg-primary/15 text-foreground shadow-[var(--shadow-glow)]"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <div className="text-lg">{m.emoji}</div>
                  <div className="mt-1">{CROWD_LABELS[lvl]}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wait">Wait (min)</Label>
              <Input id="wait" type="number" inputMode="numeric" min={0} max={240} value={wait} onChange={(e) => setWait(e.target.value)} placeholder="0" />
            </div>
            <div className="self-end">
              <p className="text-[11px] text-muted-foreground">Optional</p>
            </div>
          </div>

          <div className="mt-3">
            <Label htmlFor="note">Note <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Live music tonight, no cover…" />
          </div>

          <Button onClick={submitReport} disabled={submitting} className="mt-4 h-11 w-full rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[var(--shadow-glow)]">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Send className="mr-2 h-4 w-4" /> Send report</>)}
          </Button>
        </section>

        {/* Recent reports */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Recent reports</h2>
          {feedQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!feedQuery.isLoading && reports.length === 0 && (
            <p className="rounded-2xl border border-border/60 bg-card/60 p-5 text-center text-sm text-muted-foreground">
              No reports in the last 6 hours.
            </p>
          )}
          <ul className="space-y-2">
            {reports.map((r) => {
              const m = crowdMeta(r.crowd_level);
              const who = profiles[r.user_id]?.display_name ?? "Anon";
              return (
                <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/60 p-3">
                  <div className="text-xl">{m.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="font-medium">{m.label}</span>
                      {r.wait_minutes != null && <span className="text-xs text-muted-foreground">~{r.wait_minutes} min wait</span>}
                    </div>
                    {r.note && <p className="truncate text-xs text-muted-foreground">"{r.note}"</p>}
                    <p className="text-[11px] text-muted-foreground/80">{who} · {timeAgo(r.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="pt-4 text-center text-xs text-muted-foreground">
          <Link to="/app" className="hover:text-foreground">← Back to radar</Link>
        </p>
      </main>
    </RadarBg>
  );
}