@echo off 
setlocal

@rem  This script runs all test cases in the tests folder

for %%F in (tests\*.xml) do (
  call transform %%F /swagger
)

endlocal
exit /b