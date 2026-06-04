/**
 * seats.ts — B2B licensing math (pure).
 *
 * A licensed "seat" is one learner account in an organization. Seats consumed =
 * memberships with orgRole MEMBER (the org's own OWNER/ADMIN are free overhead).
 * An org admin may create learners only while seats remain.
 */
export function remainingSeats(seats: number, used: number): number {
  return Math.max(0, seats - used);
}

/** Is there at least one free seat? (0 seats configured ⇒ never available.) */
export function seatAvailable(seats: number, used: number): boolean {
  return used < seats;
}
