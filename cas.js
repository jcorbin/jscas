"use strict";

window.CAS = (function(CAS) {

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

function BinaryOperator(symbol, bp, associative, commutative) {
    if (associative == undefined) this.associative = associative;
    if (commutative == undefined) this.commutative = commutative;
    CAS.Operator.call(this, symbol, bp);
    this.expression.prototype.toString = function() {
        return this
            .map(function(arg) {
                if (arg instanceof CAS.Operator.Expression
                    && this.bp >= arg.op.bp)
                    return "(" + arg + ")";
                else
                    return arg;
            }, this.op)
            .join(" " + this.op.symbol + " ");
    };
}
BinaryOperator.prototype = Object.create(CAS.Operator.prototype);
BinaryOperator.prototype.associative = true;
BinaryOperator.prototype.commutative = true;
BinaryOperator.prototype.led = function(parser, left) {
    var expr = parser.expression(this.rbp);
    if (this.associative && left instanceof this.expression)
        left.push(expr);
    else
        left = new this.expression(left, expr);
    return left;
};
CAS.Grammar.prototype.operator = function(symbol, bp, a, c) {
    return this.addSymbol(new BinaryOperator(symbol, bp, a, c));
};

CAS.Arithmetic.operator("+", 50);
CAS.Arithmetic.operator("-", 50).nud = function(parser) {
    return Negative.make(parser.expression(70));
};
CAS.Arithmetic.operator("*", 60);
CAS.Arithmetic.operator("/", 60);

CAS.RationalNumber = RationalNumber;
CAS.Variable = Variable;
CAS.BinaryOperator = BinaryOperator;

return CAS;
})(window.CAS || {});
