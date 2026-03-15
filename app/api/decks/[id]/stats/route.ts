import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type GradeBucket = {
  again: number;
  hard: number;
  good: number;
  easy: number;
};

function bucketGrade(grade: number): keyof GradeBucket {
  const clamped = Math.max(0, Math.min(1, grade));
  if (clamped < 0.3) {
    return 'again';
  }
  if (clamped < 0.5) {
    return 'hard';
  }
  if (clamped < 0.8) {
    return 'good';
  }
  return 'easy';
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const deckId = Number(params.id);

  if (!Number.isInteger(deckId) || deckId <= 0) {
    return NextResponse.json({ error: 'invalid deck id' }, { status: 400 });
  }

  const deck = await db.deck.findUnique({ where: { id: deckId } });
  if (!deck) {
    return NextResponse.json({ error: 'deck not found' }, { status: 404 });
  }

  const now = new Date();
  const [totalCards, cardsDue, reviews] = await Promise.all([
    db.card.count({ where: { deckId } }),
    db.cardState.count({ where: { card: { deckId }, due: { lte: now } } }),
    db.review.findMany({
      where: { card: { deckId } },
      select: {
        llmGrade: true,
        reviewedAt: true,
      },
      orderBy: {
        reviewedAt: 'asc',
      },
    }),
  ]);

  const totalReviews = reviews.length;
  const gradeDistribution: GradeBucket = {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  };

  const reviewCountOverTime: { date: string; count: number }[] = [];
  const countsByDate = new Map<string, number>();

  for (const review of reviews) {
    gradeDistribution[bucketGrade(review.llmGrade)] += 1;

    const key = review.reviewedAt.toISOString().slice(0, 10);
    countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
  }

  for (const [date, count] of countsByDate.entries()) {
    reviewCountOverTime.push({
      date,
      count,
    });
  }

  reviewCountOverTime.sort((left, right) => left.date.localeCompare(right.date));

  const averageGrade =
    totalReviews === 0
      ? null
      : reviews.reduce((sum, review) => sum + review.llmGrade, 0) / totalReviews;

  return NextResponse.json({
    deckId: deck.id,
    totalCards,
    cardsDue,
    totalReviews,
    averageGrade,
    gradeDistribution,
    reviewCountOverTime,
  });
}
