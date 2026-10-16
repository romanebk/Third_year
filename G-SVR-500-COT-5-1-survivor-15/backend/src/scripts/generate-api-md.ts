/**
 * Régénère docs/API.md depuis le swagger vivant (JSDoc @openapi dans les
 * *.routes.ts), pour que le snapshot statique ne diverge jamais de l'API
 * réelle. À relancer après tout ajout/modification de route documentée.
 *
 * Lancer depuis backend/ :
 *   npx tsx src/scripts/generate-api-md.ts
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { swaggerSpec } from '../config/swagger';

interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  security?: unknown[];
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: { type?: string }; example?: unknown }>;
  requestBody?: { content?: Record<string, { example?: unknown; examples?: Record<string, { value: unknown }> }> };
  responses?: Record<string, { description?: string; content?: Record<string, { example?: unknown; examples?: Record<string, { value: unknown }> }> }>;
}

const spec = swaggerSpec as unknown as { paths: Record<string, Record<string, OperationObject>> };

const TAG_ORDER = ['Auth', 'Users', 'Offers', 'Applications', 'Notifications', 'Pro', 'Admin'];

function firstExample(content?: Record<string, { example?: unknown; examples?: Record<string, { value: unknown }> }>): unknown {
  const json = content?.['application/json'];
  if (!json) return undefined;
  if (json.example !== undefined) return json.example;
  if (json.examples) {
    const first = Object.values(json.examples)[0];
    return first?.value;
  }
  return undefined;
}

function renderOperation(method: string, path: string, op: OperationObject): string {
  const lines: string[] = [];
  lines.push(`### \`${method.toUpperCase()} ${path}\``, '');
  if (op.summary) lines.push(op.summary, '');
  if (op.description) lines.push(op.description.trim(), '');
  if (op.security?.length) lines.push('**Authentification requise** (Bearer JWT)', '');

  if (op.parameters?.length) {
    lines.push('**Paramètres** :', '');
    lines.push('| Nom | Emplacement | Requis | Exemple |', '|---|---|---|---|');
    for (const p of op.parameters) {
      lines.push(`| \`${p.name}\` | ${p.in} | ${p.required ? 'oui' : 'non'} | ${p.example ?? ''} |`);
    }
    lines.push('');
  }

  const reqExample = firstExample(op.requestBody?.content);
  if (reqExample !== undefined) {
    lines.push('**Requête** (`application/json`) :', '```json', JSON.stringify(reqExample, null, 2), '```', '');
  }

  for (const [code, resp] of Object.entries(op.responses ?? {})) {
    const example = firstExample(resp.content);
    if (example !== undefined) {
      lines.push(`**Réponse \`${code}\`** : ${resp.description ?? ''}`, '```json', JSON.stringify(example, null, 2), '```', '');
    } else if (resp.description) {
      lines.push(`**Réponse \`${code}\`** : ${resp.description}`, '');
    }
  }

  lines.push('---', '');
  return lines.join('\n');
}

function main(): void {
  const byTag = new Map<string, string[]>();
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const tag = op.tags?.[0] ?? 'Autre';
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(renderOperation(method, path, op));
    }
  }

  const orderedTags = [...TAG_ORDER, ...[...byTag.keys()].filter((t) => !TAG_ORDER.includes(t))];
  const totalEndpoints = [...byTag.values()].reduce((n, ops) => n + ops.length, 0);

  const today = new Date().toISOString().slice(0, 10);
  const out: string[] = [
    '# GéoEmploi API, documentation API',
    '',
    `Version \`0.1.0\`. API REST de mise en relation emploi géolocalisée. ${totalEndpoints} endpoints documentés.`,
    '',
    `> Régénéré automatiquement depuis le swagger vivant (\`/api/docs\`, JSDoc @openapi dans chaque *.routes.ts) le ${today} via \`npx tsx src/scripts/generate-api-md.ts\`.`,
    '> Ne pas éditer ce fichier à la main, régénérer depuis le serveur qui tourne pour rester curl-vérifié.',
    `> Interface interactive : **https://13.140.150.236:5173/api/docs/** (Try it out fonctionne directement).`,
    '',
    '## Sommaire',
    '',
    ...orderedTags.filter((t) => byTag.has(t)).map((t) => `- [${t}](#${t.toLowerCase()})`),
    '',
  ];

  for (const tag of orderedTags) {
    const ops = byTag.get(tag);
    if (!ops) continue;
    out.push(`## ${tag}`, '', ...ops);
  }

  const outPath = join(__dirname, '../../../docs/API.md');
  writeFileSync(outPath, out.join('\n').replace(/\n{3,}/g, '\n\n'), 'utf-8');
  console.log(`docs/API.md régénéré : ${totalEndpoints} endpoints, ${orderedTags.filter((t) => byTag.has(t)).length} sections.`);
}

main();
