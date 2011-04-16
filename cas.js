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
    this.last = null;
};
// error(message, start, end) // error about a range
// error(message, start)      // end = end of string
// error(message)             // if last token, error about it, otherwise
//                            // position to end of input
Lexer.prototype.error = function(message) {
    var start, end;
    if (arguments.length == 3) {
        start = arguments[1];
        end = arguments[2];
    } else if (arguments.length == 2) {
        start = arguments[1];
        end = this.input.length-1;
    } else if (this.last) {
        start = this.last[0];
        end = this.last[1];
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
Lexer.prototype.token = function() {
    if (! this.working) return null;
    var match = this.recognizer(this.working);
    if (! match) {
        if (! this.emptyRe.test(this.working))
            this.error("trailing garbage", this.position);
        else
            return null;
    }
    this.last = [
        this.position + match[0].length - match[1].length,
        this.position + match[0].length
    ];
    this.working = this.working.substr(match[0].length);
    this.position += match[0].length;
    return {
        "type": match.token,
        "value": match.value
    };
};

function regex_escape(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function regex_recognizer(token, regex) {
    return function(input) {
        var match = regex.exec(input);
        if (match) {
            match.token = token;
            match.value = match[1];
        }
        return match;
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

function Grammar() {
    this.tokens = [];
}

Grammar.prototype.token = function(token, regex) {
    this.tokens.push(regex_recognizer(token, regex));
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
    return parser;
};

return {
    'Lexer': Lexer,
    'Grammar': Grammar
};
})();
