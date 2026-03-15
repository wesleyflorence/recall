import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type CreateDeckBody = {
  name?: string;
  description?: string | null;
  sourceMaterial?: string | null;
  source_material?: string | null;
};

function parseBody(payload: unknown): CreateDeckBody {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const sourceMaterial =
    'source_material' in payload
      ? (payload.source_material as string | null)
      : (payload as CreateDeckBody).sourceMaterial;

  return {
    name: typeof (payload as CreateDeckBody).name === 'string' ? (payload as CreateDeckBody).name : undefined,
    description:
      typeof (payload as CreateDeckBody).description === 'string'
        ? (payload as CreateDeckBody).description
        : null,
    sourceMaterial: typeof sourceMaterial === 'string' ? sourceMaterial : null,
  };
}

export async function GET() {
  const decks = await db.deck.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      sourceMaterial: true,
      createdAt: true,
      cards: {
        select: {
          id: true,
          question: true,
          rubric: true,
          referenceAnswer: true,
          difficultyHint: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      _count: {
        select: {
          cards: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return NextResponse.json(decks);
}

export async function POST(request: NextRequest) {
  const body = parseBody(await request.json().catch(() => ({})));

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const deck = await db.deck.create({
    data: {
      name: body.name.trim(),
      description: body.description,
      sourceMaterial: body.sourceMaterial,
    },
  });

  return NextResponse.json(deck, { status: 201 });
}
