import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Set default fallback env vars for test environment
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'mock-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/test';

// Mock Web API Headers, Request, and Response for Next.js API route tests in Jest environment
class MockHeaders {
  private map = new Map<string, string>();
  constructor(init?: any) {
    if (init) {
      if (typeof init.forEach === 'function') {
        init.forEach((v: string, k: string) => this.map.set(k.toLowerCase(), v));
      } else if (typeof init === 'object') {
        Object.entries(init).forEach(([k, v]) => this.map.set(k.toLowerCase(), String(v)));
      }
    }
  }
  get(name: string) { return this.map.get(name.toLowerCase()) || null; }
  set(name: string, value: string) { this.map.set(name.toLowerCase(), value); }
  append(name: string, value: string) {
    const existing = this.map.get(name.toLowerCase());
    this.map.set(name.toLowerCase(), existing ? `${existing}, ${value}` : value);
  }
  has(name: string) { return this.map.has(name.toLowerCase()); }
  delete(name: string) { this.map.delete(name.toLowerCase()); }
  forEach(callback: (value: string, key: string) => void) {
    this.map.forEach(callback);
  }
}

class MockRequest {
  url: string;
  method: string;
  headers: MockHeaders;
  private _body: any;
  constructor(input: any, init?: any) {
    this.url = typeof input === 'string' ? input : input?.url || 'http://localhost';
    this.method = init?.method || 'GET';
    this.headers = new MockHeaders(init?.headers);
    this._body = init?.body;
  }
  async json() {
    const b = (this as any)._json ?? (this as any)._bodyInit ?? this._body;
    if (typeof b === 'string') {
      try { return JSON.parse(b); } catch { return b; }
    }
    return b || {};
  }
  async text() {
    const b = (this as any)._json ?? (this as any)._bodyInit ?? this._body;
    if (typeof b === 'string') return b;
    return JSON.stringify(b || {});
  }
}

class MockResponse {
  status: number;
  statusText: string;
  headers: MockHeaders;
  _body: any;
  _json: any;
  constructor(body?: any, init?: any) {
    this.status = init?.status || 200;
    this.statusText = init?.statusText || 'OK';
    this.headers = new MockHeaders(init?.headers);
    this._body = body;
    this._json = typeof body === 'string' ? (function() { try { return JSON.parse(body); } catch { return body; } })() : body;
  }
  static json(data: any, init?: any) {
    const res = new MockResponse(JSON.stringify(data), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    });
    res._json = data;
    return res;
  }
  async json() {
    if (this._json !== undefined) return this._json;
    const b = (this as any)._bodyInit ?? this._body;
    if (typeof b === 'string') {
      try { return JSON.parse(b); } catch { return b; }
    }
    return b || {};
  }
  async text() {
    if (typeof this._body === 'string') return this._body;
    return JSON.stringify(this._json ?? this._body ?? {});
  }
}

if (typeof global.Request === 'undefined') {
  (global as any).Headers = MockHeaders;
  (global as any).Request = MockRequest;
  (global as any).Response = MockResponse;
}

if (!global.fetch) {
  global.fetch = jest.fn().mockImplementation(async () => new MockResponse('{}', { status: 200 })) as any;
}

// Override NextResponse.json so that in tests it returns a MockResponse with accessible .json()
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nextServer = require('next/server');
  if (nextServer && nextServer.NextResponse) {
    nextServer.NextResponse.json = function (data: any, init?: any) {
      return MockResponse.json(data, init);
    };
  }
} catch {}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver for Recharts and layout-aware components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
