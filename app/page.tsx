import Link from 'next/link';

import { db } from '@/lib/db';

type DeckSummary = {
  id: number;
  name: string;
  description: string | null;
  cardCount: number;
  dueCount: number;
};

const DECK_CARD_LIMIT = 20;
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const now = new Date();
  const dueCards = await db.cardState.findMany({
    where: {
      due: { lte: now },
    },
    select: {
      card: {
        select: {
          deckId: true,
        },
      },
    },
  });

  const dueByDeck = dueCards.reduce<Record<number, number>>((acc, row) => {
    const deckId = row.card?.deckId;
    if (!deckId) {
      return acc;
    }

    acc[deckId] = (acc[deckId] ?? 0) + 1;
    return acc;
  }, {});

  const decks = await db.deck.findMany({
    select: {
      id: true,
      name: true,
      description: true,
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

  const deckSummaries: DeckSummary[] = decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    description: deck.description,
    cardCount: deck._count.cards,
    dueCount: dueByDeck[deck.id] ?? 0,
  }));

  return (
    <main className="app-shell">
      <section className="card">
        <h1 className="title">Recall Dashboard</h1>
        <p className="muted">Review progress and deck management.</p>
        <div className="stat-grid">
          <article className="stat-card">
            <p className="stat-label">Cards due now</p>
            <p className="stat-value">{dueCards.length}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Decks</p>
            <p className="stat-value">{deckSummaries.length}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Total cards</p>
            <p className="stat-value">
              {deckSummaries.reduce((sum, deck) => sum + deck.cardCount, 0)}
            </p>
          </article>
        </div>
        <div className="inline-actions">
          <Link href="/review" className="btn btn-primary">
            Start review
          </Link>
          <Link href="/decks" className="btn btn-secondary">
            Open deck management
          </Link>
        </div>
      </section>

      <section className="card">
        <h2 className="subtitle">Decks</h2>
        {deckSummaries.length === 0 ? (
          <p className="muted">No decks yet. Add one from the deck screen.</p>
        ) : (
          <ul className="deck-list">
            {deckSummaries.slice(0, DECK_CARD_LIMIT).map((deck) => (
              <li className="deck-item" key={deck.id}>
                <div>
                  <h3>{deck.name}</h3>
                  <p className="muted">
                    {deck.description ? deck.description : 'No description'}
                  </p>
                  <p className="muted">
                    {deck.cardCount} cards · {deck.dueCount} due now
                  </p>
                </div>
                <Link href="/review" className="btn btn-secondary">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
