10 REM Retours imbriques et routine qui termine le programme
20 n=3:total=0:GOSUB 100
30 PRINT "Total";total
40 GOSUB 300
50 PRINT "Sans chemin apres GOSUB 300"
60 END
100 IF n=0 THEN RETURN
110 total=total+n:n=n-1:GOSUB 200:RETURN
200 GOSUB 100:RETURN
300 END
