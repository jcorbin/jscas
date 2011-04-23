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

function Recognizer(recognizers) {
    this.recognizers = [];
    recognizers.forEach(function(r) {
        if (r instanceof Symbol)
            this.push(r.recognizer(), r);
        else
            this.push(r[0], r[1]);
    }, this.recognizers);
    this.update();
}
Recognizer.prototype = {
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
    "add": function(regex, prototype) {
        this.recognizers.push(regex, prototype);
        this.update();
    },
    "update": function() {
        var rs = [], i = -1, curws = false;
        for (var j=0; j<this.recognizers.length; j+=2) {
            var s = this.recognizers[j].source,
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
function Symbol(id, regex, bp, nud, led) {
    if (typeof regex == "string")
        regex = new RegExp("^\\s*(" + regex_escape(regex) + ")");
    this.id = id;
    this.regex = regex;
    this.merge(bp, nud, led);
}
Symbol.prototype = {
    "recognizer": function() {
        return this.regex ? this.regex
            : new RegExp("^\\s*(" + regex_escape(this.id) + ")");
    },
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
}

Grammar.Parser = function(grammar, input) {
    var rs = Object.keys(grammar.symbols).map(
        function(key) {return this[key]}, grammar.symbols);
    rs = rs.concat(grammar.tokens);
    rs.push(new Symbol("(end)", /^\s*()$/));
    this.recognizer = new Recognizer(rs);
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
        var sym = new Symbol("(" + token + ")", regex, 0, nud);
        this.tokens.push(sym);
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
            this.symbols[id] = s = new Symbol(id, null, bp, nud, led);
        else
            s.merge(bp, nud, led);
        return s;
    },

    "operator": function(symbol, bp, a, c) {
        var op = new BinaryOperator(symbol, bp, a, c);
        this.symbol(op.symbol);
        return op;
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

function gcd(a, b) {
    if (b > a) return gcd(b, a);
    return b == 0 ? a : gcd(b, a % b);
}

function RationalNumber(numer, denom) {
    var d = gcd(numer, denom);
    this.numer = numer / d;
    this.denom = denom / d;
}
RationalNumber.make = function(numer, denom) {
    var m = 1;
    if (numer < 0) {
        m *= -1;
        numer *= -1;
    }
    if (denom < 0) {
        m *= -1;
        denom *= -1;
    }
    var d = gcd(numer, denom);
    numer /= d;
    denom /= d;
    numer *= m;
    return denom == 1 ? numer*m : new RationalNumber(numer*m, denom);
};
RationalNumber.prototype = {
    "reciprocal": function() {
        return new RationalNumber(this.denom, this.numer);
    },
    "add": function(other) {
        if (typeof other == "number") {
            return new RationalNumber(
                this.numer + this.denom * other,
                this.denom
            );
        } else if (other instanceof RationalNumber) {
            var d = gcd(this.denom, other.denom);
            return new RationalNumber(
                this.numer * other.denom/d + other.numer * this.denom/d,
                this.denom * other.denom
            );
        } else {
            throw new Error('unimplemented');
        }
    },
    "subtract": function(other) {
        if (typeof other == "number") {
            return new RationalNumber(
                this.numer - this.denom * other,
                this.denom
            );
        } else if (other instanceof RationalNumber) {
            var d = gcd(this.denom, other.denom);
            return new RationalNumber(
                this.numer * other.denom/d - other.numer * this.denom/d,
                this.denom * other.denom
            );
        } else {
            throw new Error('unimplemented');
        }
    },
    "multiply": function(other) {
        if (typeof other == "number") {
            return new RationalNumber(
                this.numer * other,
                this.denom
            );
        } else if (other instanceof RationalNumber) {
            return new RationalNumber(
                this.numer * other.numer,
                this.denom * other.denom
            );
        } else {
            throw new Error('unimplemented');
        }
    },
    "divide": function(other) {
        if (typeof other == "number") {
            return new RationalNumber(
                this.numer,
                this.denom * other
            );
        } else if (other instanceof RationalNumber) {
            return new RationalNumber(
                this.numer * other.denom,
                this.denom * other.numer
            );
        } else {
            throw new Error('unimplemented');
        }
    },
    "toString": function() {
        return this.numer.toString()+"/"+this.denom.toString();
    },
    "toJSON": function() {
        return ["/", this.numer, this.denom];
    }
};

var Negative = function(expr) {
    this.expr = expr;
}
Negative.make = function(expr) {
    if (typeof expr == "number") {
        return -1 * expr;
    } else if (expr instanceof RationalNumber) {
        return new RationalNumber(expr.numer * -1, expr.denom);
    } else if (expr instanceof Negative) {
        return expr.expr;
    } else {
        return new Negative(expr);
    }
};
Negative.prototype = {
    "toString": function() {
        return "-" + this.expr.toString();
    },
    "toJSON": function() {
        return ["-", this.expr];
    }
};

function Variable(name) {
    this.name = name;
}
Variable.prototype = {
    "toString": function() {return this.name}
};
Variable.prototype.toJSON = Variable.prototype.toString;

function BinaryOperator(symbol_id, bp, associative, commutative) {
    if (associative === undefined)
        associative = true;
    if (commutative === undefined)
        commutative = true;
    this.associative = associative;
    this.commutative = commutative;
    this.rbp = bp;
    this.symbol = new Symbol(symbol_id, null, bp, null, this.led.bind(this));
    this.symbol.op = this;

    this.expression = extend(Array, function() {
        for (var i=0; i<arguments.length; i++)
            this.push(arguments[i]);
    }, {
        "op": this,
        "toString": function() {
            return this.join(" " + this.op.symbol.id + " ");
        },
        "toJSON": function() {
            var a = [this.op.symbol.id];
            for (var i=0; i<this.length; i++) a.push(this[i]);
            return a;
        }
    });
}
BinaryOperator.prototype = {
    "associative": true,
    "commutative": true,
    "led": function(parser, left) {
        var expr = parser.expression(this.rbp);
        if (this.associative && left instanceof this.expression)
            left.push(expr);
        else
            left = new this.expression(left, expr);
        return left;
    }
};

var Arithmetic = new Grammar();
Arithmetic.symbol(")");
Arithmetic.prefix("(", 0, function(parser) {
    var expr = parser.expression();
    parser.take(")");
    return expr;
});
Arithmetic.token("number", /^\s*(-?\d+(?:\.\d+)?(?:E-?\d+)?)/,
    function(parser) {
        var n = Number(this.value);
        if (isNaN(n))
            token.error("not a number");
        return n;
    });
Arithmetic.operator("+", 50);
Arithmetic.operator("-", 50);
Arithmetic.operator("*", 60);
Arithmetic.operator("/", 60);
Arithmetic.symbol('-').nud = function(parser) {
    return Negative.make(parser.expression(70));
};

return {
    'Grammar': Grammar,
    'RationalNumber': RationalNumber,
    'Variable': Variable,
    'BinaryOperator': BinaryOperator,
    'Arithmetic': Arithmetic
};
})();
