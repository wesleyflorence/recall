import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { gradeCardResponse } from '@/lib/llm';
import { mapLlmsGradeToFsrsRating, nextDueDateFromGrade } from '@/lib/fsrs';

export const dynamic = 'force-dynamic';

type ReviewCreateBody = {
  cardId?: number;
  responseText?: string;
  card_id?: number;
  response_text?: string;
};

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ReviewCreateBody;

  const cardId = asNumber((body as ReviewCreateBody).cardId ?? (body as ReviewCreateBody).card_id);
  const responseText =
    typeof body.responseText === 'string'
      ? body.responseText
      : typeof body.response_text === 'string'
        ? body.response_text
        : '';

  if (!Number.isInteger(cardId ?? NaN) || cardId === null || cardId <= 0) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
  }

  if (!responseText.trim()) {
    return NextResponse.json({ error: 'responseText is required' }, { status: 400 });
  }

  const card = await db.card.findUnique({
    where: { id: cardId },
    include: {
      cardState: true,
    },
  });

  if (!card) {
    return NextResponse.json({ error: 'card not found' }, { status: 404 });
  }

  if (!card.cardState) {
    return NextResponse.json({ error: 'card has no scheduling state' }, { status: 409 });
  }

  try {
    const grade = await gradeCardResponse({
      question: card.question,
      rubric: card.rubric,
      referenceAnswer: card.referenceAnswer,
      difficultyHint: card.difficultyHint,
      responseText,
      cardId: card.id,
    });

    const now = new Date();
    const fsrsState = nextDueDateFromGrade(
      {
        stability: card.cardState.stability,
        difficulty: card.cardState.difficulty,
        due: card.cardState.due,
        lastReview: card.cardState.lastReview,
        interval: card.cardState.interval,
        reps: card.cardState.reps,
        lapses: card.cardState.lapses,
        state: card.cardState.state,
      },
      grade.grade,
      now,
    );

    const review = await db.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          cardId,
          responseText,
          llmGrade: grade.grade,
          llmFeedback: grade.feedback,
          fsrsRating: mapLlmsGradeToFsrsRating(grade.grade),
        },
      });

      await tx.cardState.update({
        where: { cardId },
        data: {
          stability: fsrsState.stability,
          difficulty: fsrsState.difficulty,
          due: fsrsState.due,
          lastReview: fsrsState.lastReview,
          interval: fsrsState.interval,
          reps: fsrsState.reps,
          lapses: fsrsState.lapses,
          state: fsrsState.state,
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        review,
        fsrsState,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'review processing failed';

    const status = message.includes('not configured') || message.includes('LLM') ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
