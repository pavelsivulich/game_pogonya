const handlers = new Map();

export const bus = {
  on(evt, fn) {
    if (!handlers.has(evt)) handlers.set(evt, new Set());
    handlers.get(evt).add(fn);
    return () => bus.off(evt, fn);
  },
  off(evt, fn) { handlers.get(evt)?.delete(fn); },
  emit(evt, payload) {
    handlers.get(evt)?.forEach(fn => {
      try { fn(payload); } catch (e) { console.error(`[${evt}]`, e); }
    });
  },
};
