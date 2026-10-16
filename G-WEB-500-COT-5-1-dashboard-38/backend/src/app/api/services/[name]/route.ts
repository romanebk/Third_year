import { NextResponse } from "next/server";

import { getServiceByName } from "@/server/services";

// GET /api/services/[name] — détail d'un service et de ses widgets.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const service = getServiceByName(name);

  if (!service) {
    return NextResponse.json({ error: "service not found" }, { status: 404 });
  }

  return NextResponse.json({ service });
}