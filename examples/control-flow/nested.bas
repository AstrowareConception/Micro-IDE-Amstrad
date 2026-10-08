10 REM IF imbriques et NEXT multiples - total attendu : 21
20 total=0
30 FOR i=1 TO 2:FOR j=1 TO 3
40 IF i=1 THEN IF j=1 THEN total=total+1 ELSE total=total+2 ELSE IF j=3 THEN total=total+10 ELSE total=total+3
50 NEXT j,i
60 PRINT "Total :";total
70 END
