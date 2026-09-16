import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Content discovery.
 *
 * Two calls per gather:
 *  1. Research: Claude uses the server-side web_search tool to find fresh,
 *     relevant items for the user's interests and writes a digest with URLs.
 *  2. Extraction: Claude converts that digest into strictly-typed candidates
 *     (structured outputs) ready to be stored as swipe cards.
 */

export interface DiscoveryInterest {
  id: string;
  topic: string;
  guidance: string | null;
  sources: string[];
}

export interface DiscoveryInput {
  interests: DiscoveryInterest[];
  /** How the user wants their posts to sound. */
  voice: string;
  /** Total number of candidates to aim for across all interests. */
  target: number;
  /** Titles/URLs already shown to this user recently, so we do not repeat them. */
  recentlySeen: { title: string; url: string | null }[];
  /** Platforms the post text must fit. Only X today. */
  platforms: ("x")[];
}

const CandidateSchema = z.object({
  interest_id: z.string().describe("The id of the interest this item belongs to"),
  title: z.string().describe("Short headline for the card, under 90 characters"),
  summary: z.string().describe("2-3 sentence neutral summary of the source"),
  source_url: z.string().describe("Canonical URL of the source article/post"),
  source_name: z.string().describe("Publisher, site or account name"),
  why_relevant: z.string().describe("One sentence on why this fits the user's interest"),
  suggested_post: z
    .string()
    .describe("Ready-to-publish post text in the user's voice, max 260 characters, no hashtags"),
  hashtags: z.array(z.string()).describe("0-3 hashtags without the # symbol"),
});

const CandidatesSchema = z.object({
  candidates: z.array(CandidateSchema),
});

export type Candidate = z.infer<typeof CandidateSchema>;

const RESEARCH_SYSTEM = `You are a research assistant for a social media curation product.
Your job: find genuinely interesting, recent (last 7 days when possible), credible items
on the web that match a user's stated interests, so the user can decide whether to share them.

Rules:
- Use web_search to find real, current items. Never invent articles, quotes, or URLs.
- Prefer primary sources and well-known publications. Include social posts (e.g. from X,
  Reddit, LinkedIn, Hacker News) only when the source string explicitly allows it.
- Spread results across the interests roughly evenly.
- Skip anything in the "already seen" list.
- Skip paywalled, spammy, or clearly promotional content.
- For each item give: interest id, headline, 2-3 sentence summary, URL, publisher,
  why it is relevant, and a draft post written in the user's voice.
- Draft posts must be under 260 characters, must not contain hashtags in the body,
  and must not be clickbait. Suggest 0-3 hashtags separately.

Finish with a plain-text digest listing every item you found with all of the fields above.
Do not stop early: aim for the requested number of items.`;

function buildResearchPrompt(input: DiscoveryInput): string {
  const interests = input.interests
    .map(
      (i) =>
        `- id: ${i.id}\n  topic: ${i.topic}\n  guidance: ${i.guidance ?? "(none)"}\n  allowed sources: ${i.sources.join(", ")}`,
    )
    .join("\n");

  const seen =
    input.recentlySeen.length === 0
      ? "(none)"
      : input.recentlySeen
          .slice(0, 60)
          .map((s) => `- ${s.title}${s.url ? ` (${s.url})` : ""}`)
          .join("\n");

  return `Today's date: ${new Date().toISOString().slice(0, 10)}

Interests:
${interests}

User's posting voice: ${input.voice}
Target platforms: ${input.platforms.join(", ")}
Number of items wanted: ${input.target}

Already seen (do not repeat):
${seen}`;
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/**
 * Step 1: research with web search. Handles the server-side tool loop and
 * `pause_turn` continuations.
 */
async function research(client: Anthropic, input: DiscoveryInput): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildResearchPrompt(input) },
  ];

  const maxContinuations = 5;
  for (let i = 0; i <= maxContinuations; i++) {
    const stream = client.messages.stream({
      model: env.discoveryModel(),
      max_tokens: 32000,
      system: RESEARCH_SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: Math.min(20, Math.max(6, input.target)),
        },
      ],
      messages,
    });
    const response = await stream.finalMessage();

    if (response.stop_reason === "refusal") {
      throw new Error(
        `Discovery refused: ${response.stop_details?.explanation ?? "no explanation"}`,
      );
    }

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    const text = textOf(response);
    if (!text.trim()) throw new Error("Discovery returned no text");
    return text;
  }

  throw new Error("Discovery did not finish after several continuations");
}

/** Step 2: turn the digest into typed candidates. */
async function extract(
  client: Anthropic,
  input: DiscoveryInput,
  digest: string,
): Promise<Candidate[]> {
  const validIds = new Set(input.interests.map((i) => i.id));

  const response = await client.messages.parse({
    model: env.discoveryModel(),
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: zodOutputFormat(CandidatesSchema),
    },
    system:
      "Convert the research digest into structured candidates. Keep only items that have a real URL. " +
      "Use the interest ids exactly as given. Keep suggested posts under 260 characters.",
    messages: [
      {
        role: "user",
        content: `Valid interest ids: ${[...validIds].join(", ")}\n\nDigest:\n${digest}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `Extraction refused: ${response.stop_details?.explanation ?? "no explanation"}`,
    );
  }

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Extraction produced no parseable output");

  // Defensive cleanup: trim to limits, drop unknown ids and duplicate URLs.
  const seenUrls = new Set<string>();
  return parsed.candidates
    .filter((c) => validIds.has(c.interest_id))
    .filter((c) => {
      try {
        const u = new URL(c.source_url);
        if (!/^https?:$/.test(u.protocol)) return false;
        const key = u.origin + u.pathname;
        if (seenUrls.has(key)) return false;
        seenUrls.add(key);
        return true;
      } catch {
        return false;
      }
    })
    .map((c) => ({
      ...c,
      title: c.title.slice(0, 120),
      suggested_post: c.suggested_post.slice(0, 270),
      hashtags: c.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean).slice(0, 3),
    }))
    .slice(0, input.target);
}

/** Public entry point. */
export async function discoverContent(input: DiscoveryInput): Promise<Candidate[]> {
  if (input.interests.length === 0) return [];

  const client = new Anthropic({ apiKey: env.anthropicApiKey() });
  const digest = await research(client, input);
  return extract(client, input, digest);
}
