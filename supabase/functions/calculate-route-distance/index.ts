import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DistanceRequest {
  origin: string;
  destination: string;
}

interface DistanceResponse {
  distance_km: number;
  duration_minutes: number;
  distance_text: string;
  duration_text: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { origin, destination }: DistanceRequest = await req.json();

    if (!origin || !destination) {
      return new Response(
        JSON.stringify({ error: "Origin and destination are required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!googleApiKey) {
      return new Response(
        JSON.stringify({
          error: "Google Maps API key not configured",
          distance_km: 0,
          duration_minutes: 0,
          distance_text: "N/A",
          duration_text: "N/A"
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)},Côte d'Ivoire&destinations=${encodeURIComponent(destination)},Côte d'Ivoire&key=${googleApiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.rows?.[0]?.elements?.[0]) {
      return new Response(
        JSON.stringify({
          error: "Unable to calculate distance",
          distance_km: 0,
          duration_minutes: 0,
          distance_text: "N/A",
          duration_text: "N/A"
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const element = data.rows[0].elements[0];

    if (element.status !== "OK") {
      return new Response(
        JSON.stringify({
          error: "Route not found",
          distance_km: 0,
          duration_minutes: 0,
          distance_text: "N/A",
          duration_text: "N/A"
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const distanceKm = Math.round(element.distance.value / 1000);
    const durationMinutes = Math.round(element.duration.value / 60);

    const result: DistanceResponse = {
      distance_km: distanceKm,
      duration_minutes: durationMinutes,
      distance_text: element.distance.text,
      duration_text: element.duration.text,
    };

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error calculating distance:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        distance_km: 0,
        duration_minutes: 0,
        distance_text: "N/A",
        duration_text: "N/A"
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
