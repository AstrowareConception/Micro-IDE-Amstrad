10 REM Reparer un diviseur avant de reprendre
20 ON ERROR GOTO 100:d=0:n=0
30 q=10/d
40 r=10\d:m=10 MOD d
50 PRINT "Quotient";q;"Entier";r;"Reste";m;"Reprises";n
60 ON ERROR GOTO 0:END
100 n=n+1:d=2:RESUME
