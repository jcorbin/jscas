// Lexer example:
//   var lexer = new CAS.Lexer();
//   lexer.addRecognizer(/-?\d+(?:\.\d+)?(?:E\d+)?/, "Number"),
//   lexer.addRecognizer(/[()+\-*\/]/, "Symbol")
//   lexer.addRecognizer(/\w+/, "Word"),
//
//   var tokens = lexer.parse("2 + (3 - 2) * x");
//   tokens.all() == [
//     ["2","Number"],
//     ["+","Symbol"],
//     ["(","Symbol"],
//     ["3","Number"],
//     ["-","Symbol"],
//     ["2","Number"],
//     [")","Symbol"],
//     ["*","Symbol"],
//     ["x","Word"]
//   ]
//
//   tokens.reset()
//
//   tokens.token() == ["2","Number"]
//   tokens.token() == ["+","Symbol"]
//   ...
//   tokens.token() == ["x","Word"]
//   tokens.token() == null

var CAS = (function() {

var LexerParse = function(scanner, input) {
    this.scan = scanner;
    this.input = input;
    this.reset();
};
LexerParse.prototype.emptyRe = /^\s*$/;
LexerParse.prototype.reset = function() {
    this.working = this.input;
    this.position = 0;
    this.last = null;
};
// error(message, start, end) // error about a range
// error(message, start)      // end = end of string
// error(message)             // if last token, error about it, otherwise
//                            // position to end of input
LexerParse.prototype.error = function(message) {
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
LexerParse.prototype.all = function() {
    var tokens = [], token = null;
    while (token = this.token())
        tokens.push(token);
    return tokens;
};
LexerParse.prototype.token = function() {
    if (! this.working) return null;
    var match = this.scan(this.working);
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
    return [match.token, match.tokenTypeData];
};

function Lexer(recognizers) {
    this.recognizers = [];
}
Lexer.prototype.addRecognizer = function(regex, typeData) {
    if (typeof regex != "string") {
        if (! regex instanceof RegExp)
            throw new Error("Invalid regex");
        regex = regex.source;
    }
    regex = "^\\s*(" + regex + ")";
    regex = new RegExp(regex);

    this.recognizers.push(function(input) {
        var match = regex.exec(input);
        if (match) {
            match.token = match[1];
            match.tokenTypeData = typeData;
        }
        return match;
    });
};
Lexer.prototype.tokenMatcher = function(input) {
    for (var i=0, l=this.recognizers; i<l.length; i++) {
        var match = this.recognizers[i](input);
        if (match) return match;
    }
    return null;
;
};
Lexer.prototype.parse = function(input) {
    return new LexerParse(this.tokenMatcher.bind(this), input);
};

function Grammar() {
    this.lexer = new Lexer();
}

return {
    'Lexer': Lexer,
    'Grammar': Grammar
};
})();
