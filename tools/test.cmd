@rem  This script runs all test cases in the tests folder

@echo off 
setlocal

call :get-time t0

for %%F in (tests\*.xml) do (
  call transform %%F /swagger
)

call :get-time t1
call :echo-elapsed t0 t1

endlocal
exit /b


:get-time
for /F "tokens=1-4 delims=:.," %%a in ("%time%") do (
  set /A "%1=(((%%a*60)+1%%b %% 100)*60+1%%c %% 100)*100+1%%d %% 100"
)
exit /b


:echo-elapsed
setlocal
set /A sec=(%2-%1)/100, frac=(%2-%1)%%100
echo.
echo Elapsed time: %sec%.%frac% seconds
endlocal
exit /b
