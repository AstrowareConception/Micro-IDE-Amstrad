// Expected counters qualified on the identified CPC 6128 English firmware.
// No firmware bytes or variable values are exported by the flow analyzer.
export const loopErrorCases = [
  {
    "name": "while-next",
    "main": "30 WHILE x<2:ERROR 5:x=x+1:WEND:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:RESUME NEXT",
    "expected": {
      "x": 2,
      "errors": 2,
      "counter": 0,
      "errorCode": 0
    }
  },
  {
    "name": "for-next",
    "main": "30 FOR i=1 TO 2:ERROR 5:x=x+1:NEXT i:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:RESUME NEXT",
    "expected": {
      "x": 2,
      "errors": 2,
      "counter": 3,
      "errorCode": 0
    }
  },
  {
    "name": "while-call",
    "main": "30 WHILE x<2:GOSUB 1000:WEND:GOTO 800",
    "routine": "1000 ERROR 5:x=x+1:RETURN",
    "handler": "2000 n=n+1:RESUME NEXT",
    "expected": {
      "x": 2,
      "errors": 2,
      "counter": 0,
      "errorCode": 0
    }
  },
  {
    "name": "for-call",
    "main": "30 FOR i=1 TO 2:GOSUB 1000:NEXT i:GOTO 800",
    "routine": "1000 ERROR 5:x=x+1:RETURN",
    "handler": "2000 n=n+1:RESUME NEXT",
    "expected": {
      "x": 2,
      "errors": 2,
      "counter": 3,
      "errorCode": 0
    }
  },
  {
    "name": "return-while",
    "main": "30 GOSUB 1000:x=x+100:GOTO 800",
    "routine": "1000 WHILE 1:ERROR 5:x=99:WEND:RETURN",
    "handler": "2000 n=n+1:RETURN",
    "expected": {
      "x": 100,
      "errors": 1,
      "counter": 0,
      "errorCode": 0
    }
  },
  {
    "name": "return-for",
    "main": "30 GOSUB 1000:x=x+100:GOTO 800",
    "routine": "1000 FOR i=1 TO 2:ERROR 5:x=99:NEXT i:RETURN",
    "handler": "2000 n=n+1:RETURN",
    "expected": {
      "x": 100,
      "errors": 1,
      "counter": 1,
      "errorCode": 0
    }
  },
  {
    "name": "handler-while",
    "main": "30 ERROR 5:x=x+1:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:WHILE x<2:x=x+1:WEND:RESUME NEXT",
    "expected": {
      "x": 3,
      "errors": 1,
      "counter": 0,
      "errorCode": 0
    }
  },
  {
    "name": "handler-for",
    "main": "30 ERROR 5:x=x+1:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:FOR i=1 TO 2:x=x+1:NEXT i:RESUME NEXT",
    "expected": {
      "x": 3,
      "errors": 1,
      "counter": 3,
      "errorCode": 0
    }
  },
  {
    "name": "pending-while",
    "main": "30 WHILE x<2:ERROR 5:x=x+1:WEND:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:WHILE 1:RESUME NEXT:WEND",
    "expected": {
      "x": 2,
      "errors": 2,
      "counter": 0,
      "errorCode": 0
    }
  },
  {
    "name": "pending-for",
    "main": "30 FOR i=1 TO 2:ERROR 5:x=x+1:NEXT i:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:FOR j=1 TO 2:RESUME NEXT:NEXT j",
    "expected": {
      "x": 2,
      "errors": 2,
      "counter": 3,
      "errorCode": 0
    }
  },
  {
    "name": "cross-call-wend",
    "main": "30 WHILE x<2:GOSUB 1000:WEND:GOTO 800",
    "routine": "1000 x=x+1:GOTO 40\n40 WEND:RETURN",
    "handler": "2000 n=n+1:POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 0,
      "errorCode": 30
    }
  },
  {
    "name": "cross-call-next",
    "main": "30 FOR i=1 TO 2:GOSUB 1000:NEXT i:GOTO 800",
    "routine": "1000 x=x+1:GOTO 40\n40 NEXT i:RETURN",
    "handler": "2000 n=n+1:POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 1,
      "errorCode": 1
    }
  },
  {
    "name": "resume-retains-while",
    "main": "30 ERROR 5:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:ON ERROR GOTO 2200:WHILE x<1:RESUME 2010\n2010 x=x+1:WEND\n2020 GOTO 800\n2200 POKE &8103,ERR:GOTO 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 0,
      "errorCode": 0
    }
  },
  {
    "name": "resume-retains-for",
    "main": "30 ERROR 5:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:ON ERROR GOTO 2200:FOR i=1 TO 1:RESUME 2010\n2010 x=x+1:NEXT i:GOTO 800\n2200 POKE &8103,ERR:GOTO 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 2,
      "errorCode": 0
    }
  },
  {
    "name": "while-bypasses-for",
    "main": "30 WHILE x<2:ERROR 5:x=x+1:WEND:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:FOR j=1 TO 2:RESUME NEXT:NEXT j",
    "expected": {
      "x": 2,
      "errors": 2,
      "counter": 0,
      "errorCode": 0
    }
  },
  {
    "name": "for-bypasses-while",
    "main": "30 FOR i=1 TO 2:ERROR 5:x=x+1:NEXT i:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:WHILE 1:RESUME NEXT:WEND",
    "expected": {
      "x": 2,
      "errors": 2,
      "counter": 3,
      "errorCode": 0
    }
  },
  {
    "name": "return-clears-while",
    "main": "30 GOSUB 1000:GOTO 1010",
    "routine": "1000 WHILE x<1:x=x+1:RETURN\n1010 WEND:GOTO 800",
    "handler": "2000 n=n+1:POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 0,
      "errorCode": 30
    }
  },
  {
    "name": "return-clears-for",
    "main": "30 GOSUB 1000:GOTO 1010",
    "routine": "1000 FOR i=1 TO 1:x=x+1:RETURN\n1010 NEXT i:GOTO 800",
    "handler": "2000 n=n+1:POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 1,
      "errorCode": 1
    }
  },
  {
    "name": "goto-repeat-while",
    "main": "30 WHILE x<2:x=x+1:GOTO 30:WEND\n40 GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 2,
      "errors": 0,
      "counter": 0,
      "errorCode": 0
    }
  },
  {
    "name": "goto-repeat-for",
    "main": "30 FOR i=1 TO 2:x=x+1:IF x<2 THEN GOTO 30\n40 NEXT i:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 3,
      "errors": 0,
      "counter": 3,
      "errorCode": 0
    }
  },
  {
    "name": "outer-for-inner-while",
    "main": "30 FOR i=1 TO 2:GOSUB 1000:NEXT i:GOTO 800",
    "routine": "1000 WHILE 1:ERROR 5:x=x+1:RETURN:WEND",
    "handler": "2000 n=n+1:RESUME NEXT",
    "expected": {
      "x": 2,
      "errors": 2,
      "counter": 3,
      "errorCode": 0
    }
  },
  {
    "name": "outer-while-inner-for",
    "main": "30 WHILE x<2:GOSUB 1000:WEND:GOTO 800",
    "routine": "1000 FOR i=1 TO 2:ERROR 5:x=x+1:RETURN:NEXT i",
    "handler": "2000 n=n+1:RESUME NEXT",
    "expected": {
      "x": 2,
      "errors": 2,
      "counter": 1,
      "errorCode": 0
    }
  },
  {
    "name": "next-discards-pending-for",
    "main": "30 FOR i=1 TO 1:ERROR 5:x=x+1:NEXT i\n40 NEXT j:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:ON ERROR GOTO 2200:FOR j=1 TO 2:RESUME NEXT:NEXT j\n2200 POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 2,
      "errorCode": 1
    }
  },
  {
    "name": "wend-discards-pending-for",
    "main": "30 WHILE x<1:ERROR 5:x=x+1:WEND\n40 NEXT j:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:ON ERROR GOTO 2200:FOR j=1 TO 2:RESUME NEXT:NEXT j\n2200 POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 0,
      "errorCode": 1
    }
  },
  {
    "name": "unnamed-next-associated-for",
    "main": "30 FOR i=1 TO 1:ERROR 5:x=x+1:NEXT:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:ON ERROR GOTO 2200:FOR j=1 TO 1:RESUME NEXT:NEXT j\n2200 POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 2,
      "errorCode": 0
    }
  },
  {
    "name": "cross-actual-for",
    "main": "30 FOR i=1 TO 2:GOSUB 1000\n40 NEXT i:GOTO 800",
    "routine": "1000 x=x+1:GOTO 40",
    "handler": "2000 n=n+1:POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 1,
      "errorCode": 1
    }
  },
  {
    "name": "cross-actual-while",
    "main": "30 WHILE x<2:GOSUB 1000\n40 WEND:GOTO 800",
    "routine": "1000 x=x+1:GOTO 40",
    "handler": "2000 n=n+1:POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 0,
      "errorCode": 30
    }
  },
  {
    "name": "different-next-named",
    "main": "30 FOR i=1 TO 2:x=x+1:GOTO 50\n40 NEXT i\n50 NEXT i:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 1,
      "errorCode": 1
    }
  },
  {
    "name": "different-next-unnamed",
    "main": "30 FOR i=1 TO 2:x=x+1:GOTO 50\n40 NEXT i\n50 NEXT:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 1,
      "errorCode": 1
    }
  },
  {
    "name": "different-wend",
    "main": "30 WHILE x<2:x=x+1:GOTO 50\n40 WEND\n50 WEND:GOTO 800",
    "routine": "",
    "handler": "2000 n=n+1:POKE &8103,ERR:RESUME 800",
    "expected": {
      "x": 1,
      "errors": 1,
      "counter": 0,
      "errorCode": 30
    }
  },
  { name: 'for-retry-pending', main: '30 FOR i=1 TO 2:q=10/d:x=x+1:NEXT i:GOTO 800', routine: '', handler: '2000 n=n+1:d=2:FOR j=1 TO 2:RESUME:NEXT j', expected: { x: 2, errors: 1, counter: 3, errorCode: 0 } },
  { name: 'while-retry-pending', main: '30 WHILE x<2:q=10/d:x=x+1:WEND:GOTO 800', routine: '', handler: '2000 n=n+1:d=2:WHILE 1:RESUME:WEND', expected: { x: 2, errors: 1, counter: 0, errorCode: 0 } },
  { name: 'multiple-next', main: '30 FOR i=1 TO 2:FOR j=1 TO 2:ERROR 5:x=x+1:NEXT j,i:GOTO 800', routine: '', handler: '2000 n=n+1:RESUME NEXT', expected: { x: 4, errors: 4, counter: 3, errorCode: 0 } },
  { name: 'then-for', main: '30 IF 1 THEN FOR i=1 TO 2:ERROR 5:x=x+1:NEXT i ELSE x=99\n40 GOTO 800', routine: '', handler: '2000 n=n+1:RESUME NEXT', expected: { x: 2, errors: 2, counter: 3, errorCode: 0 } },
  { name: 'else-while', main: '30 IF 0 THEN x=99 ELSE WHILE x<2:ERROR 5:x=x+1:WEND\n40 GOTO 800', routine: '', handler: '2000 n=n+1:RESUME NEXT', expected: { x: 2, errors: 2, counter: 0, errorCode: 0 } }
];
