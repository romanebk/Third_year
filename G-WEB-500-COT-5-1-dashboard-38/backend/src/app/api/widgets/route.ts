import { NextResponse } from "next/server";

import { getAllWidgets } from "@/server/widgets";

// GET /api/widgets — liste des widgets disponibles (tous services confondus).
export function GET() {
  return NextResponse.json({ widgets: getAllWidgets() });
}