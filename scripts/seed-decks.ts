type DeckSeedSpec = {
  name: string;
  description: string;
  sourceMaterial: string;
  cardCount: number;
};

type DeckFromApi = {
  id: number;
  name: string;
  description: string | null;
  sourceMaterial: string | null;
};

type DeckWithCardCount = DeckFromApi & {
  _count: {
    cards: number;
  };
};

type CreateDeckBody = {
  name: string;
  description: string;
  sourceMaterial: string;
};

type GenerateCardsResponse = {
  deckId: number;
  cards: Array<{
    id: number;
  }>;
};

const API_BASE_URL = (process.env.RECALL_BASE_URL || 'http://localhost:18104/recall').replace(/\/$/, '');

const DECKS_TO_SEED: DeckSeedSpec[] = [
  {
    name: 'Music Theory',
    description:
      'Core music theory concepts across harmony, intervallic relationships, and voice-leading logic. Emphasize practical recall and conceptual precision.',
    sourceMaterial:
      'Topics: intervals (qualities, compound intervals, enharmonic function), triads and seventh chords (inversions, quality, tensions), common harmonic progressions, modal scales and borrowed colors, voice-leading constraints in SATB and lead-sheet contexts, and analysis of cadences and modulations.',
    cardCount: 20,
  },
  {
    name: 'European History',
    description:
      'A broad, open-ended review deck spanning classical to modern European history, designed to test causal reasoning and synthesis rather than rote memorization.',
    sourceMaterial:
      'Coverage should span Ancient Greece and Rome, Medieval institutions, Renaissance humanism, Reformation conflict, the Enlightenment, French Revolution and Napoleonic Europe, Industrialization and nationalism, both World Wars, the Cold War in Europe, European integration, and the social history of migration, empire, and identity.',
    cardCount: 20,
  },
  {
    name: 'Distributed Systems',
    description:
      'Open-ended distributed systems deck with strong emphasis on coordination, failure handling, and operational tradeoffs in modern infrastructure.',
    sourceMaterial:
      'Cover Kafka internals, partitioning and replication semantics, consumer groups, leader election and consensus families (Raft/Paxos), consistency models, partitions and network partitions, CRDT intuition, Kubernetes networking (services, ingress, CNI), service discovery, and failure recovery patterns.',
    cardCount: 20,
  },
  {
    name: 'Philosophy',
    description:
      'A curated philosophy deck covering core traditions, foundational arguments, and contemporary connections with an emphasis on accurate articulation.',
    sourceMaterial:
      'Include Stoicism (Epictetus, Seneca, Marcus Aurelius), epistemology (Plato to Gettier, rationalism/empiricism debates), and selected key thinkers (Aristotle, Descartes, Hume, Kant, Nietzsche, Russell, Foucault). Focus on strengths, critiques, and real-world implications.',
    cardCount: 20,
  },
];

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    ...init,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Request to ${url} failed (${response.status} ${response.statusText}): ${text}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Request to ${url} returned non-JSON response`);
  }
}

async function fetchDecks(): Promise<DeckWithCardCount[]> {
  return requestJson<DeckWithCardCount[]>('/api/decks');
}

async function createDeck(spec: DeckSeedSpec): Promise<DeckFromApi> {
  return requestJson<DeckFromApi>('/api/decks', {
    method: 'POST',
    body: JSON.stringify({
      name: spec.name,
      description: spec.description,
      sourceMaterial: spec.sourceMaterial,
    } as CreateDeckBody),
  });
}

async function generateCards(deckId: number, count: number): Promise<number> {
  const payload = await requestJson<GenerateCardsResponse>(`/api/decks/${deckId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ count }),
  });

  return payload.cards.length;
}

async function seedDeck(spec: DeckSeedSpec): Promise<{ name: string; deckId: number; before: number; generated: number }> {
  const decks = await fetchDecks();
  const existing = decks.find((deck) => deck.name.toLowerCase() === spec.name.toLowerCase());

  const deck = existing ?? (await createDeck(spec));
  const beforeCount = existing ? existing._count.cards : 0;
  const needed = Math.max(0, spec.cardCount - beforeCount);

  const generated = needed > 0 ? await generateCards(deck.id, needed) : 0;

  if (needed === 0) {
    console.log(`[seed] ${spec.name}: already has ${beforeCount} cards, skipping generation`);
  } else {
    console.log(`[seed] ${spec.name}: generated ${generated} cards (${beforeCount} -> ${beforeCount + generated})`);
  }

  return {
    name: spec.name,
    deckId: deck.id,
    before: beforeCount,
    generated,
  };
}

async function main() {
  const summaries: { name: string; deckId: number; before: number; generated: number }[] = [];

  for (const spec of DECKS_TO_SEED) {
    const result = await seedDeck(spec);
    summaries.push(result);
  }

  console.log('\nSeed complete:');
  for (const summary of summaries) {
    console.log(`- ${summary.name} (id ${summary.deckId}) generated ${summary.generated} card(s), pre-existing ${summary.before}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'seed-decks failed');
  process.exit(1);
});
