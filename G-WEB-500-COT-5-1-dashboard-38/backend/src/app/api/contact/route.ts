import { NextResponse } from "next/server";

import { isValidEmail } from "@/lib/validation";
import { sendContactMessage } from "@/server/auth/mailer";
import { clientIp, createRateLimiter } from "@/server/rate-limit";

const TOPICS: Record<string, string> = {
  general: "General question",
  privacy: "Privacy and my data",
  account: "My account",
  bug: "Bug report",
};
const NAME_MAX_LENGTH = 100;
const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 2000;

// 5 messages par quart d'heure et par adresse IP.
const limiter = createRateLimiter(5, 15 * 60 * 1000);

// POST /api/contact — formulaire de contact public (page /contact).
// Body : { name, email, topic, message, website }. `website` est un champ piège
// invisible : rempli = robot, on répond comme un succès sans rien envoyer.
// 200 { sent: true } ; 400 champ invalide ; 429 trop d'envois ; 502 envoi échoué.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const topic = typeof body?.topic === "string" ? body.topic : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (typeof body?.website === "string" && body.website !== "") {
    return NextResponse.json({ sent: true });
  }
  if (!name || name.length > NAME_MAX_LENGTH) {
    return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!Object.hasOwn(TOPICS, topic)) {
    return NextResponse.json({ error: "Choose a topic" }, { status: 400 });
  }
  if (message.length < MESSAGE_MIN_LENGTH || message.length > MESSAGE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Your message must be ${MESSAGE_MIN_LENGTH} to ${MESSAGE_MAX_LENGTH} characters` },
      { status: 400 },
    );
  }

  if (limiter.isLimited(clientIp(request))) {
    return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
  }

  try {
    await sendContactMessage({ name, email, topic: TOPICS[topic], message });
  } catch (error) {
    console.error("[api/contact] could not send message:", error);
    return NextResponse.json({ error: "Could not send your message. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ sent: true });
}
