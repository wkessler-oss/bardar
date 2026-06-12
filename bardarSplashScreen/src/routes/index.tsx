import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RadarBg, RadarHeroMark } from "@/components/RadarBg";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "bardar · Find busy bars near you" },
      { name: "description", content: "Radar for nightlife. See which bars near you are packed, chill, or have a line out the door." },
      { property: "og:title", content: "bardar · Find busy bars near you" },
      { property: "og:description", content: "Radar for nightlife. See which bars near you are packed, chill, or have a line out the door." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        navigate({ to: "/app", replace: true });
      } else {
        setChecked(true);
      }
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (!checked) {
    return (
      <RadarBg>
        <div className="flex min-h-svh items-center justify-center">
          <RadarHeroMark />
        </div>
      </RadarBg>
    );
  }

  return (
    <RadarBg>
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 pb-12 pt-20 text-center">
        <RadarHeroMark size={120} />
        <h1 className="mt-10 text-balance text-4xl font-bold tracking-tight">
          Skip the dead bar.<br />
          <span className="bg-gradient-to-br from-primary to-primary-glow bg-clip-text text-transparent">
            Find the packed one.
          </span>
        </h1>
        <p className="mt-4 text-balance text-muted-foreground">
          bardar is radar for nightlife. See live crowd reports from people inside the bars around you, right now.
        </p>
        <div className="mt-10 flex w-full flex-col gap-3">
          <Link
            to="/auth"
            className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-primary to-primary-glow px-6 text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition active:scale-[0.98]"
          >
            Start scanning
          </Link>
          <p className="text-xs text-muted-foreground">
            On iPhone, tap <span className="font-medium text-foreground">Share → Add to Home Screen</span> to install bardar like a real app.
          </p>
        </div>
      </main>
    </RadarBg>
  );
}
