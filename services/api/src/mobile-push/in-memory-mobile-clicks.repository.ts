import type { MobileClicksRepository, RecordMobileClickEventInput } from "./mobile-clicks.repository";

export class InMemoryMobileClicksRepository implements MobileClicksRepository {
  public readonly events: RecordMobileClickEventInput[] = [];

  async recordClickEvent(input: RecordMobileClickEventInput): Promise<void> {
    this.events.push(input);
  }
}
