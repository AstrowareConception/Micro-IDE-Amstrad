10 REM FN : parametre local et variable libre
20 x=99
30 DEF FNinner(y)=x+y
40 DEF FNouter(x)=FNinner(2)+x
50 result=FNouter(3)
60 PRINT "Resultat";result;"Globale";x
70 END
