import { VERBS } from "./lexicon.mjs";
export function proofreadEnglish(text) {
  text = text.replace(/\b(am|are) cries easily\b/g, "cry easily")
    .replace(/\bis cries easily\b/g, "cries easily")
    .replace(/\b(?:am|are|is) cannot keep a secret\b/g, "cannot keep a secret")
    .replace(/\bat the (kitchen|room|bedroom|garden|forest)\b/gi, "in the $1")
    .replace(/\bat the (street|road)\b/gi, "on the $1");
  return text.replace(/\b([Ii]f) (I|you|he|she|we|they) will (not )?([^,]+)(?=,)/g,
    (whole, conjunction, subject, negative, predicate) => {
      const verb = [...VERBS].sort((a,b) => b.en.base.length-a.en.base.length)
        .find((v) => predicate === v.en.base || predicate.startsWith(v.en.base + " "));
      if (!verb) return whole;
      const third = /^(he|she)$/.test(subject);
      const head = negative ? (third ? "does not " : "do not ") + verb.en.base : (third ? verb.en.s : verb.en.base);
      return conjunction + " " + subject + " " + head + predicate.slice(verb.en.base.length);
    });
}
export function repeatedTemporalClause(text) {
  const match = /^(?:After|Before) (.+), (.+)[.!?]$/i.exec(text);
  return !!match && match[1].toLowerCase() === match[2].toLowerCase();
}
