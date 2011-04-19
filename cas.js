"use strict";

var CAS = (function() {

function Lexer(recognizer, input) {
    this.recognizer = recognizer;
    this.input = input;
    this.reset();
};
Lexer.prototype = {
    "emptyRe": /^\s*$/,
    "reset": function() {
        this.working = this.input;
        this.position = 0;
        this.token = null;
    },
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
        if (this.working == null) return null;
        var token = (recognizer || this.recognizer)(this.working) || null;
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
        if (expected !== undefined && token.value != expected)
            token.error("unexpected token, expecting " + expected);
        return this.token;
    },
    "take": function(expected) {
        var taken = this.token || this.recognize();
        if (expected !== undefined && taken.value != expected)
            taken.error("unexpected taken, expecting " + expected);
        this.token = this.recognize();
        return taken;
    }
};

var regex_escape = function(text) {
    return text.replace(this, "\\$&");
}.bind(/[-[\]{}()*+?.,\\^$|#\s]/g);

function regex_leading_ws(regex) {
    if (typeof regex != "string") {
        if (! regex instanceof RegExp)
            throw new Error("Invalid regex");
        regex = regex.source;
    }
    return new RegExp("^\\s*(" + regex + ")");
}

function Recognizer(regex, token_prototype) {
    this.regex = regex;
    this.token = function(consumed, value) {
        this.consumed = consumed;
        this.value = value;
    };
    this.token.prototype = token_prototype || Object;
}
Recognizer.prototype.recognize = function(input) {
    var match = this.regex.exec(input);
    if (! match) return null;
    return new this.token(match[0].length, match[1]);
};

function SymbolRecognizer(symbols) {
    this.token = function(consumed, value) {
        this.__proto__ = symbols[value];
        this.consumed = consumed;
        this.value = value;
    };
    this.regex = regex_leading_ws(
        Object.keys(symbols).map(regex_escape).join("|"));
}
SymbolRecognizer.prototype = Object.create(Recognizer.prototype);

function Parser(grammar, input) {
    this.grammar = grammar;
    var recognizer = grammar.recognizeToken.bind(grammar);
    Lexer.call(this, recognizer, input);
};
Parser.prototype = Object.create(Lexer.prototype);
Parser.prototype.__constructor__ = Parser;

Parser.prototype.expression = function(bp) {
    bp = bp || 0;
    var left = this.take().nud(this);
    while (bp < this.token.bp)
        left = this.take().led(this, left);
    return left;
};

// Note, symbol instances are set as the prototype of tokens which have the following properties:
//   type   the type of the token, set by recognizer
//   value  the contents of the token, set by recognizer
//   error  error reporting function, set by lexer
function Symbol(id, bp) {
    this.id = id;
    if (bp !== undefined)
        this.bp = bp;
}
Symbol.prototype = {
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

function Grammar() {
    this.tokens = [
        null // initial no-op symbol recognizer
    ];
    this.symbols = {};
    this.token('end', /$/);
}
Grammar.prototype = {
    "token": function(token, regex) {
        var sym = new Symbol("(" + token + ")");
        regex = regex_leading_ws(regex);
        this.tokens.push(new Recognizer(regex, sym));
        return sym;
    },

    "recognizeToken": function(input) {
        for (var i=0, l=this.tokens; i<l.length; i++) {
            var match = this.tokens[i].recognize(input);
            if (match) return match;
        }
        return null;
    },

    "parse": function(input) {
        var parser = new Parser(this, input);
        return parser.expression();
    },

    "updateSymbolRecognizer": function() {
        this.tokens[0] = new SymbolRecognizer(this.symbols);
    },

    "symbol": function(id, bp) {
        var s = this.symbols[id];
        if (! s)
            this.symbols[id] = s = new Symbol(id, bp);
        else if (bp != undefined && bp > s.bp)
            s.bp = bp;
        this.updateSymbolRecognizer();
        return s;
    },

    "literal": function(id, regex, constructor) {
        var sym = this.token(id, regex);
        sym.nud = function(parser) {
            try {
                return constructor(this.value);
            } catch (err) {
                this.error(err.message);
            }
        };
        return sym;
    },

    "prefix": function(id, bp, nud) {
        var sym = this.symbol(id);
        sym.nud = nud || function(parser) {
            this.expr = parser.expression(bp);
            return this;
        };
        return sym;
    },

    "postfix": function(id, bp, led) {
        var sym = this.symbol(id, bp);
        sym.led = led || function(parser, left) {
            this.expr = left;
            return this;
        };
        return sym;
    },

    "infixl": function(id, bp, led) {
        var sym = this.symbol(id, bp);
        sym.led = led || function(parser, left) {
            this.args = [left];
            this.args.push(parser.expression(bp));
            return this;
        };
        return sym;
    },

    "infixr": function(id, bp, led) {
        var sym = this.symbol(id, bp);
        bp -= 1;
        sym.led = led || function(parser, left) {
            this.args = [left];
            this.args.push(parser.expression(bp));
            return this;
        };
        return sym;
    }
};

return {
    'Grammar': Grammar
};
})();
