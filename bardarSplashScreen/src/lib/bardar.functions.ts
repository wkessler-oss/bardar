import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export interface NearbyBar {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  distanceMeters: number;
}

const NearbyInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().min(100).max(5000).default(1500),
});

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const getNearbyBars = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => NearbyInput.parse(data))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !gmKey) {
      return { bars: [] as NearbyBar[], error: "Maps unavailable" };
    }

    const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchNearby`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.primaryType",
      },
      body: JSON.stringify({
        includedTypes: ["bar", "night_club", "pub"],
        maxResultCount: 20,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: data.lat, longitude: data.lng },
            radius: data.radiusMeters,
          },
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Places nearby failed", res.status, txt);
      return { bars: [] as NearbyBar[], error: "Could not load nearby bars" };
    }

    const json = (await res.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        location?: { latitude: number; longitude: number };
        formattedAddress?: string;
        rating?: number;
        userRatingCount?: number;
        priceLevel?: string;
      }>;
    };

    const bars: NearbyBar[] = (json.places ?? [])
      .filter((p) => p.location && p.id && p.displayName?.text)
      .map((p) => ({
        placeId: p.id,
        name: p.displayName!.text!,
        lat: p.location!.latitude,
        lng: p.location!.longitude,
        address: p.formattedAddress,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        priceLevel: p.priceLevel,
        distanceMeters: haversine(data.lat, data.lng, p.location!.latitude, p.location!.longitude),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return { bars };
  });

const ReportsInput = z.object({
  placeIds: z.array(z.string().min(1).max(255)).min(1).max(50),
});

export interface BarLiveStatus {
  placeId: string;
  avgCrowd: number | null; // 1-4
  avgWait: number | null;
  reportCount: number;
  lastReportAt: string | null;
}

export const getBarLiveStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReportsInput.parse(data))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("reports")
      .select("place_id, crowd_level, wait_minutes, created_at")
      .in("place_id", data.placeIds)
      .gte("created_at", since);
    if (error) {
      console.error(error);
      return { statuses: [] as BarLiveStatus[] };
    }
    const byPlace = new Map<string, { crowd: number[]; wait: number[]; last: string }>();
    for (const r of rows ?? []) {
      const cur = byPlace.get(r.place_id) ?? { crowd: [], wait: [], last: r.created_at };
      cur.crowd.push(r.crowd_level);
      if (typeof r.wait_minutes === "number") cur.wait.push(r.wait_minutes);
      if (r.created_at > cur.last) cur.last = r.created_at;
      byPlace.set(r.place_id, cur);
    }
    const statuses: BarLiveStatus[] = Array.from(byPlace.entries()).map(([placeId, v]) => ({
      placeId,
      avgCrowd: v.crowd.length ? v.crowd.reduce((a, b) => a + b, 0) / v.crowd.length : null,
      avgWait: v.wait.length ? v.wait.reduce((a, b) => a + b, 0) / v.wait.length : null,
      reportCount: v.crowd.length,
      lastReportAt: v.last,
    }));
    return { statuses };
  });

const BarFeedInput = z.object({ placeId: z.string().min(1).max(255) });

export const getBarFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BarFeedInput.parse(data))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("reports")
      .select("id, crowd_level, wait_minutes, note, created_at, user_id")
      .eq("place_id", data.placeId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      console.error(error);
      return { reports: [], profiles: {} as Record<string, { display_name: string }> };
    }
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    let profiles: Record<string, { display_name: string }> = {};
    if (userIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, { display_name: p.display_name }]));
    }
    return { reports: rows ?? [], profiles };
  });

const CreateReportInput = z.object({
  placeId: z.string().min(1).max(255),
  placeName: z.string().min(1).max(255),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  crowdLevel: z.number().int().min(1).max(4),
  waitMinutes: z.number().int().min(0).max(240).nullable().optional(),
  note: z.string().max(200).optional(),
});

export const createReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateReportInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("reports")
      .insert({
        user_id: context.userId,
        place_id: data.placeId,
        place_name: data.placeName,
        lat: data.lat,
        lng: data.lng,
        crowd_level: data.crowdLevel,
        wait_minutes: data.waitMinutes ?? null,
        note: data.note ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error(error);
      throw new Error("Could not save report");
    }
    return { id: row.id };
  });

export interface AiEstimate {
  crowdLevel: number; // 1-4
  reasoning: string;
}

const EstimateInput = z.object({
  name: z.string().min(1).max(255),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  priceLevel: z.string().optional(),
});

export const estimateBusyness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EstimateInput.parse(data))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) {
      return { crowdLevel: 2, reasoning: "AI unavailable" } as AiEstimate;
    }
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay(); // 0=Sun
    const prompt = `You estimate how busy a bar typically is right now based on day/time and the venue's profile.\n
Venue: ${data.name}\nGoogle rating: ${data.rating ?? "?"} (${data.userRatingCount ?? 0} reviews)\nPrice level: ${data.priceLevel ?? "?"}\nCurrent day of week (0=Sun..6=Sat, UTC): ${day}\nCurrent hour (UTC, 0-23): ${hour}\n
Reply with strict JSON: {"crowdLevel": 1|2|3|4, "reasoning": "<one short sentence, <=90 chars>"}.
1 = empty, 2 = chill, 3 = busy, 4 = packed/line out the door.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Output strict JSON only." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) {
        return { crowdLevel: 2, reasoning: "Typical for this time" };
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const txt = json.choices?.[0]?.message?.content ?? "";
      const match = txt.match(/\{[\s\S]*\}/);
      if (!match) return { crowdLevel: 2, reasoning: "Typical for this time" };
      const parsed = JSON.parse(match[0]) as { crowdLevel: number; reasoning: string };
      const lvl = Math.min(4, Math.max(1, Math.round(parsed.crowdLevel))) as 1 | 2 | 3 | 4;
      return { crowdLevel: lvl, reasoning: String(parsed.reasoning).slice(0, 120) };
    } catch (e) {
      console.error(e);
      return { crowdLevel: 2, reasoning: "Typical for this time" };
    }
  });