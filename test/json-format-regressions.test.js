import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');

function readSource(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function loadJsonLint() {
    const sandbox = { window: {} };
    vm.runInNewContext(readSource('apps/json-format/json-lint.js'), sandbox);
    return sandbox.window.JsonLint;
}

function runJsonWorker(jsonString, skin) {
    const messages = [];
    const sandbox = {
        BigInt,
        console,
        JSON,
        self: {
            postMessage(message) {
                messages.push(message);
            }
        }
    };
    vm.runInNewContext(readSource('apps/json-format/json-worker.js'), sandbox);
    sandbox.self.onmessage({ data: { jsonString, skin } });
    return messages;
}

describe('json-format issue regressions', () => {
    it('Issue #645: JsonLint does not quote pseudo keys inside string timestamps', () => {
        const lint = loadJsonLint();
        const result = lint.lintDetect('{"time":"2026-08-15 00:00:00"}');

        expect(result.hasError).toBeUndefined();
        expect(result.dom).not.toContain('errorEm');
    });

    it('Issue #645: JsonLint still flags unquoted keys near the real syntax error', () => {
        const lint = loadJsonLint();
        const result = lint.lintDetect('{name:"FeHelper", broken: }');

        expect(result.hasError).toBe(true);
        expect(result.dom).toContain('&quot;name&quot;');
        expect(result.dom).toContain('&quot;broken&quot;');
        expect(result.dom).toContain('errorEm');
    });

    it('Issue #642/#639/#636: formatter uses cached node values and delegated events', () => {
        const source = readSource('apps/json-format/format-lib.js');

        expect(source).toContain('let cachedJsonValue = null;');
        expect(source).toContain('cachedJsonValue = parsedJson;');
        expect(source).toContain('getPreservedValueAtPath');
        expect(source).toContain('let value = cachedJsonValue !== null ? cachedJsonValue : JSON.parse(cachedJsonString);');
        expect(source).toContain('let jsonSearchIndex = null;');
        expect(source).toContain('_ensureJsonSearchIndex()');
        expect(source).toContain('jsonSearchIndex.forEach(function (entry)');
        expect(source).toContain('_renderLargeJsonPlainView');
        expect(source).toContain('shouldUsePlainJsonView');
        expect(source).toContain("jfContent.off('.fhJsonTree')");
        expect(source).toContain("jfContent.on('click.fhJsonTree', 'span.expand'");
        expect(source).toContain("jfContent.on('click.fhJsonTree', '.item'");
        expect(source).not.toContain("$('#jfContent .item').each(function ()");
        expect(source).not.toContain("$('#jfContent .item').bind('click'");
        expect(source).not.toContain("jfOptEl.find('a.opt-download').unbind('click').bind('click'");
        expect(source).toContain('reindexArrayElementNodes');
        expect(source).toContain("arrayContainer.children('.item-array-element').toArray()");
    });

    it('Issue #640/#638: formatter download paths use safe stringify and window-note filenames', () => {
        const source = readSource('apps/json-format/format-lib.js');

        expect(source).toContain('sanitizeJsonDownloadFilename');
        expect(source).toContain('getJsonDownloadBasename');
        expect(source).toContain("aLink.download = filename + '.json';");
        expect(source).toContain("filename: filename + '.json'");
        expect(source).toContain('.replace(/"__FH_PRESERVE_INTEGER_KEY__(\\d+)":/g, \'"$1":\')');
        expect(source).toContain('let txt = _stringifyJsonNodeValue(el);');
        expect(source).toContain('downloadJsonBlobWithAnchor');
        expect(source).toContain('deletePreservedValueAtPath');
    });

    it('Issue #640: worker output never exposes preserved integer-key placeholders', () => {
        for (const skin of [undefined, 'theme-simple']) {
            const messages = runJsonWorker('{"2":{"3":1234567890123456789}}', skin);
            const formatted = messages.find(message => message[0] === 'FORMATTED');
            expect(formatted[1]).not.toContain('__FH_PRESERVE_INTEGER_KEY__');
            expect(formatted[1]).toContain('2');
            expect(formatted[1]).toContain('3');
        }
    });

    it('Issue #639/#636: large plain mode explicitly disables tree search and points to browser search', () => {
        const formatter = readSource('apps/json-format/format-lib.js');
        const contentScript = readSource('apps/json-format/content-script.js');

        expect(formatter).toContain('let largeJsonPlainViewEnabled = false;');
        expect(formatter).toContain("'大型 JSON 为完整文本视图，请使用浏览器查找'");
        expect(formatter).toContain('isLargeJsonPlainViewEnabled');
        expect(contentScript).toContain('Formatter.isLargeJsonPlainViewEnabled()');
        expect(contentScript).toContain(".text(searchDisabled ? '⌘F' : text)");
    });

    it('Issue #637/#638: page exposes offline JSON Schema and note-based JSONPath filenames', () => {
        const html = readSource('apps/json-format/index.html');
        const source = readSource('apps/json-format/index.js');

        expect(source).toContain('buildJsonSchema');
        expect(source).toContain('sanitizeJsonDownloadFilename');
        expect(source).toContain('getPreservedProperty');
        expect(html).toContain('@click="generateOfflineJsonSchema"');
        expect(html).toContain('离线 Schema');
        expect(source).toContain('generateOfflineJsonSchema: function()');
        expect(source).toContain('const schema = buildJsonSchema(jsonObj);');
        expect(source).toContain('getJsonDownloadBasename');
        expect(source).toContain('window.__fhJsonWindowNote = note;');
        expect(source).toContain('return sanitizeJsonDownloadFilename(this.windowNote, fallback);');
        expect(source).toContain('getPreservedProperty(current, prop)');
    });
});
