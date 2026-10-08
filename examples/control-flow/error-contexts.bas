10 REM Deux erreurs et remplacement du gestionnaire
20 total=0:ON ERROR GOTO 100
30 ERROR 5:ERROR 6
40 PRINT "Total";total
50 ON ERROR GOTO 0:END
100 total=total+1:ON ERROR GOTO 200:RESUME NEXT
200 total=total+10:RESUME NEXT
