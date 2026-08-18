(function (global) {
    var ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    var lastTime = -1;
    var lastRandom = null;

    function getCrypto() {
        return global.crypto || (global.window && global.window.crypto);
    }

    function randomBytes(length) {
        var bytes = new Uint8Array(length);
        var cryptoRef = getCrypto();
        if (cryptoRef && cryptoRef.getRandomValues) {
            cryptoRef.getRandomValues(bytes);
            return bytes;
        }
        for (var i = 0; i < length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
        return bytes;
    }

    function encodeTime(now, length) {
        var time = Math.max(0, Number(now) || 0);
        var out = '';
        for (var i = length - 1; i >= 0; i--) {
            out = ENCODING[time % 32] + out;
            time = Math.floor(time / 32);
        }
        return out;
    }

    function encodeRandom(bytes, length) {
        var value = 0;
        var bits = 0;
        var out = '';

        for (var i = 0; i < bytes.length && out.length < length; i++) {
            value = (value << 8) | bytes[i];
            bits += 8;
            while (bits >= 5 && out.length < length) {
                bits -= 5;
                out += ENCODING[(value >> bits) & 31];
            }
        }

        if (out.length < length && bits > 0) {
            out += ENCODING[(value << (5 - bits)) & 31];
        }

        while (out.length < length) {
            out += ENCODING[0];
        }
        return out;
    }

    function incrementRandom(chars) {
        var next = chars.slice();
        for (var i = next.length - 1; i >= 0; i--) {
            var idx = ENCODING.indexOf(next[i]);
            if (idx < 31) {
                next[i] = ENCODING[idx + 1];
                return next;
            }
            next[i] = ENCODING[0];
        }
        return next;
    }

    function generateULID(now) {
        var ts = typeof now === 'number' ? now : Date.now();
        if (ts < lastTime) {
            ts = lastTime;
        }
        var randomChars;

        if (ts === lastTime && lastRandom) {
            randomChars = incrementRandom(lastRandom);
        } else {
            randomChars = encodeRandom(randomBytes(10), 16).split('');
        }

        lastTime = ts;
        lastRandom = randomChars;
        return encodeTime(ts, 10) + randomChars.join('');
    }

    var api = {
        generateULID: generateULID,
        _encodeTime: encodeTime,
        _encodeRandom: encodeRandom
    };

    global.FHUlid = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
