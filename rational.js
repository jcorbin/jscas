"use strict";

window.CAS = (function(CAS) {

function gcd(a, b) {
    if (b > a) return gcd(b, a);
    return b == 0 ? a : gcd(b, a % b);
}

CAS.Rational = function(numer, denom) {
    var d = gcd(numer, denom);
    this.numer = numer / d;
    this.denom = denom / d;
}
CAS.Rational.make = function(numer, denom) {
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
    return denom == 1 ? numer*m : new CAS.Rational(numer*m, denom);
};
CAS.Rational.prototype = {
    "reciprocal": function() {
        return new CAS.Rational(this.denom, this.numer);
    },
    "add": function(other) {
        if (typeof other == "number") {
            return new CAS.Rational(
                this.numer + this.denom * other,
                this.denom
            );
        } else if (other instanceof CAS.Rational) {
            var d = gcd(this.denom, other.denom);
            return new CAS.Rational(
                this.numer * other.denom/d + other.numer * this.denom/d,
                this.denom * other.denom
            );
        } else {
            throw new Error('unimplemented');
        }
    },
    "subtract": function(other) {
        if (typeof other == "number") {
            return new CAS.Rational(
                this.numer - this.denom * other,
                this.denom
            );
        } else if (other instanceof CAS.Rational) {
            var d = gcd(this.denom, other.denom);
            return new CAS.Rational(
                this.numer * other.denom/d - other.numer * this.denom/d,
                this.denom * other.denom
            );
        } else {
            throw new Error('unimplemented');
        }
    },
    "multiply": function(other) {
        if (typeof other == "number") {
            return new CAS.Rational(
                this.numer * other,
                this.denom
            );
        } else if (other instanceof CAS.Rational) {
            return new CAS.Rational(
                this.numer * other.numer,
                this.denom * other.denom
            );
        } else {
            throw new Error('unimplemented');
        }
    },
    "divide": function(other) {
        if (typeof other == "number") {
            return new CAS.Rational(
                this.numer,
                this.denom * other
            );
        } else if (other instanceof CAS.Rational) {
            return new CAS.Rational(
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

return CAS;
})(window.CAS || {});
