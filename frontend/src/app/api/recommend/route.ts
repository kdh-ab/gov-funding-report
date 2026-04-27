export async function POST(request: Request) {
  const { formData, refresh } = await request.json();

  if (!formData?.company_name) {
    return Response.json({ error: "기업명은 필수입니다." }, { status: 400 });
  }

  const apiUrl = process.env.API_URL || "http://localhost:8000";

  const upstream = await fetch(`${apiUrl}/recommend/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: formData, refresh }),
  });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
