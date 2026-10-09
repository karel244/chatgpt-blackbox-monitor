/** One active lifecycle, with at most one requested follow-up pass. */
export function coalescedFlush(pass: () => Promise<void>) {
  let inFlight: Promise<void> | undefined;
  let requested = false;
  return (): Promise<void> => {
    requested = true;
    if (!inFlight) {
      inFlight = Promise.resolve().then(async () => {
        try {
          while (requested) {
            requested = false;
            await pass();
          }
        } finally {
          inFlight = undefined;
        }
      });
    }
    return inFlight;
  };
}
