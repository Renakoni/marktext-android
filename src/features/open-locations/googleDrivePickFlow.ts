/**
 * Ownership token for the in-flight Google Drive pick flow.
 *
 * A pick completes asynchronously (browser round trip, token exchange,
 * document download) while navigation stays free. "The user is on the
 * Open page" is NOT the same as "the user is still in the flow that
 * started this pick": leaving the page abandons the flow, and coming
 * back — possibly to start a different action — must not let the
 * abandoned completion through. The flow captures the generation when it
 * starts; every departure from the Open page invalidates it.
 */
export function createGoogleDrivePickFlow() {
  let generation = 0
  let activeGeneration = -1

  return {
    /** Call on every navigation away from the Open page. */
    noteLeftOpenPage() {
      generation++
    },
    /** Call when a pick flow starts (the busy lock allows only one). */
    beginFlow() {
      activeGeneration = generation
    },
    /** Whether an arriving completion still belongs to the active flow. */
    ownsCompletion() {
      return activeGeneration === generation
    },
  }
}
