import { NextResponse } from 'next/server';

import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type ExportCardPayload = {
  question: string;
  rubric: string;
  referenceAnswer: string | null;
  difficultyHint: string | null;
};

type ExportDeckPayload = {
  version: number;
  deck: {
    name: string;
    description: string | null;
    sourceMaterial: string | null;
  };
  cards: ExportCardPayload[];
  exportedAt: string;
};

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const deckId = Number(params.id);

  if (!Number.isInteger(deckId) || deckId <= 0) {
    return NextResponse.json({ error: 'invalid deck id' }, { status: 400 });
  }

  const deck = await db.deck.findUnique({
    where: { id: deckId },
    select: {
      name: true,
      description: true,
      sourceMaterial: true,
      cards: {
        select: {
          question: true,
          rubric: true,
          referenceAnswer: true,
          difficultyHint: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!deck) {
    return NextResponse.json({ error: 'deck not found' }, { status: 404 });
  }

  const payload: ExportDeckPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    deck: {
      name: deck.name,
      description: deck.description,
      sourceMaterial: deck.sourceMaterial,
    },
    cards: deck.cards.map((card) => ({
      question: card.question,
      rubric: card.rubric,
      referenceAnswer: card.referenceAnswer,
      difficultyHint: card.difficultyHint,
    })),
  };

  const encodedName = encodeURIComponent(deck.name.toLowerCase().replace(/[^a-z0-9-_]/g, '-'));
  const fileName = `${encodedName || 'deck'}-${deckId}.json`;

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Type': 'application/json',
    },
  });
}
