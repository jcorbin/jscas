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

function Variable(name) {
    this.name = name;
}
Variable.prototype = {
    "toString": function() {return this.name}
};
Variable.prototype.toJSON = Variable.prototype.toString;

CAS.RationalNumber = RationalNumber;
CAS.Variable = Variable;

return CAS;
})(window.CAS || {});
