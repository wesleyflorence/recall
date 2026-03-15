import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const now = new Date();
  const limitValue = request.nextUrl.searchParams.get('limit');
  const requestedLimit = limitValue ? Number(limitValue) : 10;
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(Math.floor(requestedLimit), 50)) : 10;

  const rows = await db.cardState.findMany({
    where: {
      due: { lte: now },
    },
    include: {
      card: {
        select: {
          id: true,
          deckId: true,
          deck: {
            select: {
              name: true,
            },
          },
          question: true,
          rubric: true,
          referenceAnswer: true,
          difficultyHint: true,
        },
      },
    },
    orderBy: {
      due: 'asc',
    },
    take: limit,
  });

  const cards = rows.map((row) => ({
    cardId: row.cardId,
    due: row.due,
    card: {
      id: row.card.id,
      deckId: row.card.deckId,
      deckName: row.card.deck?.name ?? 'Deck',
      question: row.card.question,
      rubric: row.card.rubric,
      referenceAnswer: row.card.referenceAnswer,
      difficultyHint: row.card.difficultyHint,
    },
  }));

  return NextResponse.json({ cards, now });
}
