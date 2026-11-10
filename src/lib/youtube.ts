/** Ricerca YouTube reale. Non inventiamo titoli di video. */
export function ytSearch(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}
