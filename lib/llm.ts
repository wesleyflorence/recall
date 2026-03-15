const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_RETRIES = 4;
const INITIAL_BACKOFF_MS = 300;

export type GeneratedCardInput = {
  question: string;
  rubric: string;
  referenceAnswer?: string | null;
  difficultyHint?: string | null;
};

export type GradeResponse = {
  grade: number;
  feedback: string;
};

type Role = 'system' | 'user';

type ChatMessage = {
  role: Role;
  content: string;
};

type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  response_format: {
    type: 'json_object';
  };
};

type ChatCompletionResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type OpenRouterResult<T> = {
  parsed: T;
  raw: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOpenRouterHeaders() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://localhost',
    'X-Title': process.env.OPENROUTER_X_TITLE || 'Recall',
  };
}

function normalizeNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json([\s\S]*?)```/i);

  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LLM response is not valid JSON');
  }

  const jsonString = candidate.slice(start, end + 1);
  return JSON.parse(jsonString);
}

async function requestOpenRouter<T>(body: ChatCompletionRequest): Promise<OpenRouterResult<T>> {
  let lastError: Error | null = null;
  let backoff = INITIAL_BACKOFF_MS;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(OPENROUTER_BASE_URL, {
        method: 'POST',
        headers: getOpenRouterHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const raw = await res.text();

        if (
          (res.status === 429 || (res.status >= 500 && res.status < 600)) &&
          attempt < MAX_RETRIES - 1
        ) {
          lastError = new Error(`OpenRouter returned ${res.status}`);
          await sleep(backoff);
          backoff *= 2;
          continue;
        }

        throw new Error(`OpenRouter request failed with ${res.status}: ${raw}`);
      }

      const payload = (await res.json()) as ChatCompletionResponse;

      if (payload.error) {
        throw new Error(payload.error.message || 'OpenRouter returned an error');
      }

      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenRouter returned no completion content');
      }

      return {
        parsed: extractJson(content) as T,
        raw: content,
      };
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(backoff);
        backoff *= 2;
        continue;
      }
    }
  }

  throw lastError ?? new Error('OpenRouter request failed');
}

function normalizeGeneratedCards(raw: unknown): GeneratedCardInput[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { cards?: unknown[] }).cards)) {
    throw new Error('LLM generation response must include cards array');
  }

  const cards = (raw as { cards: unknown[] }).cards;

  const parsed = cards
    .map((card: unknown): GeneratedCardInput | null => {
      if (!card || typeof card !== 'object') {
        return null;
      }

      const question =
        typeof (card as { question?: unknown }).question === 'string'
          ? String((card as { question?: string }).question).trim()
          : '';
      const rubric =
        typeof (card as { rubric?: unknown }).rubric === 'string'
          ? String((card as { rubric?: string }).rubric).trim()
          : '';

      if (!question || !rubric) {
        return null;
      }

      const referenceAnswer =
        typeof (card as { referenceAnswer?: unknown }).referenceAnswer === 'string'
          ? String((card as { referenceAnswer?: string }).referenceAnswer).trim()
          : typeof (card as { reference_answer?: unknown }).reference_answer === 'string'
            ? String((card as { reference_answer?: string }).reference_answer).trim()
            : null;
      const difficultyHint =
        typeof (card as { difficultyHint?: unknown }).difficultyHint === 'string'
          ? String((card as { difficultyHint?: string }).difficultyHint).trim()
          : typeof (card as { difficulty_hint?: unknown }).difficulty_hint === 'string'
            ? String((card as { difficulty_hint?: string }).difficulty_hint).trim()
            : null;

      return {
        question,
        rubric,
        referenceAnswer: referenceAnswer || null,
        difficultyHint: difficultyHint || null,
      };
    })
    .filter((card): card is GeneratedCardInput => card !== null);

  if (parsed.length === 0) {
    throw new Error('LLM returned zero parseable cards');
  }

  return parsed;
}

function normalizeGradeResponse(raw: unknown): GradeResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('LLM grade response is not valid JSON');
  }

  const rawObj = raw as { grade?: unknown; feedback?: unknown };
  const parsedGrade = normalizeNumber(rawObj.grade);

  if (parsedGrade === null) {
    throw new Error('LLM grade response is missing a numeric grade');
  }

  const grade = Math.max(0, Math.min(1, parsedGrade));
  const feedback = typeof rawObj.feedback === 'string' ? rawObj.feedback.trim() : '';

  if (!feedback) {
    throw new Error('LLM grade response is missing feedback');
  }

  return {
    grade,
    feedback,
  };
}

function logGradingRequest(input: {
  cardId: number;
  prompt: string;
  response: string;
  parsedResponse: GradeResponse;
}) {
  console.info(
    JSON.stringify({
      event: 'grading_trace',
      cardId: input.cardId,
      timestamp: new Date().toISOString(),
      prompt: input.prompt,
      response: input.response,
      normalized: input.parsedResponse,
    }),
  );
}

export async function generateCardsFromDeck(input: {
  deckName: string;
  deckDescription?: string | null;
  sourceMaterial?: string | null;
  count: number;
}): Promise<GeneratedCardInput[]> {
  const model = process.env.GENERATION_MODEL;
  if (!model) {
    throw new Error('GENERATION_MODEL is not configured');
  }

  const context = [
    `Deck name: ${input.deckName}`,
    input.deckDescription ? `Deck description: ${input.deckDescription}` : null,
    input.sourceMaterial ? `Source material: ${input.sourceMaterial}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await requestOpenRouter<{ cards: GeneratedCardInput[] }>({
    model,
    temperature: 0.6,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are an expert study card generator. Return strict JSON only, no markdown.',
      },
      {
        role: 'user',
        content:
          `Create exactly ${input.count} study cards as JSON. Use this schema: {"cards":[{"question":"string","rubric":"string","referenceAnswer":"string or null","difficultyHint":"string or null"}]}.` +
          ' rubric should define expected answer criteria in clear detail. referenceAnswer can be blank if not directly provided.' +
          `\n\n${context}`,
      },
    ],
  });

  const parsed = normalizeGeneratedCards(raw.parsed);
  return parsed.slice(0, Math.max(1, input.count));
}

export async function gradeCardResponse(input: {
  question: string;
  rubric: string;
  referenceAnswer: string | null;
  difficultyHint: string | null;
  responseText: string;
  cardId: number;
}): Promise<GradeResponse> {
  const model = process.env.GRADING_MODEL;
  if (!model) {
    throw new Error('GRADING_MODEL is not configured');
  }

  const prompt = [
    'Grade the user response against the question and rubric.',
    `Question: ${input.question}`,
    `Rubric: ${input.rubric}`,
    input.referenceAnswer ? `Reference answer: ${input.referenceAnswer}` : null,
    input.difficultyHint ? `Difficulty hint: ${input.difficultyHint}` : null,
    `User response: ${input.responseText}`,
    'Return JSON only: {"grade":0.0-1.0,"feedback":"short feedback"}.',
    'Interpret grade as: 0.0 poor, 1.0 perfect.',
  ].filter(Boolean).join('\n');

  const raw = await requestOpenRouter<GradeResponse>({
    model,
    temperature: 0.2,
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a strict but fair grading assistant. Return strict JSON only, no markdown.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const parsed = normalizeGradeResponse(raw.parsed);
  logGradingRequest({
    cardId: input.cardId,
    prompt,
    response: raw.raw,
    parsedResponse: parsed,
  });

  return parsed;
}

export { normalizeNumber };
