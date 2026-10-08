// Expected values observed on the qualified CPC 6128 BASIC ROM. No analyzer-derived oracle.
export const conditionalErrorCases: ReadonlyArray<{
 name: string; setup: string; code: string; next: readonly [number, number]; retry: readonly [number, number]; retryAt: string; nextAt: string | null;
}> = [
 {"name": "then", "setup": "a=1:b=1", "code": "IF a THEN ERROR 5:x=x+1 ELSE x=99", "next": [1, 1], "retry": [99, 1], "retryAt": "IF a", "nextAt": "x=x+1"},
 {"name": "else", "setup": "a=0:b=1", "code": "IF a THEN x=99 ELSE ERROR 5:x=x+2", "next": [0, 1], "retry": [99, 1], "retryAt": "IF a", "nextAt": null},
 {"name": "then-prefix", "setup": "a=1:b=1", "code": "IF a THEN x=x+10:ERROR 5:x=x+1 ELSE x=99", "next": [11, 1], "retry": [10, 2], "retryAt": "ERROR 5", "nextAt": "x=x+1"},
 {"name": "else-prefix", "setup": "a=0:b=1", "code": "IF a THEN x=99 ELSE x=x+10:ERROR 5:x=x+2", "next": [12, 1], "retry": [10, 2], "retryAt": "ERROR 5", "nextAt": "x=x+2"},
 {"name": "then-no-else", "setup": "a=1:b=1", "code": "IF a THEN ERROR 5:x=x+1", "next": [1, 1], "retry": [0, 1], "retryAt": "IF a", "nextAt": "x=x+1"},
 {"name": "then-then", "setup": "a=1:b=1", "code": "IF a THEN IF b THEN ERROR 5:x=x+1 ELSE x=98 ELSE x=99", "next": [1, 1], "retry": [99, 1], "retryAt": "IF a", "nextAt": "x=x+1"},
 {"name": "then-else", "setup": "a=1:b=0", "code": "IF a THEN IF b THEN x=98 ELSE ERROR 5:x=x+2 ELSE x=99", "next": [0, 1], "retry": [99, 1], "retryAt": "IF a", "nextAt": null},
 {"name": "else-then", "setup": "a=0:b=1", "code": "IF a THEN x=99 ELSE IF b THEN ERROR 5:x=x+4 ELSE x=98", "next": [0, 1], "retry": [99, 1], "retryAt": "IF a", "nextAt": null},
 {"name": "else-else", "setup": "a=0:b=0", "code": "IF a THEN x=99 ELSE IF b THEN x=98 ELSE ERROR 5:x=x+8", "next": [0, 1], "retry": [99, 1], "retryAt": "IF a", "nextAt": null},
 {"name": "two-then", "setup": "a=1:b=1", "code": "IF a THEN ERROR 5:x=x+1:ERROR 6:x=x+2 ELSE x=99", "next": [1, 2], "retry": [99, 1], "retryAt": "IF a", "nextAt": "x=x+1"},
 {"name": "two-else", "setup": "a=0:b=1", "code": "IF a THEN x=99 ELSE ERROR 5:x=x+1:ERROR 6:x=x+2", "next": [0, 1], "retry": [99, 1], "retryAt": "IF a", "nextAt": null},
 {"name": "else-inner-prefix", "setup": "a=0:b=1", "code": "IF a THEN x=99 ELSE x=10:IF b THEN ERROR 5:x=x+1 ELSE x=98", "next": [11, 1], "retry": [98, 1], "retryAt": "IF b", "nextAt": "x=x+1"},
 {"name": "then-inner-prefix", "setup": "a=1:b=1", "code": "IF a THEN x=10:IF b THEN ERROR 5:x=x+1 ELSE x=98 ELSE x=99", "next": [11, 1], "retry": [98, 1], "retryAt": "IF b", "nextAt": "x=x+1"},
 {"name": "else-unexecuted-colon", "setup": "a=0:b=1", "code": "IF a THEN x=99:x=98 ELSE ERROR 5:x=x+2", "next": [98, 1], "retry": [98, 1], "retryAt": "IF a", "nextAt": "x=98"},
 {"name": "then-else-prefix", "setup": "a=1:b=0", "code": "IF a THEN IF b THEN x=98 ELSE x=10:ERROR 5:x=x+2 ELSE x=99", "next": [12, 1], "retry": [10, 2], "retryAt": "ERROR 5", "nextAt": "x=x+2"},
 {"name": "else-then-prefix", "setup": "a=0:b=1", "code": "IF a THEN x=99 ELSE IF b THEN x=10:ERROR 5:x=x+4 ELSE x=98", "next": [14, 1], "retry": [10, 2], "retryAt": "ERROR 5", "nextAt": "x=x+4"},
 {"name": "after-prefix", "setup": "a=1:b=1", "code": "x=10:IF a THEN ERROR 5:x=x+1 ELSE x=99", "next": [11, 1], "retry": [99, 1], "retryAt": "IF a", "nextAt": "x=x+1"},
 {"name": "then-next-if", "setup": "a=1:b=1", "code": "IF a THEN ERROR 5:IF b THEN x=1 ELSE x=2 ELSE x=99", "next": [2, 1], "retry": [99, 1], "retryAt": "IF a", "nextAt": "IF b"},
 {"name": "then-next-data", "setup": "a=1:b=1", "code": "IF a THEN ERROR 5:DATA \"ELSE:IF\",4:x=1 ELSE x=99", "next": [1, 1], "retry": [99, 1], "retryAt": "IF a", "nextAt": "DATA"},
 {"name": "then-empty-colons", "setup": "a=1:b=1", "code": "IF a THEN ::ERROR 5::x=1 ELSE x=99", "next": [1, 1], "retry": [0, 2], "retryAt": "ERROR 5", "nextAt": "x=1"},
 {"name": "else-skipped-string", "setup": "a=0:b=1", "code": "IF a THEN PRINT \"ELSE:IF\":x=98 ELSE ERROR 5:x=2", "next": [98, 1], "retry": [98, 1], "retryAt": "IF a", "nextAt": "x=98"},
 {"name": "else-skipped-data", "setup": "a=0:b=1", "code": "IF a THEN DATA \"ELSE:IF\",4:x=98 ELSE ERROR 5:x=2", "next": [98, 1], "retry": [98, 1], "retryAt": "IF a", "nextAt": "x=98"},
 {"name": "three-then", "setup": "a=1:b=1", "code": "IF a THEN IF b THEN IF a THEN ERROR 5:x=1 ELSE x=97 ELSE x=98 ELSE x=99", "next": [1, 1], "retry": [99, 1], "retryAt": "IF a", "nextAt": "x=1"}
];
