// Runs `fn` over `items` with at most `concurrency` in flight at once. Order of
// completion is not preserved internally, but the returned array is — results[i]
// always corresponds to items[i], regardless of which finished first.
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const limit = Math.max(1, concurrency);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }

      results[index] = await fn(items[index]!, index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

// Splits `items` into arrays of at most `size`, preserving order. Used to bound
// peak memory and per-statement size (e.g. a single bulk INSERT) when a job's
// recipient list can run into the hundreds of thousands.
export function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

// Additive-increase/multiplicative-decrease controller. A processor observes
// provider pressure during one durable batch, then uses the adjusted limit for
// the next batch. This reacts to 429s/retries without introducing a global
// cross-job lock or an external rate-limiter service.
export class AdaptiveConcurrencyController {
  private pressureSamples = 0;
  private totalSamples = 0;

  constructor(
    readonly maximum: number,
    readonly minimum = Math.max(1, Math.floor(maximum / 4)),
    private currentValue = maximum,
  ) {
    this.currentValue = Math.min(Math.max(this.currentValue, this.minimum), this.maximum);
  }

  get current(): number {
    return this.currentValue;
  }

  observe(providerPressure: boolean): void {
    this.totalSamples += 1;
    if (providerPressure) this.pressureSamples += 1;
  }

  advanceWindow(): number {
    if (this.totalSamples === 0) return this.currentValue;
    const pressureRate = this.pressureSamples / this.totalSamples;
    if (pressureRate >= 0.05) {
      this.currentValue = Math.max(this.minimum, Math.floor(this.currentValue / 2));
    } else if (pressureRate === 0 && this.currentValue < this.maximum) {
      this.currentValue = Math.min(this.maximum, Math.max(this.currentValue + 1, Math.ceil(this.currentValue * 1.2)));
    }
    this.pressureSamples = 0;
    this.totalSamples = 0;
    return this.currentValue;
  }
}
