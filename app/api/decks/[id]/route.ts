import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid deck id' }, { status: 400 });
  }

  const deck = await db.deck.findUnique({ where: { id } });
  if (!deck) {
    return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
  }

  await db.deck.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
