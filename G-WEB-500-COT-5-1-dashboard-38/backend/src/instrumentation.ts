// Convention Next.js (App Router) : register() s'exécute au démarrage du serveur,
// et est compilé pour les runtimes nodejs ET edge par défaut. La logique réelle
// (Prisma, next-auth via le déchiffrement des tokens) n'existe que côté Node —
// import dynamique isolé dans son propre fichier (cf. doc Next.js) pour que le
// bundle edge n'ait jamais à résoudre "crypto" (module Node absent de l'edge
// runtime), ce qu'un simple `if (NEXT_RUNTIME !== "nodejs") return` ne suffit pas
// à empêcher : webpack bundle quand même la cible d'un import() dynamique pour
// pouvoir créer son chunk, guard ou pas.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
