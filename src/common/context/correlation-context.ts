import { AsyncLocalStorage } from 'async_hooks';

export class CorrelationContext {
  private static readonly asyncLocalStorage = new AsyncLocalStorage<
    Map<string, string>
  >();

  public static run(correlationId: string, callback: () => void): void {
    const store = new Map<string, string>();
    store.set('correlationId', correlationId);
    this.asyncLocalStorage.run(store, callback);
  }

  public static getCorrelationId(): string | undefined {
    const store = this.asyncLocalStorage.getStore();
    return store?.get('correlationId');
  }
}
