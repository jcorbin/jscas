"use strict";

var CAS = (function() {

function Lexer(recognizer, input) {
    this.recognizer = recognizer;
    this.input = input;
    this.reset();
};
Lexer.prototype.emptyRe = /^\s*$/;
Lexer.prototype.reset = function() {
    this.working = this.input;
    this.position = 0;
    this.token = null;
};
// error(message, start, end) // error about a range
// error(message, start)      // end = end of string
// error(message)             // if token, error about it, otherwise
//                            // position to end of input
Lexer.prototype.error = function(message) {
    var start, end;
    if (arguments.length == 3) {
        start = arguments[1];
        end = arguments[2];
    } else if (arguments.length == 2) {
        start = arguments[1];
        end = this.input.length-1;
    } else {
        start = this.position;
        end = this.input.length-1;
    }
    var err = new Error(message);
    err.name = 'CAS.ParseError';
    err.input = this.input;
    err.start = start;
    err.end = end;
    throw err;
;
};
Lexer.prototype.error_context = function(start, end) {
    return function(message) {
        this.error(message, start, end);
    }.bind(this);
};
Lexer.prototype.advance = function() {
    if (! this.working) return null;
    var token = this.recognizer(this.working);
    if (! token) {
        if (! this.emptyRe.test(this.working))
            this.error("trailing garbage", this.position);
        else
            return null;
    }
    var consumed = token.consumed,
        end = this.position + consumed;
    delete token.consumed;
    token.error = this.error_context(
        this.position + consumed - token.value.length,
        this.position + consumed
    );
    this.working = this.working.substr(consumed);
    this.position = end;
    this.token = token;
    return token;
};
Lexer.prototype.take = function() {
    var taken = this.token || this.advance();
    this.advance();
    return taken;
};

function regex_escape(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function regex_recognizer(token, regex) {
    return function(input) {
        var match = this.exec(input);
        return match ? {
            "consumed": match[0].length,
            "type": token,
            "value": match[1]
        } : null;
    }.bind(regex_recognizer.prepare(regex));
}
regex_recognizer.prepare = function(regex) {
    if (typeof regex != "string") {
        if (! regex instanceof RegExp)
            throw new Error("Invalid regex");
        regex = regex.source;
    }
    return new RegExp("^\\s*(" + regex + ")");
};

function Parser(grammar, input) {
    this.grammar = grammar;
    var recognizer = grammar.recognizeToken.bind(grammar);
    Lexer.call(this, recognizer, input);
};
Parser.prototype = Object.create(Lexer.prototype);
Parser.prototype.__constructor__ = Parser;

Parser.prototype.advance = function(expected) {
    var token = Lexer.prototype.advance.call(this);
    if (! token)
        if (expected !== undefined)
            this.error("unexpected end of input");
        else
            return this.grammar.symbols["(end)"];
    else if (expected !== undefined && token.value != expected)
        token.error("unexpected token, expecting " + expected);
    var sym;
    switch (token.type) {
    case "symbol":
        sym = this.grammar.symbols[token.value];
        break;
    default:
        sym = this.grammar.symbols["(" + token.type + ")"];
        break;
    }
    if (! sym)
        token.error("undefined token");
    token.__proto__ = sym;
    return token;
};

Parser.prototype.expression = function(bp) {
    bp = bp || 0;
    var left = this.take().nud(this);
    while (bp < this.token.bp)
        left = this.take().led(this, left);
    return left;
};

function Grammar() {
    this.tokens = [
        function() {return null} // initial no-op symbol recognizer
    ];
    this.symbols = {};
    this.symbol("(end)");
}

// Note, symbol instances are set as the prototype of tokens which have the following properties:
//   type   the type of the token, set by recognizer
//   value  the contents of the token, set by recognizer
//   error  error reporting function, set by lexer
Grammar.Symbol = function(id, bp) {
    this.id = id;
    if (bp !== undefined)
        this.bp = bp;
}
Grammar.Symbol.prototype = {
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

Grammar.prototype.token = function(token, regex) {
    this.tokens.push(regex_recognizer(token, regex));
    return this.symbol("(" + token + ")");
};

Grammar.prototype.recognizeToken = function(input) {
    for (var i=0, l=this.tokens; i<l.length; i++) {
        var match = this.tokens[i](input);
        if (match) return match;
    }
    return null;
;
};
Grammar.prototype.parse = function(input) {
    var parser = new Parser(this, input);
    return parser.expression();
};

Grammar.prototype.updateSymbolRecognizer = function() {
    var symbols = [];
    for (var id in this.symbols)
        if (! /^\(.+\)$/.test(id))
            symbols.push(regex_escape(id));
    this.tokens[0] = regex_recognizer("symbol", symbols.join('|'));
};

Grammar.prototype.symbol = function(id, bp) {
    var s = this.symbols[id];
    if (! s) {
        if (bp != undefined)
            s = new Grammar.Symbol(id, bp);
        else
            s = new Grammar.Symbol(id);
        this.symbols[id] = s;
    } else if (bp != undefined && bp > s.bp) {
        s.bp = bp;
    }
    this.updateSymbolRecognizer();
    return s;
};

return {
    'Grammar': Grammar
};
})();
