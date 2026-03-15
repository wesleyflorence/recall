import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getInitialCardState } from '@/lib/fsrs';

export const dynamic = 'force-dynamic';

type ImportCardPayload = {
  question?: string | null;
  rubric?: string | null;
  referenceAnswer?: string | null;
  difficultyHint?: string | null;
};

type NormalizedImportCard = {
  question: string;
  rubric: string;
  referenceAnswer: string | null;
  difficultyHint: string | null;
};

type ImportDeckSource = {
  name?: string | null;
  description?: string | null;
  sourceMaterial?: string | null;
};

type ImportPayload = {
  name?: string | null;
  description?: string | null;
  sourceMaterial?: string | null;
  source_material?: string | null;
  cards?: ImportCardPayload[] | unknown;
  deck?: ImportDeckSource & { cards?: ImportCardPayload[] | unknown };
  metadata?: {
    version?: number;
    sourceMaterial?: string | null;
    source_material?: string | null;
  };
};

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asCards(value: unknown): NormalizedImportCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const cards = value
    .map((row): NormalizedImportCard | null => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const question = asString((row as ImportCardPayload).question);
      const rubric = asString((row as ImportCardPayload).rubric);

      if (!question || !rubric) {
        return null;
      }

      return {
        question,
        rubric,
        referenceAnswer:
          asNullableString((row as ImportCardPayload).referenceAnswer) ??
          asNullableString((row as { reference_answer?: string | null }).reference_answer) ??
          null,
        difficultyHint:
          asNullableString((row as ImportCardPayload).difficultyHint) ??
          asNullableString((row as { difficulty_hint?: string | null }).difficulty_hint) ??
          null,
      };
    })
    .filter((row): row is NormalizedImportCard => row !== null);

  return cards;
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as ImportPayload;

  const deckSource = payload.deck && typeof payload.deck === 'object' ? payload.deck : null;
  const deckName = asString(deckSource?.name ?? payload.name);

  if (!deckName) {
    return NextResponse.json({ error: 'deck name is required' }, { status: 400 });
  }

  const description =
    asNullableString(deckSource?.description ?? payload.description) ?? payload.description?.trim() ?? null;
  const sourceMaterial =
    asNullableString(deckSource?.sourceMaterial ?? payload.sourceMaterial ?? payload.source_material) ??
    asNullableString(payload.metadata?.sourceMaterial) ??
    asNullableString(payload.metadata?.source_material) ??
    null;

  const cards = asCards(payload.cards ?? (deckSource?.cards ?? []));

  if (cards.length === 0) {
    return NextResponse.json({ error: 'at least one card is required' }, { status: 400 });
  }

  try {
    const deck = await db.$transaction(async (tx) => {
      const createdDeck = await tx.deck.create({
        data: {
          name: deckName,
          description,
          sourceMaterial,
        },
      });

      const now = new Date();
      for (const card of cards) {
        const createdCard = await tx.card.create({
          data: {
            deckId: createdDeck.id,
            question: card.question,
            rubric: card.rubric,
            referenceAnswer: card.referenceAnswer,
            difficultyHint: card.difficultyHint,
          },
        });

        const state = getInitialCardState(now);
        await tx.cardState.create({
          data: {
            cardId: createdCard.id,
            stability: state.stability,
            difficulty: state.difficulty,
            due: state.due,
            lastReview: state.lastReview,
            interval: state.interval,
            reps: state.reps,
            lapses: state.lapses,
            state: state.state,
          },
        });
      }

      return createdDeck;
    });

    return NextResponse.json(
      {
        deckId: deck.id,
        cardCount: cards.length,
        deckName: deck.name,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'deck import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
