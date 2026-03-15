import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = Number.parseInt(params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid card id' }, { status: 400 });
  }

  const card = await db.card.findUnique({ where: { id } });
  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  await db.card.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
