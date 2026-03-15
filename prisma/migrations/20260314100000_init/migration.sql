-- CreateTable
CREATE TABLE "decks" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "source_material" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
  "id" SERIAL NOT NULL,
  "deck_id" INTEGER NOT NULL,
  "question" TEXT NOT NULL,
  "rubric" TEXT NOT NULL,
  "reference_answer" TEXT,
  "difficulty_hint" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cards_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reviews" (
  "id" SERIAL NOT NULL,
  "card_id" INTEGER NOT NULL,
  "response_text" TEXT NOT NULL,
  "llm_grade" DOUBLE PRECISION NOT NULL,
  "llm_feedback" TEXT,
  "fsrs_rating" INTEGER,
  "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "card_state" (
  "id" SERIAL NOT NULL,
  "card_id" INTEGER NOT NULL,
  "stability" DOUBLE PRECISION NOT NULL,
  "difficulty" DOUBLE PRECISION NOT NULL,
  "due" TIMESTAMP(3) NOT NULL,
  "last_review" TIMESTAMP(3),
  "interval" INTEGER,
  "reps" INTEGER NOT NULL DEFAULT 0,
  "lapses" INTEGER NOT NULL DEFAULT 0,
  "state" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "card_state_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "card_state_card_id_key" UNIQUE ("card_id"),
  CONSTRAINT "card_state_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "card_state_due_idx" ON "card_state"("due");
