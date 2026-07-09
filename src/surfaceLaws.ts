export type SurfaceLaw = {
  id: string;
  number: string;
  title: string;
  paraphrase: string;
};

export const surfaceLaws: SurfaceLaw[] = [
  {
    id: "law-i",
    number: "I",
    title: "Ontological Neutrality",
    paraphrase: "You are not privileged by what you are.",
  },
  {
    id: "law-ii",
    number: "II",
    title: "Primacy of the Act",
    paraphrase: "Your event is what becomes qualified.",
  },
  {
    id: "law-iii",
    number: "III",
    title: "Public Verifiability",
    paraphrase: "Rules, proofs and verdicts remain inspectable.",
  },
  {
    id: "law-iv",
    number: "IV",
    title: "Irreducibility of Violation",
    paraphrase: "Governance does not end at prevention.",
  },
  {
    id: "law-v",
    number: "V",
    title: "Effectivity of Judgement",
    paraphrase: "A verdict must be able to take effect.",
  },
  {
    id: "law-vi",
    number: "VI",
    title: "Governance Autonomy",
    paraphrase: "Each governed matter may define its own regime.",
  },
];
