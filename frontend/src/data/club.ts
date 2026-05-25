export type ClubSectionData = {
  slug: string;
  title: string;
  displayName: string;
  metaTitle: string;
  metaDescription: string;
  lead: string;
};

export const clubSections: ClubSectionData[] = [
  {
    slug: "institucional",
    title: "INSTITUCIONAL",
    displayName: "Institucional",
    metaTitle: "Institucional | Club Social Varela Junior",
    metaDescription:
      "Información institucional del Club Social Varela Junior: misión, valores y datos del club.",
    lead: "Conocé la identidad, los valores y la propuesta del Club Social Varela Junior.",
  },
  {
    slug: "historia",
    title: "HISTORIA",
    displayName: "Historia",
    metaTitle: "Historia | Club Social Varela Junior",
    metaDescription: "Historia del Club Social Varela Junior.",
    lead: "Los hitos y el recorrido del club en la comunidad de Florencio Varela y alrededores.",
  },
  {
    slug: "autoridades",
    title: "AUTORIDADES",
    displayName: "Autoridades",
    metaTitle: "Autoridades | Club Social Varela Junior",
    metaDescription: "Comisión directiva y autoridades del Club Social Varela Junior.",
    lead: "Comisión directiva, vocales y áreas de gestión del club.",
  },
];

export function getClubSectionBySlug(slug: string): ClubSectionData | undefined {
  return clubSections.find((s) => s.slug === slug);
}

export function getAllClubSlugs(): string[] {
  return clubSections.map((s) => s.slug);
}
