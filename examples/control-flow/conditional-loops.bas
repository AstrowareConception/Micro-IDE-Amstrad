10 REM Boucles dans IF et boucle externe eventuellement sautee
20 total=0:n=0:a=1
30 FOR i=1 TO n:FOR j=1 TO 3:total=total+100:NEXT j,i
40 IF a THEN FOR i=1 TO 2:total=total+1:a=0:NEXT i ELSE total=99
50 IF a THEN total=99 ELSE WHILE total<5:total=total+1:WEND
60 IF total=5 THEN FOR i=2 TO 1:total=99:NEXT i:total=total+10
70 PRINT "Total :";total
80 END
