import { DomainEventBus } from "@/lib/domain-event-bus";

describe("DomainEventBus (Observer Pattern)", () => {
  let eventBus: DomainEventBus;

  beforeEach(() => {
    eventBus = new DomainEventBus();
  });

  afterEach(() => {
    eventBus.clear();
  });

  it("should subscribe to and receive published domain events", async () => {
    const handler = jest.fn();
    eventBus.subscribe("TRANSACTION_CREATED", handler);

    await eventBus.publish("TRANSACTION_CREATED", { id: "tx_123", amount: 100 }, "user_1");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "TRANSACTION_CREATED",
        userId: "user_1",
        payload: { id: "tx_123", amount: 100 },
      })
    );
  });

  it("should allow unsubscribing from domain events", async () => {
    const handler = jest.fn();
    const unsubscribe = eventBus.subscribe("ACCOUNT_UPDATED", handler);

    unsubscribe();
    await eventBus.publish("ACCOUNT_UPDATED", { id: "acc_1" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should handle error in event listener gracefully without crashing publisher", async () => {
    const faultyHandler = jest.fn().mockImplementation(() => {
      throw new Error("Handler failed");
    });
    const goodHandler = jest.fn();

    eventBus.subscribe("SECURITY_ALERT", faultyHandler);
    eventBus.subscribe("SECURITY_ALERT", goodHandler);

    await expect(
      eventBus.publish("SECURITY_ALERT", { type: "INVALID_LOGIN" })
    ).resolves.not.toThrow();

    expect(faultyHandler).toHaveBeenCalledTimes(1);
    expect(goodHandler).toHaveBeenCalledTimes(1);
  });
});
