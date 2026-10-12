/** Presentation-only commentary; accepts content without snapshot or source dependencies. */
export type CommentaryEntry = { title: string; body: string };

export function CommentaryNotes({ notes, empty }: { notes: readonly CommentaryEntry[]; empty: string }) {
  if (!notes.length) return <p className="commentary-empty">{empty}</p>;
  return <>{notes.map((note, index) => <article className="commentary-note" key={index}>
    <h4 className="commentary-label">{note.title}</h4>
    <p className="commentary-body">{note.body}</p>
  </article>)}</>;
}
