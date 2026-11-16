/**
 * Classificação de matéria/assunto por radicais de palavra.
 *
 * A API do ENEM entrega só a grande área (`discipline`) e o texto. A
 * taxonomia "Matemática > Probabilidade" não existe em fonte nenhuma,
 * então derivamos aqui.
 *
 * Regras usam RADICAIS ("funco", "probabilidad", "porcentag") porque a
 * palavra aparece flexionada no enunciado: "função", "funções", "função
 * quadrática" precisam casar todas. Casar a palavra inteira dava recall
 * péssimo.
 *
 * É heurístico de propósito: erra em questão interdisciplinar, acerta na
 * maioria. A UI avisa que o assunto é estimado. Para trocar por um
 * classificador de verdade, basta substituir `classify()`.
 */

export function normalize(text) {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export const AREA_SUBJECTS = {
  matematica: { candidates: ["Matemática"], fallback: "Matemática" },
  "ciencias-natureza": {
    candidates: ["Física", "Química", "Biologia"],
    fallback: "Ciências da Natureza",
  },
  "ciencias-humanas": {
    candidates: ["História", "Geografia", "Filosofia", "Sociologia"],
    fallback: "Ciências Humanas",
  },
  linguagens: {
    candidates: ["Português", "Literatura"],
    fallback: "Português",
  },
};

/* ------------------------------------------------------------------ */
/* matéria                                                             */
/* ------------------------------------------------------------------ */

const SUBJECT_RULES = {
  Física: [
    "velocidad", "acelerac", "forca", "newton", "atrit", "gravidad",
    "energia", "potenci", "trabalh", "cinetic", "moment", "impuls",
    "corrente eletric", "tensao", "resist", "circuit", "ohm", "amper",
    "onda", "frequenc", "acustic", "luz", "espelh", "lent", "refrac",
    "reflex", "calor", "temperatur", "termometr", "dilatac", "pressao",
    "hidrostatic", "empux", "densidad", "campo magnetic", "magnet",
    "ima ", "eletromagnet", "radioativ", "quantic", "eletron", "particul",
    "relatividad", "movimento uniform", "queda livr", "projetil", "pendul",
    "colisao", "decibel", "volt", "watt", "joule", "caloria", "fusao",
    "ebulic", "vaporizac", "atrit", "newton", "trajetori", "deslocament",
  ],
  Química: [
    "molecul", "atom", "elemento quimic", "reacao quimic", "ligac",
    "acid", "base ", "ph ", "mol ", "molaridad", "soluc", "solvent",
    "solut", "oxidac", "reduc", "eletrolis", "organic", "carbon",
    "hidrocarbonet", "alcool", "isomer", "estequiometr", "equilibrio quimic",
    "catalis", "entalp", "termoquimic", "cinetica quimic", "radioisotop",
    "quimic", "reagent", "concentrac", "titulac", "pilha", "combusta",
    "polimer", "amid", "ester", "amin", "tabela periodic",
    "eletronegativid", "gas nobr", "halogen", "substanc", "mistur",
  ],
  Biologia: [
    "celul", "dna", "rna", "gene", "genetic", "protein", "enzim",
    "metabolism", "fotossintes", "respiracao celular", "ecossistem",
    "cadeia alimentar", "especie", "evoluc", "selecao natural", "bacteri",
    "virus", "fung", "planta", "animal", "tec-id", "orgao", "sistema nervos",
    "hormoni", "reproduc", "mitos", "meios", "bioma", "biodiversidad",
    "organismo", "populac", "predador", "herbivor", "carnivor",
    "membrana plasmatic", "mitocondri", "cloroplast", "hemaci",
    "vacina", "anticorp", "imunidad", "zoolog", "botanic", "anatom",
    "fisiolog", "alel", "fenotip", "genotip", "heredogram", "ecologi",
  ],
  História: [
    "revolucao", "imperi", "coloni", "escravidao", "escraviz", "ditadur",
    "guerra", "tratado", "constituic", "republic", "monarqui", "iluminism",
    "feudal", "burgues", "proletariad", "nazism", "fascism", "guerra fria",
    "independenc", "abolic", "vargas", "regime militar", "roma antig",
    "grecia", "egit", "mesopotami", "idade medi", "cruzad", "renasciment",
    "reforma protestant", "absolutism", "mercantilism", "colonialism",
    "imperialism", "primeira guerra", "segunda guerra", "holocaust",
    "revolucao industrial", "revolucao francesa", "revolucao russ",
    "coronelism", "oligarqu", "populism", "quinhentism", "sociedad",
    "cafe ", "colonizac", "metropol", "escambo", "bandeirant",
  ],
  Geografia: [
    "clima", "relev", "bioma", "urbanizac", "populac", "migrac",
    "agricultur", "pecuar", "industri", "globalizac", "fronteir",
    "cartografi", "coordenad", "hidrografi", "bacia", "solo", "erosao",
    "geopolitic", "comerci", "transport", "energia renovavel",
    "sustentabilidad", "amazoni", "latitud", "longitud", "umidad",
    "vegetac", "densidade demografic", "metropol", "periferi",
    "agronegoci", "extrativism", "litosfer", "desmatament", "poluic",
    "saneament", "urban", "rural", "territori", "paisagem", "recurso natural",
  ],
  Filosofia: [
    "filosofi", "filosof", "socrat", "platao", "aristotel", "kant",
    "hegel", "nietzsch", "descart", "hobbes", "locke", "rousseau", "marx",
    "etic", "moral", "epistemolog", "ontolog", "metafisic",
    "existencialism", "razao", "contrato social", "virtud", "bem e mal",
    "conscienci", "liberdad", "verdad", "conheciment", "estoicism",
    "epicurism", "escolastic", "empirism", "racionalism", "juizo",
    "sensac", "percepc", "vontade",
  ],
  Sociologia: [
    "sociologi", "sociedad", "classe social", "desigualdad", "cultur",
    "identidad", "movimento social", "cidadani", "estado", "poder",
    "capitalism", "gener", "raca", "etni", "comunidad", "instituic",
    "durkheim", "weber", "bourdieu", "anomi", "alienac", "mais-vali",
    "burocraci", "socializac", "preconceit", "segregac", "democraci",
    "politica public", "sindicat", "classe medi", "elit", "consum",
    "trabalh", "direito", "movimento negro", "feminism",
  ],
  Português: [
    "gramatic", "sintax", "morfolog", "verbo", "substantiv", "adjetiv",
    "pronome", "cras", "concordanci", "regenci", "oracao", "period",
    "figura de linguagem", "metafor", "ironi", "hiperbol", "eufemism",
    "genero textual", "charg", "tirinha", "propagand", "publicidad",
    "cart", "editorial", "notici", "cronic", "cont", "poem", "vers",
    "estrof", "variacao linguist", "norma cult", "linguagem", "libras",
    "intertextualidad", "ambiguidad", "denotac", "conotac", "coesao",
    "coerenci", "argumentac", "dissertac", "enem", "redacao",
  ],
  Literatura: [
    "literatur", "romantism", "realism", "modernism", "barroc",
    "arcadism", "parnasianism", "simbolism", "quinhentism", "naturalism",
    "pre-modernism", "machado de assis", "jose de alencar", "graciliano ramos",
    "drummond", "manuel bandeira", "clarice lispector", "guimaraes rosa",
    "fernando pessoa", "camoes", "gregorio de matos", "alvares de azevedo",
    "semana de arte moderna", "tropicalism", "literatura de cordel",
    "romanc", "poesi", "narrador", "personagem", "enred", "eu liric",
    "conto", "novela", "sonet", "prosopopei",
  ],
  Inglês: [
    "according", "author", "purpose", "meaning", "paragraph", "sentence",
    "statement", "text ", "reader", "the author", "because", "however",
  ],
  Espanhol: [
    "espanol", "segundo el autor", "proposito", "significado", "parrafo",
    "enunciado", "texto", "lector",
  ],
};

/* ------------------------------------------------------------------ */
/* assunto                                                             */
/* ------------------------------------------------------------------ */

export const TOPIC_RULES = {
  Matemática: {
    "Probabilidade e Estatística": [
      "probabilidad", "chanc", "sortei", "dado ", "moeda", "aleatori",
      "estatistic", " media ", "media aritmetic", "media dos", "media de",
      "median", "moda", "grafic", "amostr", "frequencia relativ",
      "aleatoriedad", "evento",
    ],
    "Análise Combinatória": [
      "combinac", "arranj", "permutac", "fatorial", "quantas maneiras",
      "de quantas formas", "possibilidades distintas", "principio multiplicativ",
      "quantos numeros", "quantas senhas", "quantos modos", "numero minimo",
      "quantidade minima",
    ],
    Funções: [
      "funco", "f(x)", "domini", "contradomini", "imagem da funco",
      "funcao afim", "funcao quadratic", "parabol", "coeficiente angular",
      "coeficiente linear", "raiz da funco", "primeiro grau",
      "segundo grau", "grafico da funco", "taxa de variac", "linear",
      "crescent", "decrescent",
    ],
    "Logaritmos e Exponenciais": [
      "logaritm", "log(", "log ", "exponencia", "base 10", "meia-vid",
      "crescimento exponencia", "juros compost",
    ],
    Trigonometria: [
      "seno", "cosseno", "tangent", "trigonometr", "angul", "radian",
      "sen ", "cos ", "tg ", "pitagor", "triangulo retangul",
      "lei dos senos", "lei dos cossenos", "ciclo trigonometr", "graus",
    ],
    "Geometria Plana": [
      "area", "perimetr", "triangul", "quadrad", "retangul", "circul",
      "circunferenc", "trapezi", "losang", "paralelogram", "poligon",
      "tales", "semelhanc", "angulo intern", "diagonal", "raio", "diametr",
      "setor circul", "hexagon", "pentagon", "moldura", "terreno",
    ],
    "Geometria Espacial": [
      "volum", "cubo", "paralelepiped", "cilindr", "cone", "esfer",
      "prism", "piramid", "arest", "tronco de cone", "capacidad", "litro",
      "metro cubic", "caixa d", "reservatori", "tanque",
    ],
    "Geometria Analítica": [
      "plano cartesian", "coordenad", "ponto medi", "distancia entre pont",
      "equacao da ret", "inclinac", "absciss", "ordenad", "vetor",
      "par ordenad", "reta r", "circunferencia de centr",
    ],
    "Progressões": [
      "progressao aritmetic", "progressao geometric", "razao da progress",
      "termo geral", "soma dos termos", "sequenci", "pa ", "pg ",
    ],
    "Matrizes e Determinantes": [
      "matriz", "determinant", "matriz identidad", "invers", "transpost",
      "sistema linear", "linha e colun",
    ],
    "Porcentagem e Juros": [
      "porcentag", "por cento", "%", "descont", "aument", "juros",
      "montant", "capital", "taxa de juros", "lucr", "prejuiz", "inflac",
      "acrescim", "promoc",
    ],
    "Números e Operações": [
      "numero inteir", "numero racional", "fraca", "decima", "divisa",
      "multiplicac", "mmc", "mdc", "raiz quadrad", "potenciac",
      "notacao cientific", "regra de tre", "proporc", "escal",
      "razao e proporc", "conjunto",
    ],
    "Grandezas e Medidas": [
      "medid", "unidade de medid", "compriment", "massa", "velocidade medi",
      "conversao de unidad", "km/h", "m/s", "horas", "minutos", "litros",
    ],
  },

  Física: {
    Cinemática: [
      "velocidad", "acelerac", "deslocament", "trajetori", "queda livr",
      "movimento uniform", "projetil", "referencial", "mru", "mruv",
    ],
    Dinâmica: [
      "forca", "newton", "massa", "atrit", "peso", "tracao",
      "plano inclinad", "lei de newton", "dinam", "equilibrio de forca",
    ],
    "Trabalho e Energia": [
      "trabalh", "energia cinetic", "energia potencial", "potenci",
      "conservacao de energia", "joule", "watt", "rendiment",
    ],
    "Impulso e Momento": [
      "impuls", "momento linear", "colisao", "quantidade de moviment",
      "choqu", "conservacao do momento",
    ],
    Hidrostática: [
      "pressao", "empux", "densidad", "hidrostatic", "flutuac",
      "pascal", "arquimedes", "coluna d",
    ],
    Termologia: [
      "calor", "temperatur", "dilatac", "calorimetr", "termometr",
      "escala termometric", "gas ideal", "termodinam", "entalp",
    ],
    Óptica: [
      "luz", "espelh", "lent", "refrac", "reflex", "foco", "imagem virtual",
      "prism", "fibra optic", "visao", "olho",
    ],
    Ondulatória: [
      "onda", "frequenc", "comprimento de onda", "som ", "decibel",
      "ressonanci", "efeito doppler", "espectr", "ultrassom",
    ],
    Eletricidade: [
      "corrente eletric", "tensao", "resist", "circuit", "ohm",
      "potencia eletric", "capacitor", "associacao de resist", "volt",
      "amper", "kwh", "consumo de energia eletric",
    ],
    Eletromagnetismo: [
      "campo magnetic", "magnet", "ima ", "induc", "eletromagnet",
      "bobina", "transformador", "motor eletric",
    ],
    "Física Moderna": [
      "quantic", "foton", "radioativ", "relatividad", "eletron",
      "particul", "energia nuclear", "fissao", "fusao nuclear",
    ],
  },

  Química: {
    Atomística: [
      "atom", "elemento quimic", "tabela periodic", "eletronegativid",
      "isotop", "modelo atomic", "orbital", "numero atomic",
    ],
    "Ligações Químicas": [
      "ligacao ionic", "ligacao covalent", "ligacao metalic", "polaridad",
      "molecul", "eletronegativid",
    ],
    "Funções Inorgânicas": [
      "acid", "base ", "sal ", "oxid", "ph ", "indicador", "neutralizac",
    ],
    Estequiometria: [
      "mol ", "estequiometr", "reagente limitant", "rendiment",
      "massa molar", "balanceament",
    ],
    Soluções: [
      "soluc", "solut", "solvent", "molaridad", "concentrac", "diluic",
      "solubilidad", "ppm",
    ],
    Termoquímica: [
      "entalp", "termoquimic", "calor de combust", "energia de ligac",
      "exotermic", "endotermic",
    ],
    Cinética: [
      "cinetica quimic", "velocidade da reac", "catalis", "energia de ativac",
    ],
    Equilíbrio: [
      "equilibrio quimic", "constante de equilibrio", "le chatelier",
      "deslocamento de equilibrio",
    ],
    Eletroquímica: [
      "eletrolis", "pilha", "oxidac", "reduc", "eletrod", "potencial de reduc",
    ],
    "Química Orgânica": [
      "organic", "carbon", "hidrocarbonet", "alcool", "isomer", "polimer",
      "ester", "amid", "amin", "cadeia carbonic", "funcao organic",
    ],
    Radioatividade: [
      "radioativ", "radioisotop", "meia-vid", "decaiment", "radiac",
    ],
    Gases: [
      "gas ", "lei dos gases", "mol de gas", "pressao e volum",
    ],
  },

  Biologia: {
    Citologia: [
      "celul", "membrana plasmatic", "mitocondri", "cloroplast", "organel",
      "citoplasm", "nucle", "mitos", "meios",
    ],
    Genética: [
      "gene", "dna", "rna", "genetic", "alel", "fenotip", "genotip",
      "heredogram", "mendel", "mutac",
    ],
    Evolução: [
      "evoluc", "selecao natural", "especiac", "ancestral", "adaptac",
      "darwin", "fossil",
    ],
    Ecologia: [
      "ecossistem", "cadeia alimentar", "teia alimentar", "bioma",
      "biodiversidad", "predador", "habitat", "nicho ecologic", "poluic",
    ],
    Botânica: [
      "planta", "fotossintes", "raiz", "caule", "folha", "flor",
      "sement", "xilem", "floem", "estomat",
    ],
    Zoologia: [
      "animal", "invertebrad", "vertebrad", "inset", "molusc",
      "artropod", "anfibi", "rept", "ave", "mamifer", "peix",
    ],
    "Fisiologia Humana": [
      "sistema nervos", "hormoni", "sangue", "coraca", "pulmao", "rim",
      "digesta", "respiratori", "circulatori", "imunidad", "vacina",
      "anticorp", "sistema imunolog",
    ],
    Bioquímica: [
      "protein", "enzim", "metabolism", "aminoacid", "lipidi",
      "carboidrat", "atp", "bioquimic",
    ],
    Reprodução: [
      "reproduc", "gamet", "fecundac", "embriao", "gestac",
      "ciclo menstrual", "contracepc",
    ],
    Microbiologia: [
      "bacteri", "virus", "fung", "protozoari", "microrganism", "antibiotic",
    ],
  },

  História: {
    "Brasil Colônia": [
      "coloni", "pau-brasil", "capitani", "quilomb", "bandeirant",
      "engenh", "escravidao", "escraviz", "sesmari",
    ],
    "Brasil Império": [
      "imperi", "dom pedro", "regenerac", "abolic", "lei aurea",
      "segundo reinad", "guerra do paraguai",
    ],
    "Brasil República": [
      "republic", "republica velh", "coronelism", "cafe com leit",
      "tenentism", "revolucao de 1930",
    ],
    "Era Vargas": ["vargas", "estado novo", "clt ", "era vargas", "getulio"],
    "Ditadura Militar": [
      "ditadur", "1964", "ai-5", "regime militar", "censur",
      "redemocratizac", "anistia",
    ],
    Antiguidade: [
      "grecia", "roma antig", "egit", "mesopotami", "antiguidad",
      "imperio roman", "atenas", "esparta",
    ],
    "Idade Média": [
      "idade medi", "feudal", "cruzad", "senhor feudal", "cristandad",
      "servid",
    ],
    "Idade Moderna": [
      "renasciment", "reforma protestant", "absolutism", "mercantilism",
      "grandes navegac", "iluminism",
    ],
    "Mundo Contemporâneo": [
      "revolucao industrial", "revolucao francesa", "guerra mundial",
      "nazism", "fascism", "guerra fria", "imperialism", "socialism",
      "holocaust", "revolucao russ",
    ],
  },

  Geografia: {
    Cartografia: [
      "cartografi", "escal", "coordenad", "latitud", "longitud",
      "projec", "curva de nivel", "mapa ",
    ],
    Climatologia: [
      "clima", "temperatur", "chuv", "umidad", "massa de ar", "el nino",
      "efeito estuf", "aqueciment global", "seca", "frente fria",
    ],
    Geomorfologia: [
      "relev", "erosao", "solo", "placa tectonic", "vulca", "montanh",
      "litosfer", "sedimentac",
    ],
    Hidrografia: [
      "hidrografi", "bacia hidrografic", "aquifer", "lencois freatic",
      "rio ", "afluent",
    ],
    "Geografia Agrária": [
      "agricultur", "pecuar", "agronegoci", "reforma agrari", "plantio",
      "colheit", "extrativism", "latifundi", "agricultura familiar",
    ],
    "Geografia Urbana": [
      "urbanizac", "cidad", "metropol", "periferi", "favel",
      "mobilidad urban", "segregac espacial", "urban",
    ],
    População: [
      "populac", "demografi", "migrac", "densidade demografic",
      "natalidad", "mortalidad", "piramid etari", "fluxo migratori",
    ],
    Geopolítica: [
      "geopolitic", "fronteir", "bloco economic", "mercosul",
      "uniao europeia", "conflit", "territori",
    ],
    "Economia e Globalização": [
      "globalizac", "industri", "comerci", "economi", "multinacional",
      "desindustrializac", "commodit", "exportac",
    ],
    "Meio Ambiente": [
      "meio ambient", "sustentabilidad", "poluic", "desmatament",
      "reciclagem", "energia renovavel", "amazoni", "queimad",
    ],
  },

  Filosofia: {
    "Filosofia Antiga": [
      "socrat", "platao", "aristotel", "mito da cavern", "estoicism",
      "epicurism", "presocratic",
    ],
    "Filosofia Medieval": [
      "agostinh", "tomas de aquino", "escolastic", "patristic", "medieval",
    ],
    "Filosofia Moderna": [
      "descart", "kant", "locke", "hobbes", "rousseau", "racionalism",
      "empirism", "contrato social", "iluminism",
    ],
    "Filosofia Contemporânea": [
      "nietzsch", "hegel", "marx", "existencialism", "sartre", "foucault",
      "escola de frankfurt", "fenomenolog",
    ],
    Ética: [
      "etic", "moral", "virtud", "bem e mal", "juizo moral", "utilitarism",
    ],
    Política: [
      "politic", "estado", "poder", "democraci", "liberdad", "justic",
      "cidadani",
    ],
    Epistemologia: [
      "conheciment", "verdad", "epistemolog", "metod", "cienci", "duvid",
    ],
  },

  Sociologia: {
    "Trabalho e Capitalismo": [
      "trabalh", "capitalism", "mais-vali", "alienac", "fordism",
      "taylorism", "sindicat", "proletariad",
    ],
    "Cultura e Identidade": [
      "cultur", "identidad", "etni", "raca", "gener", "diversidad",
      "preconceit", "movimento negro",
    ],
    "Cidadania e Estado": [
      "cidadani", "estado", "democraci", "direit", "constituic",
      "politica public", "voto",
    ],
    "Movimentos Sociais": [
      "movimento social", "protest", "mobilizac", "ativism", "reivindicac",
    ],
    Desigualdade: [
      "desigualdad", "classe social", "pobrez", "concentracao de renda",
      "exclusao", "segregac",
    ],
    Globalização: [
      "globalizac", "sociedade em red", "consum", "midi", "tecnologi",
    ],
  },

  Português: {
    "Interpretação de Texto": [
      "infere", "ideia central", "proposit", "sentido do text", "leitor",
      "intencao do autor", "assinale a alternativ",
    ],
    Gramática: [
      "gramatic", "sintax", "morfolog", "verbo", "substantiv", "adjetiv",
      "pronome", "cras", "concordanci", "regenci", "oraca", "period",
    ],
    "Variação Linguística": [
      "variacao linguist", "norma cult", "dialet", "regionalism",
      "linguagem formal", "linguagem inform", "sotaque",
    ],
    "Gêneros Textuais": [
      "genero textual", "charg", "tirinha", "propagand", "publicidad",
      "editorial", "notici", "cronic", "carta", "anunci",
    ],
    "Figuras de Linguagem": [
      "figura de linguagem", "metafor", "ironi", "hiperbol", "eufemism",
      "metonim", "antites", "personificac",
    ],
  },

  Literatura: {
    Quinhentismo: ["quinhentism", "carta de caminh", "literatura de informac"],
    Barroco: ["barroc", "gregorio de matos", "cultism", "conceptism"],
    Arcadismo: ["arcadism", "neoclassic", "tomas antonio gonzag"],
    Romantismo: [
      "romantism", "jose de alencar", "alvares de azevedo",
      "goncalves dias", "indianism",
    ],
    "Realismo e Naturalismo": [
      "realism", "naturalism", "machado de assis", "aluisio azevedo",
      "dom casmurr", "capitu",
    ],
    Simbolismo: ["simbolism", "cruz e sousa", "sinestesi"],
    "Pré-Modernismo": [
      "pre-modernism", "euclides da cunh", "lima barret", "monteiro lobat",
    ],
    Modernismo: [
      "modernism", "semana de arte modern", "mario de andrad", "drummond",
      "manuel bandeir", "tropicalism", "antropofag",
    ],
    Contemporânea: [
      "clarice lispector", "guimaraes rosa", "literatura contemporane",
      "concretism", "poesia marginal",
    ],
  },

  Inglês: {
    "Interpretação de Texto (Inglês)": [
      "according", "author", "purpose", "meaning", "paragraph", "statement",
    ],
  },

  Espanhol: {
    "Interpretação de Texto (Espanhol)": [
      "autor", "proposit", "significad", "parraf", "enunciad",
    ],
  },
};

/* ------------------------------------------------------------------ */
/* pontuação                                                           */
/* ------------------------------------------------------------------ */

function scoreRules(text, rules, weight = 1) {
  let score = 0;
  for (const rule of rules) {
    if (text.includes(rule)) score += (rule.length > 6 ? 2 : 1) * weight;
  }
  return score;
}

const EN_MARKERS = [
  " the ", " and ", " that ", " with ", " this ", " from ", " have ",
  " your ", " about ", " which ", " their ", " would ", " there ",
  " people ", " what ", " when ", " been ",
];

function countMarkers(text, markers) {
  const padded = ` ${text} `;
  return markers.reduce((acc, m) => acc + (padded.split(m).length - 1), 0);
}

/**
 * Enunciado e texto de apoio têm pesos diferentes de propósito: em
 * questão interpretativa o contexto é uma fonte longa e genérica, e
 * casar palavra-chave nele gera muito falso positivo. O comando da
 * questão (stem) é o sinal mais confiável.
 *
 * Matemática é a exceção: o enunciado raramente nomeia o conteúdo
 * ("qual o número mínimo de salas?"), mas o vocabulário matemático no
 * texto de apoio é específico o bastante para não gerar ruído.
 */
const DEFAULT_WEIGHTS = { stem: 3, context: 1, min: 5 };
const MATH_WEIGHTS = { stem: 2, context: 2, min: 3 };
const SUBJECT_MIN = 4;

function combinedScore(nStem, nContext, rules, weights) {
  return (
    scoreRules(nStem, rules, weights.stem) +
    scoreRules(nContext, rules, weights.context)
  );
}

export function classify({ area, language, stem, context, alternatives = [] }) {
  const nStem = normalize(stem);
  const nContext = normalize(`${context} ${alternatives.join(" ")}`);
  const weights = area === "matematica" ? MATH_WEIGHTS : DEFAULT_WEIGHTS;

  if (area === "linguagens") {
    // a API marca espanhol explicitamente; inglês nem sempre vem marcado
    const isEnglish =
      language === "ingles" ||
      (!language && countMarkers(normalize(`${stem} ${context}`), EN_MARKERS) >= 6);

    if (isEnglish) return { subject: "Inglês", topic: "Interpretação de Texto (Inglês)" };
    if (language === "espanhol") {
      return { subject: "Espanhol", topic: "Interpretação de Texto (Espanhol)" };
    }
  }

  if (area === "matematica") {
    return {
      subject: "Matemática",
      topic: pickTopic(nStem, nContext, "Matemática", weights),
    };
  }

  const conf = AREA_SUBJECTS[area] ?? { candidates: [], fallback: "Geral" };
  let best = null;
  let bestScore = 0;

  for (const subject of conf.candidates) {
    const score = combinedScore(nStem, nContext, SUBJECT_RULES[subject] ?? [], weights);
    if (score > bestScore) {
      bestScore = score;
      best = subject;
    }
  }

  const subject = bestScore >= SUBJECT_MIN ? best : conf.fallback;
  return { subject, topic: pickTopic(nStem, nContext, subject, weights) };
}

function pickTopic(nStem, nContext, subject, weights = DEFAULT_WEIGHTS) {
  const table = TOPIC_RULES[subject];
  if (!table) return "Geral";

  let best = "Geral";
  let bestScore = 0;
  for (const [topic, rules] of Object.entries(table)) {
    const score = combinedScore(nStem, nContext, rules, weights);
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }
  return bestScore >= weights.min ? best : "Geral";
}
