import { SSEManager } from './sse-manager';
import { ServerResponse } from 'http';

function mockResponse(): jest.Mocked<ServerResponse> {
  const res = {
    writableEnded: false,
    end: jest.fn(),
    write: jest.fn(),
    on: jest.fn(),
  } as unknown as jest.Mocked<ServerResponse>;
  return res;
}

describe('SSEManager', () => {
  let manager: SSEManager;

  beforeEach(() => {
    manager = new SSEManager();
  });

  it('starts with 0 connections', () => {
    expect(manager.size).toBe(0);
  });

  it('adds a connection and reports size 1', () => {
    const res = mockResponse();
    manager.add('user-1', res);
    expect(manager.size).toBe(1);
  });

  it('closes existing connection when same user reconnects', () => {
    const res1 = mockResponse();
    const res2 = mockResponse();

    manager.add('user-1', res1);
    manager.add('user-1', res2);

    expect(res1.end).toHaveBeenCalledTimes(1);
    expect(manager.size).toBe(1);
  });

  it('does not close existing if already ended', () => {
    const res1 = mockResponse();
    Object.defineProperty(res1, 'writableEnded', { value: true, writable: true });
    const res2 = mockResponse();

    manager.add('user-1', res1);
    manager.add('user-1', res2);

    expect(res1.end).not.toHaveBeenCalled();
  });

  it('removes a connection manually', () => {
    const res = mockResponse();
    manager.add('user-1', res);
    manager.remove('user-1');
    expect(manager.size).toBe(0);
  });

  it('handles multiple distinct users independently', () => {
    manager.add('user-1', mockResponse());
    manager.add('user-2', mockResponse());
    manager.add('user-3', mockResponse());
    expect(manager.size).toBe(3);
  });

  it('remove on unknown user id is a no-op', () => {
    expect(() => manager.remove('ghost-user')).not.toThrow();
    expect(manager.size).toBe(0);
  });

  it('auto-cleanup fires when close event is emitted', () => {
    const res = mockResponse();
    let closeHandler: () => void = () => {};
    res.on = jest.fn((event: string, handler: () => void) => {
      if (event === 'close') closeHandler = handler;
      return res;
    });

    manager.add('user-1', res);
    expect(manager.size).toBe(1);

    closeHandler();
    expect(manager.size).toBe(0);
  });
});
