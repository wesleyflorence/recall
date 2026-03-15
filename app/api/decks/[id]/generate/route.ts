import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { generateCardsFromDeck } from '@/lib/llm';
import { getInitialCardState } from '@/lib/fsrs';

type GenerateCardsBody = {
  count?: number;
};

export const dynamic = 'force-dynamic';

function parseCount(payload: unknown): number {
  const raw = typeof payload === 'object' && payload !== null ? (payload as GenerateCardsBody).count : undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.max(1, Math.min(25, Math.floor(parsed)));
}

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  const deckId = Number(context.params.id);
  if (!Number.isInteger(deckId) || deckId <= 0) {
    return NextResponse.json({ error: 'deck id is required' }, { status: 400 });
  }

  const deck = await db.deck.findUnique({
    where: { id: deckId },
    select: {
      id: true,
      name: true,
      description: true,
      sourceMaterial: true,
    },
  });

  if (!deck) {
    return NextResponse.json({ error: 'deck not found' }, { status: 404 });
  }

  const requestBody = await request.json().catch(() => ({}));
  const count = parseCount(requestBody);

  try {
    const generated = await generateCardsFromDeck({
      deckName: deck.name,
      deckDescription: deck.description,
      sourceMaterial: deck.sourceMaterial,
      count,
    });

    const now = new Date();
    const created = await db.$transaction(async (tx) => {
      const rows = [];
      for (const card of generated) {
        const createdCard = await tx.card.create({
          data: {
            deckId: deck.id,
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
        rows.push(createdCard);
      }

      return rows;
    });

    return NextResponse.json(
      {
        deckId: deck.id,
        cards: created,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'card generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
