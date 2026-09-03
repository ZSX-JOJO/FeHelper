import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { describe, expect, it } from 'vitest';

function readSource(filePath) {
    return fs.readFileSync(path.resolve(filePath), 'utf8');
}

function loadDatetimeCalc() {
    const elements = {};
    const documentStub = {
        addEventListener() {},
        querySelector(selector) {
            return elements[selector] || null;
        },
        querySelectorAll() {
            return [];
        },
        getElementById(id) {
            return elements['#' + id] || null;
        },
        createElement() {
            return { style: {}, appendChild() {}, addEventListener() {} };
        },
        body: {
            appendChild() {},
            removeChild() {}
        },
        head: {
            appendChild() {}
        }
    };
    const sandbox = {
        console,
        Date,
        Intl,
        Math,
        setInterval() { return 1; },
        clearInterval() {},
        document: documentStub,
        navigator: { language: 'zh-CN' },
        chrome: {
            runtime: { sendMessage() {} },
            storage: { local: { get(_keys, cb) { cb && cb({}); }, set(_data, cb) { cb && cb(); } } }
        },
        window: {}
    };
    sandbox.window = sandbox;
    vm.runInNewContext(readSource('apps/datetime-calc/index.js'), sandbox, { filename: 'datetime-calc/index.js' });
    return sandbox;
}

describe('datetime-calc issue regressions', () => {
    it('Issue #644: parses historical 11-13 digit millisecond timestamps without treating short numbers as timestamps', () => {
        const app = loadDatetimeCalc();

        expect(app.TimeUtils.parseTimeInput('949680000000')).toMatchObject({
            timestamp: 949680000000,
            format: 'Unix时间戳(毫秒, 11-13位)'
        });
        expect(app.TimeUtils.parseTimeInput('12345678901').timestamp).toBe(12345678901);
        expect(app.TimeUtils.parseTimeInput('1234567890123').timestamp).toBe(1234567890123);
        expect(app.TimeUtils.parseTimeInput('2026').format).not.toContain('Unix时间戳');
    });

    it('Issue #635: supports explicit manual UTC offset while preserving automatic IANA conversion helpers', () => {
        const app = loadDatetimeCalc();

        expect(app.parseUTCOffsetMinutes('+08:00')).toBe(480);
        expect(app.parseUTCOffsetMinutes('-0500')).toBe(-300);
        expect(app.parseUTCOffsetMinutes('-5')).toBe(-300);
        expect(app.parseUTCOffsetMinutes('9.5')).toBe(570);
        expect(app.parseUTCOffsetMinutes('+9.5')).toBe(570);
        expect(app.parseUTCOffsetMinutes('UTC+9:30')).toBe(570);
        expect(app.parseUTCOffsetMinutes('GMT+5:45')).toBe(345);
        expect(app.formatUTCOffset(-300)).toBe('UTC-05:00');
        expect(app.getUTCTimestampFromFixedOffsetLocal('2026-08-15 00:00:00', 480))
            .toBe(Date.UTC(2026, 7, 14, 16, 0, 0));
        expect(() => app.parseUTCOffsetMinutes('+14:30')).toThrow('UTC 偏移范围');
        expect(() => app.parseUTCOffsetMinutes('UTC+14.25')).toThrow('UTC 偏移范围');
        expect(typeof app.getUTCTimestampFromLocal).toBe('function');
    });
});
