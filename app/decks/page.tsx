import { db } from '@/lib/db';
import DecksClient from './DecksClient';

type DeckCardRow = {
  id: number;
  question: string;
  rubric: string;
  referenceAnswer: string | null;
  difficultyHint: string | null;
  createdAt: string;
};

type DeckRow = {
  id: number;
  name: string;
  description: string | null;
  sourceMaterial: string | null;
  createdAt: string;
  cards: DeckCardRow[];
};

export const dynamic = 'force-dynamic';

export default async function DeckManagementPage() {
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
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const initialDecks: DeckRow[] = decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    description: deck.description,
    sourceMaterial: deck.sourceMaterial,
    createdAt: deck.createdAt.toISOString(),
    cards: deck.cards.map((card) => ({
      id: card.id,
      question: card.question,
      rubric: card.rubric,
      referenceAnswer: card.referenceAnswer,
      difficultyHint: card.difficultyHint,
      createdAt: card.createdAt.toISOString(),
    })),
  }));

  return (
    <main className="app-shell">
      <section className="card">
        <h1 className="title">Deck Management</h1>
        <p className="muted">Create a deck, generate cards, and review card lists.</p>
      </section>
      <DecksClient initialDecks={initialDecks} />
    </main>
  );
}
