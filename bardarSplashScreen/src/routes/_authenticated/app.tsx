import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getNearbyBars, getBarLiveStatuses, type NearbyBar, type BarLiveStatus } from "@/lib/bardar.functions";
import { RadarBg } from "@/components/RadarBg";
import { CrowdBadge, crowdMeta } from "@/components/CrowdBadge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, LogOut, RefreshCw, Star } from "lucide-react";
import bardarIcon from "@/assets/bardar-icon.png";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Nearby bars · bardar" }] }),
  component: AppHome,
});

function fmtDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function AppHome() {
  const navigate = useNavigate();
  const nearbyFn = useServerFn(getNearbyBars);
  const statusFn = useServerFn(getBarLiveStatuses);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  function requestLocation() {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Your browser does not support location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGeoError(err.message || "Could not get your location."),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  useEffect(() => {
    requestLocation();
  }, []);

  const barsQuery = useQuery({
    queryKey: ["nearby", coords?.lat, coords?.lng],
    queryFn: () => nearbyFn({ data: { lat: coords!.lat, lng: coords!.lng, radiusMeters: 1500 } }),
    enabled: !!coords,
    staleTime: 60_000,
  });

  const placeIds = useMemo(() => barsQuery.data?.bars.map((b) => b.placeId) ?? [], [barsQuery.data]);

  const statusQuery = useQuery({
    queryKey: ["status", placeIds.join(",")],
    queryFn: () => statusFn({ data: { placeIds } }),
    enabled: placeIds.length > 0,
    refetchInterval: 60_000,
  });

  const statusByPlace = useMemo(() => {
    const m = new Map<string, BarLiveStatus>();
    statusQuery.data?.statuses.forEach((s) => m.set(s.placeId, s));
    return m;
  }, [statusQuery.data]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <RadarBg>
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={bardarIcon} alt="" className="h-8 w-8 rounded-lg" />
            <div>
              <h1 className="text-base font-bold leading-none tracking-tight">bardar</h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Nightlife radar</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => barsQuery.refetch()} aria-label="Refresh">
              <RefreshCw className={barsQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
            <Button size="icon" variant="ghost" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-6">
        {!coords && !geoError && (
          <LocationPrompt onAllow={requestLocation} />
        )}
        {geoError && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-center">
            <p className="text-sm font-medium text-destructive">{geoError}</p>
            <p className="mt-1 text-xs text-muted-foreground">bardar needs your location to find bars around you.</p>
            <Button onClick={requestLocation} className="mt-4">Try again</Button>
          </div>
        )}

        {coords && (
          <>
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Scanning within 1.5 km of you
            </div>

            {barsQuery.isLoading && <ScanningSkeleton />}

            {barsQuery.data?.error && (
              <p className="text-sm text-destructive">{barsQuery.data.error}</p>
            )}

            {barsQuery.data?.bars.length === 0 && (
              <p className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center text-sm text-muted-foreground">
                No bars found in this area. Try moving somewhere more central.
              </p>
            )}

            <ul className="space-y-3">
              {barsQuery.data?.bars.map((bar) => (
                <li key={bar.placeId}>
                  <BarCard bar={bar} status={statusByPlace.get(bar.placeId)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </RadarBg>
  );
}

function LocationPrompt({ onAllow }: { onAllow: () => void }) {
  return (
    <div className="mt-6 rounded-2xl border border-border/60 bg-card/80 p-6 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
        <MapPin className="h-6 w-6 text-primary" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Turn on location</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        bardar uses your location to scan bars around you. We never store it.
      </p>
      <Button onClick={onAllow} className="mt-5 h-11 w-full rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
        Allow location
      </Button>
    </div>
  );
}

function ScanningSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl border border-border/40 bg-card/40" />
      ))}
      <div className="flex items-center justify-center gap-2 pt-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Sweeping the area…
      </div>
    </div>
  );
}

function BarCard({ bar, status }: { bar: NearbyBar; status?: BarLiveStatus }) {
  const meta = crowdMeta(status?.avgCrowd ?? null);
  return (
    <Link
      to="/app/bar/$placeId"
      params={{ placeId: bar.placeId }}
      search={{ name: bar.name, lat: bar.lat, lng: bar.lng }}
      className="group block rounded-2xl border border-border/60 bg-card/80 p-4 shadow-[var(--shadow-card)] transition active:scale-[0.99] hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{bar.name}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{fmtDistance(bar.distanceMeters)}</span>
            {typeof bar.rating === "number" && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-warning text-warning" />
                {bar.rating.toFixed(1)}
              </span>
            )}
          </div>
          {bar.address && (
            <p className="mt-1 truncate text-xs text-muted-foreground/80">{bar.address}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <CrowdBadge level={status?.avgCrowd ?? null} source={status ? "live" : "none"} />
          {status?.avgWait != null && (
            <span className="text-[11px] text-muted-foreground">~{Math.round(status.avgWait)} min wait</span>
          )}
          {status?.reportCount ? (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {status.reportCount} report{status.reportCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </div>
      {!status && (
        <p className={`mt-3 text-xs ${meta.color} rounded-full px-2.5 py-1 inline-flex`}>
          Tap to see estimate & report
        </p>
      )}
    </Link>
  );
}