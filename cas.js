"use strict";

var CAS = (function() {

function mixin(target, props) {
    for (var i=0, l=Object.keys(props); i<l.length; i++)
        target[l[i]] = props[l[i]];
    return target;
}

function extend(base, constructor, props) {
    var proto = constructor.prototype = Object.create(base.prototype);
    proto.__constructor__ = constructor;
    if (props)
        mixin(proto, props)
    return constructor;
}

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

var SymbolRecognizer = extend(Recognizer, function(symbols) {
    this.symbols = symbols;
    this.token = function(consumed, value) {
        this.__proto__ = symbols[value];
        this.consumed = consumed;
        this.value = value;
    };
    this.regex = regex_leading_ws(
        Object.keys(symbols).map(regex_escape).join("|"));
});

function CompoundRecognizer(recognizers) {
    this.recognizers = [];
    recognizers.forEach(function(r) {
        if (r instanceof SymbolRecognizer)
            return Object.keys(r.symbols).forEach(function(key) {
                this.push("^\\s*("+regex_escape(key)+")", r.symbols[key]);
            }, this);
        else
            this.push(r.regex.source, r.token.prototype);
    }, this.recognizers);
    this.updateRegex();
}
CompoundRecognizer.prototype = {
    "recognize": function(input) {
        var match = this.regex.exec(input);
        for (var i=1; i<match.length; i++)
            if (match[i] !== undefined) {
                var token = Object.create(this.recognizers[2*i-1]);
                token.consumed = match[0].length;
                token.value = match[i];
                return token;
            }
        return null;
    },
    "addRecognizer": function(regex, prototype) {
        this.recognizers.push(regex, prototype);
        this.updateRegex();
    },
    "updateRegex": function() {
        var rs = [], i = -1, curws = false;
        for (var j=0; j<this.recognizers.length; j+=2) {
            var s = this.recognizers[j],
                ws = s.substr(0, 4) == "^\\s*";
            if (ws) {
                if (ws != curws) {
                    rs.push([]);
                    i++;
                    rs[i].prefix = s.substr(0, 4);
                }
                rs[i].push(s.substr(4));
            } else {
                rs.push(s);
                i++;
            }
            curws = ws;
        }
        rs = rs.map(function(r) {
            if (Array.isArray(r))
                return r.prefix + "(?:" + r.join("|") + ")";
            else
                return r;
        });
        if (rs.length > 1)
            rs = "(?:" + rs.join("|") + ")";
        else
            rs = rs[0];
        this.regex = rs = new RegExp(rs);
    }
};

// Note, symbol instances are set as the prototype of tokens which have the following properties:
//   type   the type of the token, set by recognizer
//   value  the contents of the token, set by recognizer
//   error  error reporting function, set by lexer
function Symbol(id, bp, nud, led) {
    this.id = id;
    this.merge(bp, nud, led);
}
Symbol.prototype = {
    "merge": function(bp, nud, led) {
        if (bp && bp > this.bp)
            this.bp = bp;
        if (nud)
            this.nud = nud;
        if (led)
            this.led = led;
        return this;
    },
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
    this.tokens = [];
    this.symbols = {};
    this.token('end', /$/);
}

Grammar.Parser = function(grammar, input) {
    this.recognizer = new CompoundRecognizer([
        new SymbolRecognizer(grammar.symbols)
    ].concat(grammar.tokens));
    this.input = this.working = input;
};
Grammar.Parser.prototype = {
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
        var token = recognizer.recognize(this.working) || null;
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
    },
    "expression": function(bp) {
        bp = bp || 0;
        var left = this.take().nud(this);
        while (bp < this.token.bp)
            left = this.take().led(this, left);
        return left;
    }
};

function infix_led(bp) {
    return function(parser, left) {
        var expr = parser.expression(bp);
        if (Array.isArray(left) && left[0] == this.value)
            left.push(expr);
        else
            left = [this.value, left, expr];
        return left;
    };
}

Grammar.prototype = {
    "token": function(token, regex, nud) {
        regex = regex_leading_ws(regex);
        var sym = new Symbol("(" + token + ")", 0, nud);
        this.tokens.push(new Recognizer(regex, sym));
        return sym;
    },

    "parse": function(input) {
        var parser = new Grammar.Parser(this, input);
        return parser.expression();
    },

    "symbol": function(id, bp, nud, led) {
        if (id instanceof Symbol) {
            var s = id;
            id = s.id;
            if (id in this.symbols)
                this.symbols[id].merge(s.bp, s.nud, s.led);
            else
                this.symbols[id] = s;
            return s;
        }
        var s = this.symbols[id];
        if (! s)
            this.symbols[id] = s = new Symbol(id, bp, nud, led);
        else
            s.merge(bp, nud, led);
        return s;
    },

    "literal": function(id, regex, constructor) {
        return this.token(id, regex, function(parser) {
            try {
                return constructor(this.value);
            } catch (err) {
                this.error(err.message);
            }
        });
    },

    "prefix": function(id, bp, nud) {
        return this.symbol(id, null, nud || function(parser) {
            return [this.value, parser.expression(bp)];
        });
    },

    "postfix": function(id, bp, led) {
        return this.symbol(id, bp, null, led || function(parser, left) {
            return [this.value, left];
        });
    },

    "infixl": function(id, bp, led) {
        return this.symbol(id, bp, null, led || infix_led(bp));
    },

    "infixr": function(id, bp, led) {
        return this.symbol(id, bp, null, led || infix_led(bp - 1));
    }
};

return {
    'Grammar': Grammar
};
})();
