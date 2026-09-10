/*
 * pdfjs-dist 6 uses several APIs that are newer than the minimum WebKit
 * versions we support. This file runs in the worker before the generated
 * PDF.js worker is imported, so older iPhone browsers fail gracefully instead
 * of reporting "undefined is not a function" while opening a PDF.
 */

if (typeof globalThis.Iterator === 'undefined') globalThis.Iterator = function Iterator() {};
if (typeof Iterator.prototype.join !== 'function') {
  Iterator.prototype.join = function join(separator) { return Array.from(this).join(separator); };
}

if (typeof Array.prototype.at !== 'function') {
  Array.prototype.at = function at(index) {
    const position = Number(index) || 0;
    const normalized = position < 0 ? this.length + position : position;
    return this[normalized];
  };
}

if (typeof Array.prototype.flatMap !== 'function') {
  Array.prototype.flatMap = function flatMap(callback, thisArg) {
    const result = [];
    for (let index = 0; index < this.length; index += 1) {
      if (index in this) {
        const value = callback.call(thisArg, this[index], index, this);
        if (Array.isArray(value)) result.push(...value);
        else result.push(value);
      }
    }
    return result;
  };
}

if (typeof String.prototype.replaceAll !== 'function') {
  String.prototype.replaceAll = function replaceAll(search, replacement) {
    if (search instanceof RegExp && !search.global) throw new TypeError('replaceAll requires a global regular expression');
    if (search instanceof RegExp) return this.replace(search, replacement);
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.replace(new RegExp(escaped, 'g'), replacement);
  };
}

if (typeof String.prototype.matchAll !== 'function') {
  String.prototype.matchAll = function matchAll(expression) {
    const regex = expression instanceof RegExp
      ? new RegExp(expression.source, expression.flags.includes('g') ? expression.flags : `${expression.flags}g`)
      : new RegExp(String(expression), 'g');
    const source = String(this);
    return (function* matches() {
      let match;
      while ((match = regex.exec(source)) !== null) {
        yield match;
        if (match[0] === '') regex.lastIndex += 1;
      }
    }());
  };
}

if (typeof Object.fromEntries !== 'function') {
  Object.fromEntries = function fromEntries(entries) {
    const result = {};
    for (const [key, value] of entries) result[key] = value;
    return result;
  };
}

if (typeof URL !== 'undefined' && typeof URL.parse !== 'function') {
  URL.parse = function parse(input, base) {
    try { return new URL(input, base); } catch { return null; }
  };
}

if (typeof Response !== 'undefined' && typeof Response.prototype.bytes !== 'function') {
  Response.prototype.bytes = async function bytes() { return new Uint8Array(await this.arrayBuffer()); };
}

if (typeof Uint8Array.fromBase64 !== 'function' && typeof atob === 'function') {
  Uint8Array.fromBase64 = function fromBase64(value) {
    const binary = atob(String(value).replace(/-/g, '+').replace(/_/g, '/'));
    const result = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index);
    return result;
  };
}

if (typeof Map.prototype.getOrInsert !== 'function') {
  Map.prototype.getOrInsert = function getOrInsert(key, value) {
    if (!this.has(key)) this.set(key, value);
    return this.get(key);
  };
}
if (typeof Map.prototype.getOrInsertComputed !== 'function') {
  Map.prototype.getOrInsertComputed = function getOrInsertComputed(key, callback) {
    if (!this.has(key)) this.set(key, callback(key));
    return this.get(key);
  };
}
if (typeof Map.prototype.getOrPutComputed !== 'function') {
  Map.prototype.getOrPutComputed = function getOrPutComputed(key, callback) {
    if (!this.has(key)) this.set(key, callback(key));
    return this.get(key);
  };
}

if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };
}

import('./pdf.worker.min.mjs');
