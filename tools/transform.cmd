@echo off 
setlocal

@rem  This script uses the Apache Xalan 2.7.1 XSLT processor
@rem  For a description of Xalan command-line parameters see http://xalan.apache.org/xalan-j/commandline.html
@rem
@rem  Prerequisites
@rem  - Java SE is installed and in the PATH - download from http://www.oracle.com/technetwork/java/javase/downloads/index.html 
@rem  - git is installed and in the PATH - download from https://git-for-windows.github.io/
@rem    Xalan is installed and CLASSPATH contains xalan.jar and serializer.jar - download from http://xalan.apache.org/xalan-j/downloads.html
set CLASSPATH=%XALAN_HOME%/xalan.jar;%XALAN_HOME%/serializer.jar
@rem  - YAJL's json_reformat from https://github.com/lloyd/yajl has been compiled and is in the PATH
@rem  - Node.js is installed - download from https://nodejs.org/
@rem  - ajv-cli is installed - npm install -g ajv-cli
@rem  - https://github.com/OAI/OpenAPI-Specification is cloned next to this project
set SCHEMA_THREE=openapi-3.0.0.schema.json
set SCHEMA_TWO=..\..\OpenAPI-Specification\schemas\v2.0\schema.json

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

if %done%==false (
  if exist "%1" (
    if /I [%2]==[V2] (
		  call :process %1 http localhost /service-root V2
    ) else (
		  call :process %1 http localhost /service-root V4
    )
  ) else (
    echo Don't know how to %~n0 %1
  )
) 

endlocal
exit /b


:process
  echo %~n1
  
  if [%5]==[V2] (
    java.exe org.apache.xalan.xslt.Process -L -XSL V2-to-V4-CSDL.xsl -IN ..\examples\%1 -OUT %~n1.V4.xml
    set VERSION=2.0
    set INPUT=%~n1.V4.xml
  ) else if [%5]==[V3] (
    java.exe org.apache.xalan.xslt.Process -L -XSL V2-to-V4-CSDL.xsl -IN ..\examples\%1 -OUT %~n1.V4.xml
    set VERSION=3.0
    set INPUT=%~n1.V4.xml
  ) else (
    set VERSION=4.0
    set INPUT=..\examples\%1
  )

  java.exe org.apache.xalan.xslt.Process -L -XSL V4-CSDL-to-OpenAPI.xsl -PARAM scheme %2 -PARAM host %3 -PARAM basePath %4 -PARAM odata-version %VERSION% -PARAM diagram YES -PARAM references YES -PARAM openapi-root "https://raw.githubusercontent.com/oasis-tcs/odata-openapi/master/examples/" -PARAM openapi-version 3.0.0 -IN %INPUT% -OUT %~n1.tmp3.json

  json_reformat.exe < %~n1.tmp3.json > ..\examples\%~n1.openapi3.json
  if not errorlevel 1 (
    del %~n1.tmp3.json
    git.exe --no-pager diff ..\examples\%~n1.openapi3.json

    if exist %SCHEMA_THREE% call ajv validate --unknown-formats=uriref -s %SCHEMA_THREE% -d ..\examples\%~n1.openapi3.json > nul
  )

  java.exe org.apache.xalan.xslt.Process -L -XSL V4-CSDL-to-openapi.xsl -PARAM scheme %2 -PARAM host %3 -PARAM basePath %4 -PARAM odata-version %VERSION% -PARAM diagram YES -PARAM references YES -PARAM openapi-root "https://raw.githubusercontent.com/oasis-tcs/odata-openapi/master/examples/" -IN %INPUT% -OUT %~n1.tmp.json

  json_reformat.exe < %~n1.tmp.json > ..\examples\%~n1.openapi.json
  if not errorlevel 1 (
    del %~n1.tmp.json
    if [%5]==[V2] del %~n1.V4.xml
    if [%5]==[V3] del %~n1.V4.xml
    git.exe --no-pager diff ..\examples\%~n1.openapi.json
    
    if exist %SCHEMA_TWO% call ajv -s %SCHEMA_TWO% -d ..\examples\%~n1.openapi.json > nul
  )

exit /b