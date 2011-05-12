"use strict";

window.CAS = (function(CAS) {

/*
 * The approach taken is an adaptation of Pratt parsing.
 *
 * Lexing is handled by each grammar token knowing how to recognize
 * itself. Grammar then creates a specific token object using the
 * registered token object as prototype.
 */

CAS.Parser = function(recognizer, input) {
    this.recognizer = recognizer;
    this.input = this.working = input;
};
CAS.Parser.prototype = {
    "position": 0,
    "token": null,
    "emptyRe": /^\s*$/,
    // error(message, start, end) // error about a range
    // error(message, start)      // end = end of string
    // error(message)             // if token, error about it, otherwise
    //                            // position to end of input
    "error": function(message, start, end) {
        var err = new Error(message);
        err.name = 'CAS.ParseError';
        err.input = this.input;
        err.start = start || this.position;
        err.end = end || this.input.length-1;
        throw err;
    },
    "error_context": function(start, end) {
        return function(message) {
            this.error(message, start, end);
        }.bind(this);
    },
    "recognize": function(recognizer) {
        recognizer = recognizer || this.recognizer;
        if (this.working == null) return null;
        var token = recognizer(this.working) || null;
        if (token) {
            var consumed = token.consumed,
                end = this.position + consumed;
            delete token.consumed;
            token.error = this.error_context(
                this.position + consumed - token.value.length,
                this.position + consumed
            );
            this.working = this.working.length
                ? this.working.substr(consumed) : null;
            this.position = end;
        } else {
            if (! this.emptyRe.test(this.working))
                this.error("unrecognized input");
            this.working = null;
        }
        return token;
    },
    "advance": function(expected) {
        this.token = this.recognize();
        if (expected != undefined && token.value != expected)
            token.error("unexpected token, expecting " + expected);
        return this.token;
    },
    "take": function(expected) {
        var taken = this.token || this.recognize();
        if (expected != undefined && taken.value != expected)
            taken.error("unexpected token, expecting " + expected);
        this.token = this.recognize();
        return taken;
    },
    "expression": function(bp) {
        bp = bp || 0;
        var left = this.take().nud(this);
        while (bp < this.token.bp)
            left = this.take().led(this, left);
        return left;
    }
};

CAS.Token = function(regex, bp, nud, led) {
    if (regex != undefined)
        this.regex = regex;
    if (bp && bp > this.bp) this.bp = bp;
    if (nud) this.nud = nud;
    if (led) this.led = led;
}
CAS.Token.prototype = {
    // BP:  Binding Power (infix)
    "bp":  0,
    // NUD: NUll left Denotation, operator has nothing to its left (prefix)
    "nud": function(parser) {
        this.error("syntax error");
    },
    // LED: LEft Denotation, op has something to left (postfix or infix)
    "led": function(parser, left) {
        this.error("unexpected token");
    }
};

var regex_escape = function(text) {
    return text.replace(this, "\\$&");
}.bind(/[-[\]{}()*+?.,\\^$|#\s]/g);

CAS.Symbol = function(symbol, bp, nud, led) {
    this.symbol = symbol;
    CAS.Token.call(this,
        new RegExp("^\\s*(" + regex_escape(symbol) + ")"),
        bp, nud, led);
}
CAS.Symbol.prototype = Object.create(CAS.Token.prototype);

return CAS;
})(window.CAS || {});
