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

function Parser(recognizer, input) {
    this.recognizer = recognizer;
    this.input = this.working = input;
};
Parser.prototype = {
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
        if (expected != undefined && token.value != expected)
            token.error("unexpected token, expecting " + expected);
        return this.token;
    },
    "take": function(expected) {
        var taken = this.token || this.recognize();
        if (expected != undefined && taken.value != expected)
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

var regex_escape = function(text) {
    return text.replace(this, "\\$&");
}.bind(/[-[\]{}()*+?.,\\^$|#\s]/g);

// Note, Token instances are set as the prototype which then have the following
// properties added:
//   value  the contents of the token, set by recognizer
//   error  error reporting function, set by lexer
function Token(regex, bp, nud, led) {
    this.regex = regex;
    if (bp && bp > this.bp) this.bp = bp;
    if (nud) this.nud = nud;
    if (led) this.led = led;
}
Token.prototype = {
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

var Symbol = extend(Token, function Symbol(symbol, bp, nud, led) {
    this.symbol = symbol;
    Token.call(this,
        new RegExp("^\\s*(" + regex_escape(symbol) + ")"),
        bp, nud, led);
});

function Recognizer(recognizers) {
    this.recognizers = [];
    recognizers.forEach(function(r) {
        this.push(r.regex, r);
    }, this.recognizers);
    this.update();
}
Recognizer.prototype = {
    "recognize": function(input) {
        var match = this.regex.exec(input);
        if (! match) return null;
        for (var i=1; i<match.length; i++)
            if (match[i] != undefined) {
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
        this.regex = new RegExp(rs);
    }
};

function Grammar() {
    this.tokens = [
        (new Token(/^\s*()$/))
    ];
    this.symbols = [];
}

Grammar.prototype = {
    "parse": function(input) {
        var parser = new Parser(new Recognizer(
            this.symbols.concat(this.tokens)), input);
        return parser.expression();
    },

    "token": function(token, regex, nud) {
        var token = new Token(regex, 0, nud);
        this.tokens.splice(-1, 0, token);
        return token;
    },

    "symbol": function(symbol, bp, nud, led) {
        var symbol = new Symbol(symbol, bp, nud, led);
        this.symbols.push(symbol);
        return symbol;
    },

    "operator": function(symbol, bp, a, c) {
        var op = new BinaryOperator(symbol, bp, a, c);
        this.symbols.push(op);
        return op;
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

var Operator = extend(Symbol, function(symbol, bp, rbp) {
    this.rbp = rbp == undefined ? bp : rbp;
    Symbol.call(this, symbol, bp);

    this.expression = extend(Operator.Expression, function() {
        Operator.Expression.apply(this, arguments);
    }, {
        "op": this
    });
});

Operator.Expression = extend(Array, function() {
    for (var i=0; i<arguments.length; i++)
        this.push(arguments[i]);
}, {
    "toJSON": function() {
        var a = [this.op.symbol];
        for (var i=0; i<this.length; i++) a.push(this[i]);
        return a;
    }
});

var BinaryOperator = extend(Operator, function(symbol, bp, associative, commutative) {
    if (associative == undefined) this.associative = associative;
    if (commutative == undefined) this.commutative = commutative;
    Operator.call(this, symbol, bp);
    this.expression.prototype.toString = function() {
        return this
            .map(function(arg) {
                if (arg instanceof Operator.Expression
                    && this.bp >= arg.op.bp)
                    return "(" + arg + ")";
                else
                    return arg;
            }, this.op)
            .join(" " + this.op.symbol + " ");
    };
}, {
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
});

var Arithmetic = new Grammar();
Arithmetic.symbol(")");
Arithmetic.symbol("(").nud = function(parser) {
    var expr = parser.expression();
    parser.take(")");
    return expr;
};
Arithmetic.token("number", /^\s*(-?\d+(?:\.\d+)?(?:E-?\d+)?)/,
    function(parser) {
        var n = Number(this.value);
        if (isNaN(n))
            token.error("not a number");
        return n;
    });
Arithmetic.operator("+", 50);
Arithmetic.operator("-", 50).nud = function(parser) {
    return Negative.make(parser.expression(70));
};
Arithmetic.operator("*", 60);
Arithmetic.operator("/", 60);

return {
    'Grammar': Grammar,
    'RationalNumber': RationalNumber,
    'Variable': Variable,
    'BinaryOperator': BinaryOperator,
    'Arithmetic': Arithmetic
};
})();
