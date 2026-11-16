export type ExamArea =
  | "matematica"
  | "ciencias-natureza"
  | "ciencias-humanas"
  | "linguagens";

export type Alternative = {
  letter: string;
  text: string;
  image: string | null;
};

export type Question = {
  id: string;
  exam: string;
  year: number;
  index: number;
  area: ExamArea;
  areaLabel: string;
  subject: string;
  topic: string;
  /** procedência da classificação (ex.: "regras@v1", "modelo@versão/prompt-v3") */
  classifiedBy?: string;
  language: string | null;
  context: string;
  stem: string;
  images: string[];
  alternatives: Alternative[];
  correct: string | null;
  sourceUrl: string;
};

/** versão enxuta usada na listagem (cabe inteira no bundle do cliente) */
export type CatalogEntry = {
  id: string;
  year: number;
  index: number;
  area: ExamArea;
  areaLabel: string;
  subject: string;
  topic: string;
  language: string | null;
  preview: string;
  hasImage: boolean;
};

export type Meta = {
  generatedAt: string;
  source: string;
  years: number[];
  total: number;
  bySubject: Record<string, number>;
};
