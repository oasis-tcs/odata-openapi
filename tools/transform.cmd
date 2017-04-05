@echo off 
setlocal

@rem XSLT command-line see https://xml.apache.org/xalan-j/commandline.html

set CLASSPATH=%CLASSPATH%;C:\eclipse-Neon\plugins\org.apache.xml.serializer_2.7.1.v201005080400.jar;C:\eclipse-Neon\plugins\org.apache.xalan_2.7.1.v201005080400.jar
set done=false

for /F "eol=# tokens=1,2,3,4,5" %%F in (%~n0.txt) do (
	if /I [%~n1]==[%%~nF] (
	    set done=true
		call :process %%F %%G %%H %%I %%J
	) else if [%1]==[] (
	    set done=true
		call :process %%F %%G %%H %%I %%J
	)
)

if %done%==false echo Don't know how to %~n0 %1

endlocal
exit /b


:process
  echo %~n1
  
  if [%5]==[V2] (
    java.exe org.apache.xalan.xslt.Process -XSL V2-to-V4-CSDL.xsl -IN ..\examples\%1 -OUT %~n1.V4.xml
    set VERSION=2.0
    set INPUT=%~n1.V4.xml
  ) else if [%5]==[V3] (
    java.exe org.apache.xalan.xslt.Process -XSL V2-to-V4-CSDL.xsl -IN ..\examples\%1 -OUT %~n1.V4.xml
    set VERSION=3.0
    set INPUT=%~n1.V4.xml
  ) else (
    set VERSION=4.0
    set INPUT=..\examples\%1
  )

  java.exe org.apache.xalan.xslt.Process -XSL V4-CSDL-to-openapi.xsl -PARAM scheme %2 -PARAM host %3 -PARAM basePath %4 -PARAM odata-version %VERSION% -PARAM swagger-ui http://petstore.swagger.io -PARAM swagger-ui-major-version 3 -PARAM diagram YES -PARAM references YES -IN %INPUT% -OUT %~n1.tmp.json

  c:\git\yajl\build\yajl-2.1.1\bin\json_reformat.exe < %~n1.tmp.json > ..\examples\%~n1.openapi.json
  if not errorlevel 1 (
    del %~n1.tmp.json
    if [%5]==[V2] del %~n1.V4.xml
    if [%5]==[V3] del %~n1.V4.xml
    git.exe --no-pager diff ..\examples\%~n1.openapi.json
  )

exit /b